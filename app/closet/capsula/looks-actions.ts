"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  capsuleLookKey,
  capsuleRows,
  occasionsFromLifestyle,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleTarget,
} from "@/lib/capsule";
import { matchSignature } from "@/lib/engine/capsule-match";
import { loadClosetLite } from "@/lib/capsule-data";
import {
  generateTripOutfits,
  reviewTripOutfits,
  type PackableItem,
  type TripOutfitInputs,
  type TripWeatherInput,
} from "@/lib/engine/trip-outfits";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import { ageStylingLine, type AgeRange } from "@/lib/edad";
import { vetoLabels, type StyleVetoes } from "@/lib/vetoes";
import { styleReferenceForEngine } from "@/lib/estilo-referencia";
import { loadTasteSignal } from "@/lib/engine/taste-signal";
import type { Occasion, TripOutfit } from "@/lib/trip";

const MAX_LOOKS = 16;
const outfitKey = (o: { prendas: string[] }) => capsuleLookKey(o.prendas);

// Clima del cuestionario → una temperatura representativa para que los looks
// tengan el abrigo/ligereza correctos. El motor también acepta null.
function weatherFromClima(clima: string | undefined): TripWeatherInput | null {
  if (clima === "frio") return { temp_c: 8, condition: "frío", estimated: true };
  if (clima === "templado") return { temp_c: 19, condition: "templado", estimated: true };
  if (clima === "calor") return { temp_c: 28, condition: "cálido", estimated: true };
  return null;
}

// "Ver los looks que tu cápsula arma": genera outfits con las prendas que YA
// TIENES de tu cápsula (los "tienes" del match), con el mismo motor Sudoku del
// viaje. Cachea en profiles.capsule_outfits + firma del clóset.
export async function generateCapsuleOutfits(
  append = false
): Promise<{ ok: boolean; count: number; added: number; motivo?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, count: 0, added: 0 };

  // Perfil y feedback en paralelo (independientes): menos latencia serial antes
  // de la llamada al motor.
  const [{ data: profile, error: profileErr }, tasteSignal] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "capsule_target, capsule_match, capsule_overrides, lifestyle, gender, taste_tags, style_archetype, body_build, body_volume, capsule_outfits, style_vetoes, style_reference, style_words, age_range"
      )
      .eq("id", user.id)
      .single(),
    loadTasteSignal(supabase, user.id),
  ]);
  if (profileErr) console.error(`capsula_looks_profile_select_failed: ${profileErr.message}`);
  const target = profile?.capsule_target as CapsuleTarget | null;
  if (!target) return { ok: false, count: 0, added: 0 };
  const match = (profile?.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = (profile?.capsule_overrides as CapsuleOverrides | null) ?? null;

  const closet = await loadClosetLite(supabase, user.id);
  // Empacable = lo que de verdad TIENES de tu cápsula (cubierto), por el nombre de
  // la prenda del clóset que lo cubre.
  const packable: PackableItem[] = capsuleRows(target, match, overrides)
    .filter((r) => r.covered && !!r.by)
    .map((r, i) => ({
      n: i,
      nombre: r.by as string,
      category: r.item.category,
      color: r.item.colorFamilia,
      formalidad: r.item.formalidad,
    }));

  // OJO: la firma tiene que ser la MISMA que compara la página (matchSignature
  // = versión del prompt + firma del clóset). Cuando aquí se guardaba
  // closetSignature() a secas, nunca coincidía con la de la página y el banner
  // "Cambiaste tu clóset — actualiza tus looks" quedaba pegado para siempre:
  // regenerabas y volvía a salir. Un solo generador de firma, sin excepciones.
  const sig = matchSignature(closet);
  if (packable.length < 2) {
    await supabase
      .from("profiles")
      .update({ capsule_outfits: [], capsule_outfits_sig: sig })
      .eq("id", user.id);
    return { ok: true, count: 0, added: 0 };
  }

  const existing = append ? ((profile?.capsule_outfits as TripOutfit[] | null) ?? []) : [];
  const life = (profile?.lifestyle as Record<string, string> | null) ?? null;

  const genInputs: TripOutfitInputs = {
    packable,
    ocasiones: occasionsFromLifestyle(life) as Occasion[],
    weather: weatherFromClima(life?.clima),
    gender: (profile?.gender as "hombre" | "mujer" | null) ?? null,
    tasteTags: (profile?.taste_tags ?? []) as string[],
    archetype:
      (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
    silueta: siluetaPromptLine(
      (profile?.body_build as Build | null) ?? null,
      (profile?.body_volume as Volume | null) ?? null
    ),
    ageStyling: ageStylingLine((profile?.age_range as AgeRange | null) ?? null),
    exclude: existing.map((o) => o.prendas),
    // v24: los looks de la cápsula también respetan vetos, referencia, sus
    // palabras y el feedback real.
    vetoes: vetoLabels((profile?.style_vetoes as StyleVetoes | null) ?? null),
    styleReference: styleReferenceForEngine(profile?.style_reference),
    styleWords: (profile?.style_words as string | null) ?? null,
    tasteSignal,
  };

  let outfits: TripOutfit[];
  try {
    outfits = await generateTripOutfits(genInputs);
    outfits = (await reviewTripOutfits(genInputs, outfits)).outfits;
  } catch (e) {
    // El motivo SE REGISTRA y VIAJA. Este catch mudo es por qué "No pude armar
    // otros looks" no se pudo diagnosticar leyendo los logs: la única pista era
    // el texto rojo en pantalla. Tercer catch mudo del día en un camino de IA.
    const motivo = e instanceof Error ? e.message : String(e);
    console.error(`[capsula-looks] generateCapsuleOutfits falló — ${motivo}`);
    return { ok: false, count: existing.length, added: 0, motivo: motivo.slice(0, 200) };
  }

  let finalOutfits = outfits;
  let added = outfits.length;
  if (append) {
    const seen = new Set(existing.map(outfitKey));
    const fresh = outfits.filter((o) => !seen.has(outfitKey(o)));
    added = fresh.length;
    finalOutfits = [...existing, ...fresh].slice(0, MAX_LOOKS);
  }

  await supabase
    .from("profiles")
    .update({ capsule_outfits: finalOutfits, capsule_outfits_sig: sig })
    .eq("id", user.id);
  revalidatePath("/closet/capsula");
  return { ok: true, count: finalOutfits.length, added };
}

// ————————————————————————————————————————————————————————————————————————
// Un look de la cápsula como fila real de `outfits`.
//
// Por qué existe: el try-on necesita un outfit id (la API lo busca por id y
// cachea el render en outfits.tryon_path). Hasta ahora lo único que creaba esa
// fila era el corazón, así que para probarte un look tenías que favoritearlo,
// irte al Historial y probártelo allá. Ahora "verme con este look" crea la fila
// en silencio con favorited_at = null: invisible en el Historial (que filtra por
// favorited_at) pero suficiente para el try-on, y el render queda cacheado.
// ————————————————————————————————————————————————————————————————————————

// Resuelve nombre de prenda → id del clóset (mismo criterio que el resto de la
// app: el nombre es el del arquetipo, o attrs.nombre). Lo que no resuelva se
// omite: es best-effort y el try-on ya avisa en logs si le faltan prendas.
async function resolveItemIds(
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

// Crea (o recupera) la fila del look `index`. `favorite`: null = no tocar el
// corazón (solo asegurar la fila, caso try-on); true/false = ponerlo o quitarlo.
async function ensureRow(
  index: number,
  favorite: boolean | null
): Promise<{ ok: boolean; outfitId?: string }> {
  if (!Number.isInteger(index) || index < 0) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_outfits")
    .eq("id", user.id)
    .single();
  const looks = (profile?.capsule_outfits as TripOutfit[] | null) ?? [];
  const look = looks[index];
  if (!look) return { ok: false };

  const key = capsuleLookKey(look.prendas);
  const { data: prev } = await supabase
    .from("outfits")
    .select("id, item_ids")
    .eq("user_id", user.id)
    .eq("source", "capsula")
    .eq("capsule_look_key", key)
    .maybeSingle();

  const stamp = favorite === false ? null : new Date().toISOString();
  const explanation = look.tip ? `${look.porque} ${look.tip}` : look.porque;

  if (prev) {
    const rowId = prev.id as string;
    const update: Record<string, unknown> = { deleted_at: null };
    // El corazón solo se toca si nos lo pidieron: asegurar la fila para el
    // try-on NO debe favoritear el look a escondidas.
    if (favorite !== null) update.favorited_at = stamp;
    await supabase.from("outfits").update(update).eq("id", rowId);
    return { ok: true, outfitId: rowId };
  }

  const itemIds = await resolveItemIds(supabase, user.id, look.prendas);
  if (itemIds.length === 0) return { ok: false };

  const { data: inserted, error } = await supabase
    .from("outfits")
    .insert({
      user_id: user.id,
      item_ids: itemIds,
      occasion: look.ocasion,
      explanation,
      tip: look.tip ?? null,
      prompt_version: "capsula-v1",
      title: look.titulo,
      source: "capsula",
      capsule_look_key: key,
      // favorite === null (solo try-on) → la fila NO entra al Historial.
      favorited_at: favorite === true ? stamp : null,
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false };
  return { ok: true, outfitId: inserted.id as string };
}

/** "Verme con este look": asegura la fila (sin favoritear) y devuelve su id. */
export async function ensureCapsuleLookOutfit(
  index: number
): Promise<{ ok: boolean; outfitId?: string }> {
  return ensureRow(index, null);
}

/** Corazón: promueve el look al Historial (o lo saca sin borrar la fila). */
export async function favoriteCapsuleLook(
  index: number,
  favorite: boolean
): Promise<{ ok: boolean }> {
  const res = await ensureRow(index, favorite);
  revalidatePath("/closet/capsula");
  revalidatePath("/historial");
  return { ok: res.ok };
}

/**
 * Voto 👍/👎. Se guarda en el look (para que el botón siga marcado) Y como
 * evento vote_up/vote_down CON outfit_id — que es lo que lee loadTasteSignal.
 * Por eso vota contra una fila real: así el feedback de la cápsula por fin llega
 * al motor, a diferencia del 'trip_look_vote' del viaje, que nunca llegó.
 */
export async function setCapsuleLookVote(
  index: number,
  up: boolean
): Promise<{ ok: boolean }> {
  if (!Number.isInteger(index) || index < 0) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_outfits")
    .eq("id", user.id)
    .single();
  const looks = (profile?.capsule_outfits as TripOutfit[] | null) ?? [];
  if (index >= looks.length) return { ok: false };

  const next = up ? "up" : "down";
  const voto = looks[index].voto === next ? null : next; // doble tap = quitar
  looks[index] = { ...looks[index], voto };
  await supabase
    .from("profiles")
    .update({ capsule_outfits: looks })
    .eq("id", user.id);

  if (voto) {
    const { outfitId } = await ensureRow(index, null);
    await supabase.from("events").insert({
      user_id: user.id,
      type: voto === "up" ? "vote_up" : "vote_down",
      outfit_id: outfitId ?? null,
      data: { origen: "capsula", ocasion: looks[index].ocasion },
    });
  }
  revalidatePath("/closet/capsula");
  return { ok: true };
}

/** Razón del 👎 (pills del DownReason). Calibra al juez con datos reales. */
export async function saveCapsuleLookDownReason(
  index: number,
  reason: string
): Promise<void> {
  if (!Number.isInteger(index) || index < 0 || !reason.trim()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_outfits")
    .eq("id", user.id)
    .single();
  const looks = (profile?.capsule_outfits as TripOutfit[] | null) ?? [];
  if (index >= looks.length) return;

  looks[index] = { ...looks[index], downReason: reason.slice(0, 200) };
  await supabase
    .from("profiles")
    .update({ capsule_outfits: looks })
    .eq("id", user.id);
  revalidatePath("/closet/capsula");
}
