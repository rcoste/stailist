"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { JourneyState, NudgeId, NudgeLifecycle } from "@/lib/journey";

const VALID: NudgeId[] = ["tryon", "closet_real", "capsula"];

// Marca el ciclo de vida de un nudge en profiles.journey_state. "dismissed" y
// "done" lo apagan (el resolvedor deja de mostrarlo); "shown" solo registra que
// se vio (analítica). Se llama desde el cliente cuando el usuario descarta o
// completa el nudge.
export async function markNudge(
  id: NudgeId,
  event: "shown" | "dismissed" | "done"
): Promise<void> {
  if (!VALID.includes(id)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("journey_state")
    .eq("id", user.id)
    .single();
  const state = ((profile?.journey_state as JourneyState | null) ?? {}) as JourneyState;

  const now = new Date().toISOString();
  const entry: NudgeLifecycle = { ...(state[id] ?? {}) };
  if (event === "shown" && !entry.shown_at) entry.shown_at = now;
  if (event === "dismissed") entry.dismissed_at = now;
  if (event === "done") entry.done_at = now;
  state[id] = entry;

  await supabase.from("profiles").update({ journey_state: state }).eq("id", user.id);
  revalidatePath("/hoy");
  revalidatePath("/closet");
}
