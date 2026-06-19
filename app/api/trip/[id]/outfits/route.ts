import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  capsuleRows,
  type CapsuleTarget,
  type CapsuleMatch,
  type CapsuleOverrides,
} from "@/lib/capsule";
import { generateTripOutfits, type PackableItem } from "@/lib/engine/trip-outfits";
import type { Occasion } from "@/lib/trip";

export const maxDuration = 60;

// Modo viaje v1.1: arma los LOOKS del viaje con lo que de verdad empacas (lo que
// tienes + los "parecido" que aceptaste). Aparte de la creación del viaje (una
// sola llamada → cabe en 60s) y DESPUÉS de tus decisiones de empaque, así que
// refleja exactamente lo que llevas. Cachea el resultado en trips.outfits.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  const { data: trip } = await supabase
    .from("trips")
    .select("capsule_target, capsule_match, overrides, ocasiones, weather")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

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
    .select("gender, taste_tags, style_archetype")
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
    });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 500 });
  }

  const { error } = await supabase
    .from("trips")
    .update({ outfits, outfits_stale: false })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });

  return NextResponse.json({ ok: true, count: outfits.length });
}
