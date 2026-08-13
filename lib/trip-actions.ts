"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  loadClosetLite,
  loadClosetImageMap,
  borrowArchetypeImage,
} from "@/lib/capsule-data";
import { matchSubstitutes } from "@/lib/engine/trip-substitutes";
import { capsuleRows } from "@/lib/capsule";
import { matchSignature } from "@/lib/engine/capsule-match";
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
  // Lo que HOY se muestra en ESTE hueco: el `by` del match aunque sea un
  // "parecido" sin decidir — es la prenda que la usuaria está viendo/rechazando.
  let currentBy: string | null = null;
  for (const r of capsuleRows(target, match, overrides)) {
    if (r.covered && r.by) used.add(r.by);
    if (r.index === index && r.by) currentBy = r.by;
  }
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (k.startsWith("sub:") && typeof v === "string") used.add(v);
  }
  // El sustituto ya elegido gana sobre el match como cover actual.
  const subNow = (overrides as Record<string, unknown> | null)?.[`sub:${index}`];
  if (typeof subNow === "string") currentBy = subNow;

  const [closetAll, imageMap] = await Promise.all([
    loadClosetLite(supabase, user.id),
    loadClosetImageMap(supabase, user.id),
  ]);
  const closet = closetAll.filter((c) => !used.has(c.nombre));
  // Si el hueco YA está cubierto, esto es un swap ("no me convence"): el motor recibe
  // la rechazada para proponer alternativas con otro aire, no más de lo mismo.
  const matches = await matchSubstitutes(
    missing,
    closet,
    (profile?.gender as "hombre" | "mujer" | null) ?? null,
    currentBy
  );
  return matches.map((m) => ({ ...m, image: imageMap[m.nombre] ?? null }));
}

/**
 * LAS CANDIDATAS DEL DUELO, calculadas solas al abrir el plan (pieza C de la
 * consistencia cápsula↔viaje, 2026-08-13).
 *
 * Antes esta búsqueda vivía detrás de la lupa "en mi clóset" y solo corría si
 * la tocabas — y quien no la tocaba veía una sección que le decía "cómpralo"
 * teniendo en su clóset con qué cubrirla. La jugada declarada del módulo
 * ("cúbrelo con lo que ya tienes") estaba escondida detrás de un tap opcional.
 *
 * Corre UNA VEZ por hueco en la vida del viaje: el resultado (aunque sea "no
 * hay nada") se persiste en overrides con el patrón de llaves de "sub:" —
 * "cand:i" = el nombre, "cand:i" ausente + "candNo:i" nunca escrito por aquí.
 * Un hueco sin candidata decente guarda "" para no re-pagar la búsqueda.
 */
export async function proposeTripSubstitutes(
  tripId: string
): Promise<Record<number, { nombre: string; image: string | null }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const [{ data: trip }, { data: profile }] = await Promise.all([
    supabase
      .from("trips")
      .select("capsule_target, capsule_match, overrides, outfits")
      .eq("id", tripId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("profiles").select("gender").eq("id", user.id).single(),
  ]);
  const target = trip?.capsule_target as CapsuleTarget | null;
  if (!target) return {};
  // El duelo es UI de la fase de plan. Confirmado (looks generados), la lupa
  // de siempre basta — no se gasta en proponer lo que ya nadie va a revisar.
  if (trip?.outfits !== null) return {};

  const match = (trip?.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = ((trip?.overrides as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;

  // Los huecos SIN propuesta previa (ni candidata, ni descarte, ni sustituto).
  const used = new Set<string>();
  const huecos: number[] = [];
  for (const r of capsuleRows(target, match, overrides as CapsuleOverrides)) {
    if (r.covered && r.by) used.add(r.by);
    if (
      r.effective === "falta" &&
      overrides[`cand:${r.index}`] === undefined &&
      overrides[`candNo:${r.index}`] === undefined &&
      overrides[`sub:${r.index}`] === undefined
    ) {
      huecos.push(r.index);
    }
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (k.startsWith("sub:") && typeof v === "string") used.add(v);
  }
  if (huecos.length === 0) return {};

  const [closetAll, imageMap] = await Promise.all([
    loadClosetLite(supabase, user.id),
    loadClosetImageMap(supabase, user.id),
  ]);
  const closet = closetAll.filter((c) => !used.has(c.nombre));
  if (closet.length === 0) return {};

  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;
  // En paralelo: la espera de la persona es la del hueco MÁS lento, no la suma.
  const resultados = await Promise.all(
    huecos.map(async (i) => {
      try {
        const matches = await matchSubstitutes(target.items[i], closet, gender, null);
        return { i, top: matches[0] ?? null };
      } catch {
        // Un hueco que falla no guarda nada: el próximo abrir lo reintenta.
        return { i, top: null, fallo: true };
      }
    })
  );

  // Un solo write, sobre overrides RE-LEÍDOS: mientras la IA pensaba, la
  // persona pudo tocar el plan (decisiones, sustitutos) y escribir sobre el
  // blob viejo se los pisaría.
  const { data: fresh } = await supabase
    .from("trips")
    .select("overrides")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  const next = ((fresh?.overrides as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;
  const out: Record<number, { nombre: string; image: string | null }> = {};
  for (const r of resultados) {
    if ("fallo" in r && r.fallo) continue;
    // "" = ya se buscó y no hubo nada decente: no volver a pagar la búsqueda.
    next[`cand:${r.i}`] = r.top?.nombre ?? "";
    if (r.top) out[r.i] = { nombre: r.top.nombre, image: imageMap[r.top.nombre] ?? null };
  }
  await supabase
    .from("trips")
    .update({ overrides: next })
    .eq("id", tripId)
    .eq("user_id", user.id);
  revalidatePath(`/viaje/${tripId}`);
  return out;
}

/**
 * DESHACER un duelo ya resuelto — el "por si te arrepientes" que la cápsula
 * tiene desde siempre y al viaje le faltaba (Roberto, 2026-08-13: "debería
 * haber el botón de deshacer... por si la persona decide irse por la que ya
 * tiene en lugar de la que le sugieren, o viceversa").
 *
 * Borra TODO rastro del veredicto y deja `cand:i` intacta, que es lo que
 * permite volver a pintar el mismo duelo sin re-pagar la búsqueda:
 *   · el override numérico (accept/reject de un "parecido");
 *   · `sub:i` (el sustituto que puso "me quedo con la mía");
 *   · `candNo:i` (el descarte de "prefiero la sugerida");
 *   · `empacado[i]`, que setTripSubstitute marca al elegir — sin esto la
 *     prenda volvía al duelo pero seguía contando como empacada.
 */
export async function undoTripDuel(tripId: string, index: number): Promise<void> {
  if (!Number.isInteger(index)) return;
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
  delete overrides[String(index)];
  delete overrides[`sub:${index}`];
  delete overrides[`candNo:${index}`];

  const empacado = ((trip.empacado as Record<string, boolean> | null) ?? {}) as Record<
    string,
    boolean
  >;
  delete empacado[String(index)];

  const hasOutfits = Array.isArray(trip.outfits) && trip.outfits.length > 0;
  await supabase
    .from("trips")
    .update(
      hasOutfits
        ? { overrides, empacado, outfits_stale: true }
        : { overrides, empacado }
    )
    .eq("id", tripId)
    .eq("user_id", user.id);
  revalidatePath(`/viaje/${tripId}`);
}

/** "Prefiero la sugerida": cierra el duelo del hueco y no se vuelve a abrir. */
export async function dismissTripCandidate(tripId: string, index: number): Promise<void> {
  if (!Number.isInteger(index)) return;
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
  const overrides = ((trip.overrides as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;
  overrides[`candNo:${index}`] = true;
  await supabase
    .from("trips")
    .update({ overrides })
    .eq("id", tripId)
    .eq("user_id", user.id);
  revalidatePath(`/viaje/${tripId}`);
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
  const newMatch: CapsuleMatch = { signature: matchSignature(closet), entries };
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
    .select("overrides, empacado, outfits, capsule_target, capsule_match")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return;

  const overrides = ((trip.overrides as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;
  // ¿Qué cubría este hueco ANTES? (sub previo, o lo que dijo el match). Si había
  // algo y eligió otra cosa, es un swap "no me convence" → señal real de rechazo.
  const target = trip.capsule_target as CapsuleTarget | null;
  const match = (trip.capsule_match as CapsuleMatch | null) ?? null;
  let prevBy = typeof overrides[subKey(index)] === "string"
    ? (overrides[subKey(index)] as string)
    : null;
  if (!prevBy && target) {
    // El `by` del match aunque sea "parecido" sin decidir: es la prenda que la
    // usuaria estaba viendo en ese hueco (y por tanto la que rechazó).
    const row = capsuleRows(target, match, overrides as CapsuleOverrides).find(
      (r) => r.index === index
    );
    if (row?.by) prevBy = row.by;
  }

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

  if (prevBy && prevBy !== nombre.trim()) {
    await supabase.from("events").insert({
      user_id: user.id,
      type: "trip_item_swap",
      data: {
        ideal: target?.items?.[index]?.nombre ?? null,
        from: prevBy,
        to: nombre.trim(),
        // Para análisis por viaje (los eventos viejos no lo traen).
        trip_id: tripId,
      },
    });
  }

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

/**
 * "✓ listo — a empacar": cierra la fase de revisión SIN generar looks (flujo
 * del handoff viaje 2: el plan → prendas → empacar → looks — la generación se
 * movió al final de empacar). Antes "confirmado" se derivaba de outfits !==
 * null porque confirmar ERA generar; ahora necesita su propia señal. Vive en
 * overrides como llave plana "confirmado" (OJO: sin prefijo, a diferencia de
 * "sub:"/"cand:" — no asumir que toda llave sin prefijo es índice numérico).
 * Invisible para capsuleRows y cero columnas nuevas; el ÚNICO lector legítimo
 * es tripConfirmado (lib/trip.ts), que también carga el grandfathering de los
 * viajes viejos con outfits.
 */
export async function confirmTripPlan(tripId: string): Promise<void> {
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

  const current = ((trip.overrides as CapsuleOverrides | null) ?? {}) as Record<string, unknown>;
  if (current.confirmado === true) return;
  current.confirmado = true;

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

/**
 * "Empacar todo": palomea de un golpe todos los índices que la maleta enseña.
 *
 * UN SOLO WRITE, no un setTripPacked por prenda: con 15 prendas serían 15
 * requests en ráfaga leyendo-y-escribiendo el MISMO jsonb — la receta exacta
 * de la carrera perdida (el último read viejo pisa los writes de en medio).
 *
 * Solo AGREGA (merge sobre lo que ya está): no toca lo que otra pestaña haya
 * palomeado mientras, y correrlo dos veces da lo mismo que una.
 */
export async function setTripPackedAll(tripId: string, indexes: number[]): Promise<void> {
  const limpios = indexes.filter((i) => Number.isInteger(i));
  if (limpios.length === 0) return;
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
  for (const i of limpios) current[String(i)] = true;

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

// Razón del 👎 a un look de viaje (paralelo al "¿qué no te latió?" del Modo Hoy).
// Se guarda en el propio look (trips.outfits[index].downReason): persiste, sirve
// como señal real y se usará para afinar la regeneración. No re-emite voto — el
// 👎 ya dejó su evento trip_look_vote.
export async function saveTripDownReason(
  tripId: string,
  index: number,
  reason: string
): Promise<void> {
  if (!Number.isInteger(index) || !reason.trim()) return;
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

  outfits[index] = { ...outfits[index], downReason: reason.slice(0, 200) };
  await supabase
    .from("trips")
    .update({ outfits })
    .eq("id", tripId)
    .eq("user_id", user.id);

  revalidatePath(`/viaje/${tripId}`);
}

// Favoritea (o quita) un look del viaje. Favoritear lo PROMUEVE a una fila real en
// outfits (source='viaje', con trip_id + trip_look_index) para que aparezca en el
// Historial con badge "Viaje" — reusando el detalle/voto/"Ponérmelo" del diario.
// Quitar el favorito borra esa fila (entró al historial porque lo favoriteaste).
// La existencia de la fila es la fuente única de verdad del corazón.
export async function favoriteTripLook(
  tripId: string,
  index: number,
  favorite: boolean
): Promise<{ ok: boolean }> {
  if (!Number.isInteger(index) || index < 0) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // Verdad del favorito en TODOS lados = favorited_at no nulo. Quitar (desde el
  // viaje o desde el corazón del Historial) solo lo pone null; el Historial filtra
  // los de viaje por favorited_at, así que desaparece de ahí. No borramos la fila
  // (re-favoritear la reutiliza).
  if (!favorite) {
    await supabase
      .from("outfits")
      .update({ favorited_at: null })
      .eq("user_id", user.id)
      .eq("trip_id", tripId)
      .eq("trip_look_index", index)
      .eq("source", "viaje");
    revalidatePath(`/viaje/${tripId}`);
    return { ok: true };
  }

  // ¿Ya existe la fila (favoriteada antes y quitada)? Solo re-séllala.
  const { data: prevRow } = await supabase
    .from("outfits")
    .select("id")
    .eq("user_id", user.id)
    .eq("trip_id", tripId)
    .eq("trip_look_index", index)
    .eq("source", "viaje")
    .maybeSingle();
  if (prevRow) {
    await supabase
      .from("outfits")
      // Si esa fila la habías borrado del historial, volver a guardarla desde el
      // viaje la revive: si no, quedaría "favorita" aquí e invisible allá.
      .update({ favorited_at: new Date().toISOString(), deleted_at: null })
      .eq("id", prevRow.id as string);
    revalidatePath(`/viaje/${tripId}`);
    return { ok: true };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("outfits")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return { ok: false };
  const outfits = (trip.outfits as TripOutfit[] | null) ?? [];
  const look = outfits[index];
  if (!look) return { ok: false };

  // Resuelve nombre de prenda → id del clóset (best-effort, mismo criterio que el
  // clóset: nombre = arquetipo o attrs.nombre). Lo que no resuelva se omite.
  const { data: items } = await supabase
    .from("items")
    .select("id, attrs, archetypes(name)")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const byName = new Map<string, string>();
  for (const it of items ?? []) {
    const arch = it.archetypes as { name?: string } | null;
    const attrs = (it.attrs ?? {}) as { nombre?: string };
    const name = arch?.name ?? attrs.nombre;
    if (name && !byName.has(name)) byName.set(name, it.id as string);
  }
  const itemIds = look.prendas
    .map((n) => byName.get(n))
    .filter((id): id is string => !!id);

  const explanation = look.tip ? `${look.porque} ${look.tip}` : look.porque;
  const { error } = await supabase.from("outfits").insert({
    user_id: user.id,
    item_ids: itemIds,
    occasion: look.ocasion,
    explanation,
    prompt_version: "viaje-v1",
    title: look.titulo,
    source: "viaje",
    trip_id: tripId,
    trip_look_index: index,
    favorited_at: new Date().toISOString(),
  });
  // Choque con el índice único = ya estaba favoriteado → lo tratamos como ok.
  if (error && !/duplicate|unique/i.test(error.message)) return { ok: false };

  revalidatePath(`/viaje/${tripId}`);
  return { ok: true };
}

/**
 * "Verme con este look" en un look de viaje: asegura su fila en `outfits` sin
 * favoritearlo y devuelve el id, que es lo que el try-on necesita para generar
 * y cachear el render. Antes, probarte un look de viaje exigía marcarlo como
 * favorito, irte al Historial y probártelo allá.
 *
 * Si la fila ya existe pero el look cambió (un "rehacer" regenera trips.outfits
 * y el índice pasa a ser otro look), se reescribe y se tira el try-on viejo —
 * si no, verías el render de un look que ya no existe.
 */
export async function ensureTripLookOutfit(
  tripId: string,
  index: number
): Promise<{ ok: boolean; outfitId?: string }> {
  if (!Number.isInteger(index) || index < 0) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: trip } = await supabase
    .from("trips")
    .select("outfits")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return { ok: false };
  const look = ((trip.outfits as TripOutfit[] | null) ?? [])[index];
  if (!look) return { ok: false };

  const itemIds = await resolveTripItemIds(supabase, user.id, look.prendas);
  if (itemIds.length === 0) return { ok: false };

  const explanation = look.tip ? `${look.porque} ${look.tip}` : look.porque;
  const { data: prev } = await supabase
    .from("outfits")
    .select("id, item_ids")
    .eq("user_id", user.id)
    .eq("trip_id", tripId)
    .eq("trip_look_index", index)
    .eq("source", "viaje")
    .maybeSingle();

  if (prev) {
    const same =
      JSON.stringify([...((prev.item_ids as string[]) ?? [])].sort()) ===
      JSON.stringify([...itemIds].sort());
    if (!same) {
      await supabase
        .from("outfits")
        .update({
          item_ids: itemIds,
          title: look.titulo,
          explanation,
          occasion: look.ocasion,
          tryon_path: null, // el render viejo era de OTRO look
        })
        .eq("id", prev.id as string);
    }
    return { ok: true, outfitId: prev.id as string };
  }

  const { data: inserted, error } = await supabase
    .from("outfits")
    .insert({
      user_id: user.id,
      item_ids: itemIds,
      occasion: look.ocasion,
      explanation,
      prompt_version: "viaje-v1",
      title: look.titulo,
      source: "viaje",
      trip_id: tripId,
      trip_look_index: index,
      favorited_at: null, // solo para el try-on: NO entra al Historial
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false };
  return { ok: true, outfitId: inserted.id as string };
}

// Nombre de prenda → id del clóset (mismo criterio que el resto de la app).
async function resolveTripItemIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  prendas: string[]
): Promise<string[]> {
  const { data: items } = await supabase
    .from("items")
    .select("id, attrs, archetypes(name)")
    .eq("user_id", userId)
    .is("deleted_at", null);
  const byName = new Map<string, string>();
  for (const it of items ?? []) {
    const arch = it.archetypes as { name?: string } | null;
    const attrs = (it.attrs ?? {}) as { nombre?: string };
    const name = arch?.name ?? attrs.nombre;
    if (name && !byName.has(name)) byName.set(name, it.id as string);
  }
  return prendas.map((n) => byName.get(n)).filter((id): id is string => !!id);
}
