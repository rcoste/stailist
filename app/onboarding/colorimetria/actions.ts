"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeSeason,
  isQuizComplete,
  type Season,
} from "@/lib/colorimetria";

export async function savePalette(
  answers: Record<string, string>
): Promise<{ season: Season } | { error: string }> {
  if (!isQuizComplete(answers)) {
    return { error: "Te faltó alguna pregunta — revisa y va de nuevo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const season = computeSeason(answers);

  const { error } = await supabase
    .from("profiles")
    .update({
      palette_season: season,
      palette_quiz: answers,
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("onboarding_step", 1); // no retrocede a quien ya iba más adelante

  if (error) {
    return { error: "No pude guardar tu paleta — inténtalo otra vez." };
  }

  await supabase.from("events").insert({
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 2, season, answers, source: "quiz" },
  });

  return { season };
}

// Guarda la estación detectada por la selfie. La confianza y el porqué se
// guardan como metadata (origen 'foto') para medir después qué tan bien jala.
export async function savePaletteFromPhoto(
  season: Season,
  meta: { confianza: string; por_que: string }
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      palette_season: season,
      palette_quiz: { source: "foto", ...meta },
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("onboarding_step", 1);

  if (error) return { ok: false };

  await supabase.from("events").insert({
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 2, season, source: "foto", ...meta },
  });

  return { ok: true };
}
