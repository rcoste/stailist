import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  capsuleRows,
  type CapsuleTarget,
  type CapsuleMatch,
  type CapsuleOverrides,
} from "@/lib/capsule";
import {
  generateTripOutfits,
  reviewTripOutfits,
  type PackableItem,
  type TripOutfitInputs,
  type TripWeatherInput,
} from "@/lib/engine/trip-outfits";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import { ageStylingLine, type AgeRange } from "@/lib/edad";
import { enrichPackable, type RealAttrs } from "@/lib/engine/enrich-packable";
import { vetoLabels, type StyleVetoes } from "@/lib/vetoes";
import { styleReferenceForEngine } from "@/lib/estilo-referencia";
import { loadTasteSignal } from "@/lib/engine/taste-signal";
import type { Season } from "@/lib/colorimetria";
import type { Occasion, TripOutfit } from "@/lib/trip";
import { revisarGasto } from "@/lib/cuotas";

export const maxDuration = 60;

// Modo viaje v1.1: arma los LOOKS del viaje con lo que de verdad empacas (lo que
// tienes + los "parecido" que aceptaste). Aparte de la creación del viaje (una
// sola llamada → cabe en 60s) y DESPUÉS de tus decisiones de empaque, así que
// refleja exactamente lo que llevas. Cachea el resultado en trips.outfits.
// Tope de looks guardados por viaje (al acumular con "Generar más").
const MAX_TRIP_LOOKS = 16;
const outfitKey = (o: { prendas: string[] }) => [...o.prendas].sort().join("|");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // append = "Generar más": acumula sobre los looks actuales (no reemplaza).
  let append = false;
  try {
    const body = await request.json();
    append = body?.append === true;
  } catch {
    // sin body = generación normal (reemplaza)
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Sin cuota propia: sólo el interruptor y el tope de gasto (lib/cuotas.ts).
  const gasto = await revisarGasto(supabase, user.id);
  if (!gasto.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: gasto.motivo, mensaje: gasto.mensaje },
      { status: 429 }
    );
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("capsule_target, capsule_match, overrides, ocasiones, weather, outfits, paradas, contexto")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const allCurrent = (trip.outfits as TripOutfit[] | null) ?? [];
  const existing = append ? allCurrent : [];
  // Los looks que rechazaste (👎) NO se regeneran: en "rehacer" se excluyen
  // explícitamente (el set se reemplaza), y en "generar más" ya van dentro de
  // existing. Así el feedback negativo cierra el loop — no te devuelve lo mismo.
  const rejected = allCurrent.filter((o) => o.voto === "down");

  const target = trip.capsule_target as CapsuleTarget | null;
  const match = (trip.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = (trip.overrides as CapsuleOverrides | null) ?? null;
  if (!target) return NextResponse.json({ error: "sin_capsula" }, { status: 400 });

  // Empacable = lo que de verdad tienes en la maleta para combinar: "tienes",
  // sustitutos, Y los "parecido" (ropa real tuya que la app encontró cercana —
  // si está en tu maleta, debe contar para los looks aunque no la hayas
  // "aceptado" formalmente). Solo se excluye lo realmente faltante (effective
  // "falta") y lo pendiente sin match. Cada pieza se referencia por el NOMBRE de
  // la prenda del clóset que la cubre.
  const packable: PackableItem[] = capsuleRows(target, match, overrides)
    .filter((r) => (r.covered || r.effective === "parecido") && !!r.by)
    .map((r, i) => ({
      n: i,
      nombre: r.by ?? r.item.nombre,
      category: r.item.category,
      color: r.item.colorFamilia,
      formalidad: r.item.formalidad,
    }));

  if (packable.length < 2) {
    await supabase
      .from("trips")
      .update({ outfits: [], outfits_stale: false })
      .eq("id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true, count: 0, reason: "pocas_prendas" });
  }

  const [{ data: profile, error: profileErr }, { data: closetItems }, tasteSignal] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "gender, taste_tags, style_archetype, body_build, body_volume, palette_season, palette_flow, style_vetoes, style_reference, style_words, age_range"
      )
      .eq("id", user.id)
      .single(),
    supabase.from("items").select("attrs").eq("user_id", user.id).is("deleted_at", null),
    loadTasteSignal(supabase, user.id),
  ]);
  // Sin perfil los looks degradan en silencio (sin vetos ni paleta) — logea.
  if (profileErr) console.error(`trip_outfits_profile_select_failed: ${profileErr.message}`);

  // Enriquece lo empacable con la prenda REAL del clóset (resuelta por nombre):
  // color/hex/temporada/material/patrón de TU prenda, no el colorFamilia de la
  // prenda ideal (tu blazer real puede ser negro aunque el ideal era marino).
  // Tolerante: si el nombre no resuelve (o es ambiguo), la pieza queda como
  // estaba. Lógica pura en lib/engine/enrich-packable (testeada).
  enrichPackable(
    packable,
    (closetItems ?? []).map((it) => (it.attrs ?? {}) as RealAttrs)
  );

  // Clima para el motor: enriquece el resumen del viaje con el RANGO de
  // temperaturas entre paradas (cada parada trae su clima). Un viaje Tokio 9° /
  // Seúl 1° debe empacar para la MÁS FRÍA, no para el promedio (que sub-abrigaba
  // la ciudad fría).
  const weatherInput = tripWeatherWithRange(
    trip.weather as TripWeatherInput | null,
    trip.paradas
  );

  const genInputs: TripOutfitInputs = {
    packable,
    ocasiones: (trip.ocasiones as Occasion[]) ?? [],
    weather: weatherInput,
    gender: (profile?.gender as "hombre" | "mujer" | null) ?? null,
    tasteTags: (profile?.taste_tags ?? []) as string[],
    archetype:
      (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
    silueta: siluetaPromptLine(
      (profile?.body_build as Build | null) ?? null,
      (profile?.body_volume as Volume | null) ?? null
    ),
    ageStyling: ageStylingLine((profile?.age_range as AgeRange | null) ?? null),
    season: (profile?.palette_season as Season | null) ?? null,
    flow: (profile?.palette_flow as Season | null) ?? null,
    // "Generar más": evita repetir los looks que ya existen. "Rehacer": evita
    // los que rechazaste (👎). En ambos casos pasamos sus prendas como exclusión.
    exclude: (append ? existing : rejected).map((o) => o.prendas),
    // slice defensivo: el tope de 200 vive en el write path, no en la DB.
    contexto: ((trip.contexto as string | null) ?? null)?.slice(0, 200) ?? null,
    // v24: los looks del viaje ahora respetan vetos, referencia, sus palabras
    // y el feedback real (antes viaje generaba a ciegas de estas señales).
    vetoes: vetoLabels((profile?.style_vetoes as StyleVetoes | null) ?? null),
    styleReference: styleReferenceForEngine(profile?.style_reference),
    styleWords: (profile?.style_words as string | null) ?? null,
    tasteSignal,
  };

  let outfits;
  try {
    outfits = await generateTripOutfits(genInputs);
    // 2ª pasada (juez): repara los looks sub-abrigados para el frío y descarta
    // los que no combinan. Best-effort: si el juez falla, deja los looks tal cual.
    outfits = (await reviewTripOutfits(genInputs, outfits)).outfits;
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 500 });
  }

  // Append: conserva los existentes y suma SOLO los nuevos (dedup por prendas),
  // con tope. Si no hay nuevos, no cambia nada (added = 0 → el cliente avisa).
  let finalOutfits = outfits;
  let added = outfits.length;
  if (append) {
    const seen = new Set(existing.map(outfitKey));
    const fresh = outfits.filter((o) => !seen.has(outfitKey(o)));
    added = fresh.length;
    finalOutfits = [...existing, ...fresh].slice(0, MAX_TRIP_LOOKS) as typeof outfits;
  }

  const { error } = await supabase
    .from("trips")
    .update({ outfits: finalOutfits, outfits_stale: false })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });

  return NextResponse.json({ ok: true, count: finalOutfits.length, added });
}

// Enriquece el clima del viaje con el rango entre paradas (cada parada trae su
// propio clima). Devuelve la temp más fría/cálida y la ciudad más fría para que
// el motor empaque para la más fría en viajes multi-destino. Sin ≥2 paradas con
// clima o sin spread relevante, devuelve el resumen tal cual.
function tripWeatherWithRange(
  base: TripWeatherInput | null,
  paradas: unknown
): TripWeatherInput | null {
  if (!base) return base;
  const arr = Array.isArray(paradas)
    ? (paradas as { lugar?: string; weather?: { temp_c?: number } | null }[])
    : [];
  const temps = arr
    .map((p) => ({ lugar: p.lugar, t: p.weather?.temp_c }))
    .filter((x): x is { lugar: string | undefined; t: number } => typeof x.t === "number");
  if (temps.length < 2) return base;
  const sorted = [...temps].sort((a, b) => a.t - b.t);
  const min = sorted[0].t;
  const max = sorted[sorted.length - 1].t;
  if (max - min < 4) return base; // sin spread relevante, el resumen basta
  return {
    ...base,
    temp_min: min,
    temp_max: max,
    coldest: sorted[0].lugar?.split(",")[0]?.trim(),
  };
}
