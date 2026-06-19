"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CapsuleDecision, CapsuleOverrides } from "@/lib/capsule";

// Decisión sobre una prenda "parecido" de la cápsula del viaje (igual que la
// cápsula de clóset: aceptar = cuenta como cubierta; toggle re-eligiendo lo
// mismo). Verifica propiedad por user_id (cinturón además del RLS).
export async function setTripOverride(
  tripId: string,
  index: number,
  decision: CapsuleDecision
): Promise<void> {
  if (!Number.isInteger(index) || (decision !== "accept" && decision !== "reject")) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: trip } = await supabase
    .from("trips")
    .select("overrides")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return;

  const current = ((trip.overrides as CapsuleOverrides | null) ?? {}) as CapsuleOverrides;
  const key = String(index);
  if (current[key] === decision) delete current[key];
  else current[key] = decision;

  await supabase
    .from("trips")
    .update({ overrides: current })
    .eq("id", tripId)
    .eq("user_id", user.id);
  revalidatePath(`/viaje/${tripId}`);
}

// Checklist "lo empaqué": marca/desmarca una prenda de la maleta.
export async function setTripPacked(
  tripId: string,
  index: number,
  packed: boolean
): Promise<void> {
  if (!Number.isInteger(index)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: trip } = await supabase
    .from("trips")
    .select("empacado")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return;

  const current = ((trip.empacado as Record<string, boolean> | null) ?? {}) as Record<
    string,
    boolean
  >;
  const key = String(index);
  if (packed) current[key] = true;
  else delete current[key];

  await supabase
    .from("trips")
    .update({ empacado: current })
    .eq("id", tripId)
    .eq("user_id", user.id);
  revalidatePath(`/viaje/${tripId}`);
}
