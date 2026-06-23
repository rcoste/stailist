import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  capsuleRows,
  type CapsuleTarget,
  type CapsuleMatch,
  type CapsuleOverrides,
} from "@/lib/capsule";
import { generateTripOutfits, type PackableItem } from "@/lib/engine/trip-outfits";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import type { Occasion } from "@/lib/trip";

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

  const { data: trip } = await supabase
    .from("trips")
    .select("capsule_target, capsule_match, overrides, ocasiones, weather, outfits")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = append
    ? ((trip.outfits as { prendas: string[] }[] | null) ?? [])
    : [];

  const target = trip.capsule_target as CapsuleTarget | null;
  const match = (trip.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = (trip.overrides as CapsuleOverrides | null) ?? null;
  if (!target) return NextResponse.json({ error: "sin_capsula" }, { status: 400 });

  // Empacable = lo que cuenta como cubierto (tienes + parecido aceptado). Cada
  // pieza se referencia por NOMBRE de la prenda del clóset que la cubre.
  const packable: PackableItem[] = capsuleRows(target, match, overrides)
    .filter((r) => r.covered)
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender, taste_tags, style_archetype, body_build, body_volume")
    .eq("id", user.id)
    .single();

  let outfits;
  try {
    outfits = await generateTripOutfits({
      packable,
      ocasiones: (trip.ocasiones as Occasion[]) ?? [],
      weather: trip.weather as { temp_c: number; condition: string; estimated?: boolean } | null,
      gender: (profile?.gender as "hombre" | "mujer" | null) ?? null,
      tasteTags: (profile?.taste_tags ?? []) as string[],
      archetype:
        (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
      silueta: siluetaPromptLine(
        (profile?.body_build as Build | null) ?? null,
        (profile?.body_volume as Volume | null) ?? null
      ),
      // "Generar más": evita repetir los looks que ya existen.
      exclude: existing.map((o) => o.prendas),
    });
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
