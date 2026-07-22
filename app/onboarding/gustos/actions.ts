"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, createTokenClient } from "@/lib/supabase/server";
import { computeTasteTags, LOOKS, LOOK_IDS } from "@/lib/looks";
import { generateArchetype, type StyleArchetype } from "@/lib/engine/archetype";
import { ageStylingLine, ageLabel, type AgeRange } from "@/lib/edad";
import { generateStyleQuestions } from "@/lib/engine/style-questions";
import { styleQuestionsSig } from "@/lib/style-questions-cache";
import type { AssessmentQuestion, LifestyleAnswers } from "@/lib/capsule";
import type { Gender } from "@/lib/auth";

export type SwipeResult = { id: string; liked: boolean };

// Devuelve el arquetipo para revelarlo en pantalla (no redirige: el reveal
// vive en el paso de gustos, como el de colorimetría). Error → string.
export async function saveTastes(
  results: SwipeResult[]
): Promise<{ archetype: StyleArchetype } | { error: string }> {
  const clean = results.filter(
    (r) => LOOK_IDS.has(r.id) && typeof r.liked === "boolean"
  );
  if (clean.length === 0) {
    return { error: "No me llegó ningún swipe — inténtalo de nuevo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tasteTags = computeTasteTags(clean);

  // Género para concordancia gramatical del arquetipo (ya se eligió en la
  // antesala de género, antes de los gustos).
  const { data: prof } = await supabase
    .from("profiles")
    .select("gender, age_range")
    .eq("id", user.id)
    .single();
  const gender = (prof?.gender ?? null) as Gender | null;
  const ageRange = (prof?.age_range ?? null) as AgeRange | null;

  // Arquetipo a partir de los looks con ❤️. Si la IA falla, seguimos sin
  // arquetipo (no bloquea el onboarding) con un fallback neutro.
  const likedLooks = LOOKS.filter(
    (l) => clean.find((r) => r.id === l.id)?.liked
  );
  let archetype: StyleArchetype;
  try {
    archetype = await generateArchetype(likedLooks, gender, ageStylingLine(ageRange));
  } catch {
    archetype = {
      nombre: "Tu estilo",
      descripcion: "te gustan las cosas que se sienten tuyas.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      taste_tags: tasteTags,
      style_archetype: archetype,
      onboarding_step: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("onboarding_step", 0); // no retrocede a quien ya iba más adelante

  if (error) {
    return { error: "No pude guardar tus gustos — dale otra vez." };
  }

  // Los swipes crudos quedan en events: sirven para afinar looks y tags después.
  await supabase.from("events").insert({
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 1, swipes: clean, taste_tags: tasteTags, archetype },
  });

  // Calienta las preguntas de calibración EN BACKGROUND (after() corre tras
  // responder): mientras la usuaria lee su reveal, la IA genera 2-3 preguntas
  // a la medida de sus swipes. Misma firma que usa la cápsula → cache
  // compartido: si aquí no alcanzan a estar listas, aparecen allá como siempre.
  // OJO: dentro de after() las cookies ya no existen — el token se captura
  // ANTES de responder y se escribe con createTokenClient (patrón de la casa).
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;
  if (accessToken) {
    after(async () => {
      try {
        const sig = styleQuestionsSig({ style_archetype: archetype, taste_tags: tasteTags });
        const questions = await generateStyleQuestions({
          archetype,
          tasteTags,
          gender,
          paletaLabel: null, // la colorimetría aún no existe en este punto
          siluetaLabel: null,
          edadLabel: ageLabel(ageRange),
        });
        if (questions.length) {
          await createTokenClient(accessToken)
            .from("profiles")
            .update({ style_questions: { sig, questions } })
            .eq("id", user.id);
        }
      } catch {
        // Best-effort: sin preguntas calientes, el reveal sigue directo a colores.
      }
    });
  }

  return { archetype };
}

// Preguntas de calibración listas para el cierre del swipe. NO genera nada (la
// generación corre en background desde saveTastes): devuelve el cache solo si
// corresponde al estilo recién guardado, o null → el reveal sigue sin preguntas.
export async function getCalibrationQuestions(): Promise<AssessmentQuestion[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("style_archetype, taste_tags, style_questions")
    .eq("id", user.id)
    .single();
  const cached = profile?.style_questions as {
    sig?: string;
    questions?: AssessmentQuestion[];
  } | null;
  if (!cached?.questions?.length) return null;
  const sig = styleQuestionsSig({
    style_archetype: (profile?.style_archetype as { nombre: string } | null) ?? null,
    taste_tags: (profile?.taste_tags as string[] | null) ?? null,
  });
  if (cached.sig !== sig) return null;
  return cached.questions.slice(0, 3);
}

// Guarda las respuestas de calibración en profiles.lifestyle: el quiz de la
// cápsula las pre-llena de ahí (prop initial) y el motor de cápsula ya las
// consume vía questions+answers — cero cambios de motor. Valida contra las
// preguntas cacheadas (ids y values reales, nada inventado del cliente).
export async function saveCalibration(
  answers: Record<string, string>
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("style_questions, lifestyle")
    .eq("id", user.id)
    .single();
  const questions =
    (profile?.style_questions as { questions?: AssessmentQuestion[] } | null)?.questions ?? [];

  const clean: LifestyleAnswers = {};
  for (const q of questions) {
    const raw = answers[q.id];
    if (typeof raw !== "string" || !raw) continue;
    const vals = q.multi ? raw.split(",").filter(Boolean) : [raw];
    if (vals.every((v) => q.options.some((o) => o.value === v))) {
      clean[q.id] = vals.join(",");
    }
  }
  if (Object.keys(clean).length === 0) return { ok: true }; // nada válido = nada que guardar

  const lifestyle = {
    ...((profile?.lifestyle as LifestyleAnswers | null) ?? {}),
    ...clean,
  };
  const { error } = await supabase
    .from("profiles")
    .update({ lifestyle, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  return { ok: !error };
}

// Re-edición de gustos DESPUÉS del onboarding (desde el Perfil): recalcula tags y
// arquetipo y los guarda SIN tocar el onboarding_step (ya avanzó). Misma firma que
// saveTastes para que el SwipeDeck la trate igual.
export async function updateTastes(
  results: SwipeResult[]
): Promise<{ archetype: StyleArchetype } | { error: string }> {
  const clean = results.filter(
    (r) => LOOK_IDS.has(r.id) && typeof r.liked === "boolean"
  );
  if (clean.length === 0) {
    return { error: "No me llegó ningún swipe — inténtalo de nuevo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tasteTags = computeTasteTags(clean);

  // Género para concordancia gramatical del arquetipo (re-edición desde Perfil:
  // el usuario ya está onboardeado, así que el género existe).
  const { data: prof } = await supabase
    .from("profiles")
    .select("gender, age_range")
    .eq("id", user.id)
    .single();
  const gender = (prof?.gender ?? null) as Gender | null;
  const ageRange = (prof?.age_range ?? null) as AgeRange | null;

  const likedLooks = LOOKS.filter(
    (l) => clean.find((r) => r.id === l.id)?.liked
  );
  let archetype: StyleArchetype;
  try {
    archetype = await generateArchetype(likedLooks, gender, ageStylingLine(ageRange));
  } catch {
    archetype = {
      nombre: "Tu estilo",
      descripcion: "te gustan las cosas que se sienten tuyas.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      taste_tags: tasteTags,
      style_archetype: archetype,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id); // sin guard de onboarding_step: ya está onboardeado

  if (error) {
    return { error: "No pude guardar tus gustos — dale otra vez." };
  }

  return { archetype };
}
