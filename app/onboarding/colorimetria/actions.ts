"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";
import {
  computeSeasonWithFlow,
  isQuizComplete,
  type Season,
} from "@/lib/colorimetria";

export async function savePalette(
  answers: Record<string, string>
): Promise<{ season: Season; flow: Season | null } | { error: string }> {
  if (!isQuizComplete(answers)) {
    return { error: "Te faltó alguna pregunta — revisa y va de nuevo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { season, flow } = computeSeasonWithFlow(answers);

  const { error } = await supabase
    .from("profiles")
    .update({
      palette_season: season,
      palette_flow: flow,
      palette_quiz: answers,
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("onboarding_step", 1); // no retrocede a quien ya iba más adelante

  if (error) {
    return { error: "No pude guardar tu paleta — inténtalo otra vez." };
  }

  await registrarEvento(supabase, {
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 2, season, flow, answers, source: "quiz" },
  });

  return { season, flow };
}

// Saltar la colorimetría (opcional, NO gatekeep): avanza al clóset sin paleta.
// El motor degrada bien sin estación (se salta el bloque de colorimetría). El
// evento con source "skip" mide cuánta gente la salta vs la hace — señal de
// cuánto le importa. Se puede llenar después desde Perfil.
export async function skipColorimetria(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ onboarding_step: 2, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .eq("onboarding_step", 1); // no retrocede a quien ya iba más adelante

  await registrarEvento(supabase, {
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 2, source: "skip_colorimetria" },
  });

  redirect("/onboarding/closet");
}

// Edición manual del resultado: la usuaria corrige su estación. Actualiza la
// paleta sin tocar el onboarding_step (ya avanzó) y registra el evento como
// métrica de aciertos del análisis automático.
export async function updateColorimetria(
  season: Season,
  flow: Season | null
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({
      palette_season: season,
      palette_flow: flow,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false };

  await registrarEvento(supabase, {
    user_id: user.id,
    type: "colorimetria_edit",
    data: { season, flow },
  });

  return { ok: true };
}
