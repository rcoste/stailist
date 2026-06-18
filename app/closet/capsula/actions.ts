"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ASSESSMENT_QUESTIONS,
  type CapsuleDecision,
  type CapsuleOverrides,
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
    .select("gender, taste_tags, style_archetype, palette_season, palette_flow")
    .eq("id", user.id)
    .single();
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

  let target: CapsuleTarget;
  try {
    target = await generateCapsuleTarget({
      answers,
      gender,
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
    match = await matchCapsule(target, closet, gender);
  } catch {
    match = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      lifestyle: answers,
      capsule_target: target,
      capsule_match: match,
      capsule_overrides: null, // cápsula nueva → se borran las decisiones viejas
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    return { status: "error", message: "No pude guardar tu cápsula — dale otra vez." };
  }

  redirect("/closet/capsula");
}

// Decisión del usuario sobre una prenda "parecido": aceptar (cuenta como cubierta)
// o rechazar (quiere la ideal → te falta). Toggle: re-elegir lo mismo lo deshace.
export async function setCapsuleOverride(formData: FormData): Promise<void> {
  const index = String(formData.get("index") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!index || (decision !== "accept" && decision !== "reject")) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_overrides")
    .eq("id", user.id)
    .single();
  const current = ((profile?.capsule_overrides as CapsuleOverrides | null) ?? {}) as CapsuleOverrides;

  if (current[index] === decision) delete current[index];
  else current[index] = decision as CapsuleDecision;

  await supabase.from("profiles").update({ capsule_overrides: current }).eq("id", user.id);
  revalidatePath("/closet/capsula");
  revalidatePath("/closet");
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
    .select("capsule_target, gender")
    .eq("id", user.id)
    .single();
  const target = profile?.capsule_target as CapsuleTarget | null;
  if (!target) return;
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

  // Si el match falla (timeout/red), no tiramos la acción: dejamos el match como
  // estaba y revalidamos. El card seguirá mostrando "recalcular" para reintentar.
  try {
    const closet = await loadClosetLite(supabase, user.id);
    const match = await matchCapsule(target, closet, gender);
    await supabase.from("profiles").update({ capsule_match: match }).eq("id", user.id);
  } catch {
    // swallow — el usuario puede reintentar con el botón.
  }
  revalidatePath("/closet");
}
