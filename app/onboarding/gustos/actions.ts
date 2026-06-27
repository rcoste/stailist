"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeTasteTags, LOOKS, LOOK_IDS } from "@/lib/looks";
import { generateArchetype, type StyleArchetype } from "@/lib/engine/archetype";
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
    .select("gender")
    .eq("id", user.id)
    .single();
  const gender = (prof?.gender ?? null) as Gender | null;

  // Arquetipo a partir de los looks con ❤️. Si la IA falla, seguimos sin
  // arquetipo (no bloquea el onboarding) con un fallback neutro.
  const likedLooks = LOOKS.filter(
    (l) => clean.find((r) => r.id === l.id)?.liked
  );
  let archetype: StyleArchetype;
  try {
    archetype = await generateArchetype(likedLooks, gender);
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

  return { archetype };
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
    .select("gender")
    .eq("id", user.id)
    .single();
  const gender = (prof?.gender ?? null) as Gender | null;

  const likedLooks = LOOKS.filter(
    (l) => clean.find((r) => r.id === l.id)?.liked
  );
  let archetype: StyleArchetype;
  try {
    archetype = await generateArchetype(likedLooks, gender);
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
