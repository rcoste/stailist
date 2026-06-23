"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  loadClosetLite,
  loadClosetImageMap,
  borrowArchetypeImage,
} from "@/lib/capsule-data";
import { matchSubstitutes } from "@/lib/engine/trip-substitutes";
import { capsuleRows, closetSignature } from "@/lib/capsule";
import { familiaToHex } from "@/lib/capsule-images";
import { renderItemImage } from "@/lib/render-item";
import type {
  CapsuleDecision,
  CapsuleMatch,
  CapsuleOverrides,
  CapsuleTarget,
  MatchEntry,
} from "@/lib/capsule";
import type { TripOutfit } from "@/lib/trip";

// Clave namespaced para guardar un sustituto dentro de overrides (jsonb) sin una
// columna nueva: capsuleRows solo lee claves numéricas, así que "sub:<i>" no
// interfiere. Valor = nombre exacto de la prenda del clóset elegida.
const subKey = (index: number) => `sub:${index}`;

export type SubstituteCandidate = { nombre: string; porque: string; image: string | null };

// "Buscar en mi clóset": la IA propone hasta 3 prendas reales del clóset que
// pueden cubrir una que falta para el viaje. Read-only (no persiste nada).
export async function suggestTripSubstitutes(
  tripId: string,
  index: number
): Promise<SubstituteCandidate[]> {
  if (!Number.isInteger(index)) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: trip }, { data: profile }] = await Promise.all([
    supabase
      .from("trips")
      .select("capsule_target, capsule_match, overrides")
      .eq("id", tripId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("profiles").select("gender").eq("id", user.id).single(),
  ]);
  const target = trip?.capsule_target as CapsuleTarget | null;
  const missing = target?.items?.[index];
  if (!missing) return [];

  // Prendas del clóset que YA están en la maleta (cubren otro hueco o ya son
  // sustituto): no tiene sentido proponerlas otra vez — no puedes empacar la
  // misma prenda dos veces. Se excluyen del clóset que ve la IA.
  const match = (trip?.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = (trip?.overrides as CapsuleOverrides | null) ?? null;
  const used = new Set<string>();
  for (const r of capsuleRows(target, match, overrides)) {
    if (r.covered && r.by) used.add(r.by);
  }
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (k.startsWith("sub:") && typeof v === "string") used.add(v);
  }

  const [closetAll, imageMap] = await Promise.all([
    loadClosetLite(supabase, user.id),
    loadClosetImageMap(supabase, user.id),
  ]);
  const closet = closetAll.filter((c) => !used.has(c.nombre));
  const matches = await matchSubstitutes(
    missing,
    closet,
    (profile?.gender as "hombre" | "mujer" | null) ?? null
  );
  return matches.map((m) => ({ ...m, image: imageMap[m.nombre] ?? null }));
}

// "Ya lo tengo" sobre una prenda que te FALTA en el viaje: la suma a tu clóset
// de verdad (es tuya, sirve para todos tus outfits) con sus atributos de la
// cápsula ideal, le genera imagen (prestada del catálogo o, si no hay, su render
// limpio) Y la marca cubierta en el match DEL VIAJE. Antes esto solo marcaba
// "empacado" sin agregar nada — por eso no se confirmaba. Inline: cuando resuelve,
// la prenda ya está agregada + con imagen (el botón muestra spinner mientras).
export async function markTripFaltaOwned(
  tripId: string,
  index: number
): Promise<{ ok: boolean; itemId: string | null }> {
  if (!Number.isInteger(index) || index < 0) return { ok: false, itemId: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, itemId: null };

  const [{ data: trip }, { data: profile }] = await Promise.all([
    supabase
      .from("trips")
      .select("capsule_target, capsule_match, empacado")
      .eq("id", tripId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("profiles").select("gender").eq("id", user.id).single(),
  ]);
  const target = trip?.capsule_target as CapsuleTarget | null;
  const match = trip?.capsule_match as CapsuleMatch | null;
  const item = target?.items[index];
  if (!target || !match || !item) return { ok: false, itemId: null };

  // Imagen prestada de un arquetipo de la misma categoría/color parecido.
  const imagePath = await borrowArchetypeImage(
    supabase,
    item.category,
    familiaToHex(item.colorFamilia),
    (profile?.gender as "hombre" | "mujer" | null) ?? null,
    `${item.tipo} ${item.nombre}`
  );

  // Suma la prenda al clóset (global; es tuya, no solo de este viaje).
  const { data: inserted, error: insErr } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      source: "photo",
      attrs: {
        nombre: item.nombre,
        categoria: item.category,
        color: item.colorFamilia,
        color_hex: familiaToHex(item.colorFamilia),
        formalidad: item.formalidad,
        temporada: item.temporada,
        ...(imagePath ? { image_path: imagePath } : {}),
      },
    })
    .select("id")
    .single();
  if (insErr || !inserted) return { ok: false, itemId: null };

  // Sin imagen prestada → genera su render limpio ahora (inline).
  if (!imagePath) {
    await renderItemImage(supabase, user.id, inserted.id as string);
  }

  // Marca esa prenda ideal como cubierta en el match DEL VIAJE + refresca firma.
  const closet = await loadClosetLite(supabase, user.id);
  const entries: MatchEntry[] = target.items.map((_, i) =>
    i === index
      ? { status: "tienes", by: item.nombre }
      : match.entries[i] ?? { status: "falta", by: null }
  );
  const newMatch: CapsuleMatch = { signature: closetSignature(closet), entries };
  // Y la deja palomeada (empacada) — "ya lo tengo" = la tienes y la empacas.
  const empacado = {
    ...((trip?.empacado as Record<string, boolean> | null) ?? {}),
    [String(index)]: true,
  };
  await supabase
    .from("trips")
    .update({ capsule_match: newMatch, empacado })
    .eq("id", tripId)
    .eq("user_id", user.id);

  revalidatePath(`/viaje/${tripId}`);
  return { ok: true, itemId: inserted.id as string };
}

// Fija una prenda del clóset como sustituto de una que falta: la guarda en
// overrides ("sub:<i>") y la marca empacada (pasa a "Empaca esto"). Cambia lo
// empacable → los looks ya generados quedan viejos.
export async function setTripSubstitute(
  tripId: string,
  index: number,
  nombre: string
): Promise<void> {
  if (!Number.isInteger(index) || !nombre.trim()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: trip } = await supabase
    .from("trips")
    .select("overrides, empacado, outfits")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return;

  const overrides = ((trip.overrides as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;
  overrides[subKey(index)] = nombre.trim();

  const empacado = ((trip.empacado as Record<string, boolean> | null) ?? {}) as Record<
    string,
    boolean
  >;
  empacado[String(index)] = true;

  const hasOutfits = Array.isArray(trip.outfits) && trip.outfits.length > 0;
  await supabase
    .from("trips")
    .update(hasOutfits ? { overrides, empacado, outfits_stale: true } : { overrides, empacado })
    .eq("id", tripId)
    .eq("user_id", user.id);
  revalidatePath(`/viaje/${tripId}`);
}

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
