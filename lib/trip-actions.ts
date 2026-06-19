"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CapsuleDecision, CapsuleOverrides } from "@/lib/capsule";
import type { TripOutfit } from "@/lib/trip";

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
    .select("overrides, outfits")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return;

  const current = ((trip.overrides as CapsuleOverrides | null) ?? {}) as CapsuleOverrides;
  const key = String(index);
  if (current[key] === decision) delete current[key];
  else current[key] = decision;

  // Cambiar una decisión de empaque cambia lo empacable → los looks ya generados
  // quedan viejos. Los marcamos (no los borramos) para invitar a regenerar.
  const hasOutfits = Array.isArray(trip.outfits) && trip.outfits.length > 0;

  await supabase
    .from("trips")
    .update(hasOutfits ? { overrides: current, outfits_stale: true } : { overrides: current })
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

// Voto 👍/👎 sobre un look del viaje. El voto vive dentro del propio look (en
// trips.outfits) — así se regenera con ellos. Doble tap del mismo voto lo quita.
// Emite un evento trip_look_vote (señal de si la maleta sirve, separada del
// ratio del motor diario para no contaminarlo).
export async function setTripLookVote(
  tripId: string,
  index: number,
  up: boolean
): Promise<void> {
  if (!Number.isInteger(index)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: trip } = await supabase
    .from("trips")
    .select("outfits")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return;

  const outfits = (trip.outfits as TripOutfit[] | null) ?? [];
  if (index < 0 || index >= outfits.length) return;

  const next = up ? "up" : "down";
  const prev = outfits[index].voto ?? null;
  const voto = prev === next ? null : next; // doble tap del mismo = quitar
  outfits[index] = { ...outfits[index], voto };

  await supabase
    .from("trips")
    .update({ outfits })
    .eq("id", tripId)
    .eq("user_id", user.id);

  // Log de la interacción (cada cambio que deja un voto puesto cuenta como señal).
  if (voto) {
    await supabase.from("events").insert({
      user_id: user.id,
      type: "trip_look_vote",
      data: { vote: voto, ocasion: outfits[index].ocasion },
    });
  }

  revalidatePath(`/viaje/${tripId}`);
}
