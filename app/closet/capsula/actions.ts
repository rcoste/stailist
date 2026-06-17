"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ASSESSMENT_QUESTIONS,
  type CapsuleTarget,
  type LifestyleAnswers,
} from "@/lib/capsule";
import { generateCapsuleTarget } from "@/lib/engine/capsule-target";
import { matchCapsule } from "@/lib/engine/capsule-match";
import { loadClosetLite } from "@/lib/capsule-data";
import type { Season } from "@/lib/colorimetria";

export type CapsuleState = { status: "idle" } | { status: "error"; message: string };

// Guarda el assessment, genera la cápsula ideal (capa 1) y corre el match contra
// el clóset (capa 2). Todo se persiste; la tarjeta del clóset lee el cache.
export async function saveLifestyle(
  _prev: CapsuleState,
  formData: FormData
): Promise<CapsuleState> {
  const answers: LifestyleAnswers = {};
  for (const q of ASSESSMENT_QUESTIONS) {
    const val = String(formData.get(q.id) ?? "");
    if (!q.options.some((o) => o.value === val)) {
      return { status: "error", message: "Te faltó responder una — complétalas y va de nuevo." };
    }
    answers[q.id] = val;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("taste_tags, style_archetype, palette_season, palette_flow")
    .eq("id", user.id)
    .single();

  let target: CapsuleTarget;
  try {
    target = await generateCapsuleTarget({
      answers,
      tasteTags: (profile?.taste_tags ?? []) as string[],
      archetype:
        (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
      season: (profile?.palette_season as Season | null) ?? null,
      flow: (profile?.palette_flow as Season | null) ?? null,
    });
  } catch {
    await supabase
      .from("profiles")
      .update({ lifestyle: answers, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return {
      status: "error",
      message: "Guardé tus respuestas pero no pude armar tu cápsula. Inténtalo de nuevo en un momento.",
    };
  }

  // Match contra el clóset (capa 2). Si falla, guardamos la cápsula sin match;
  // la tarjeta ofrecerá recalcular.
  const closet = await loadClosetLite(supabase, user.id);
  let match = null;
  try {
    match = await matchCapsule(target, closet);
  } catch {
    match = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      lifestyle: answers,
      capsule_target: target,
      capsule_match: match,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    return { status: "error", message: "No pude guardar tu cápsula — dale otra vez." };
  }

  redirect("/closet");
}

// Recalcula SOLO el match contra el clóset actual (cuando agregaste/quitaste
// prendas). No regenera la cápsula ideal.
export async function recalcularMatch(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_target")
    .eq("id", user.id)
    .single();
  const target = profile?.capsule_target as CapsuleTarget | null;
  if (!target) return;

  const closet = await loadClosetLite(supabase, user.id);
  const match = await matchCapsule(target, closet);
  await supabase.from("profiles").update({ capsule_match: match }).eq("id", user.id);
  revalidatePath("/closet");
}
