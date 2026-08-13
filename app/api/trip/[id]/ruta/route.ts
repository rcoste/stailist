import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tripDays, type Parada } from "@/lib/trip";
import {
  TRIP_DATE_RE,
  MAX_TRIP_DAYS,
  normalizarRuta,
  resolverParadas,
  aggregateWeather,
  lugarDisplay,
} from "@/lib/trip-ruta";

export const maxDuration = 60;

// "Editar ruta y fechas" SIN rehacer la maleta (menú "···" del handoff viaje
// 2): actualiza lugar/paradas/fechas/clima y respeta la cápsula, las
// decisiones de duelo y el empacado. Si hay looks generados los marca viejos
// (outfits_stale) — salieron de otro clima y otras fechas, que la persona
// decida si los regenera. Rehacer la maleta completa es el OTRO camino: POST
// /api/trip con editId.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: {
    lugares?: string[];
    segmentos?: { lugar?: string; noches?: number }[];
    fechaInicio?: string;
    fechaFin?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { lugares: lugaresNombres, segNoches } = normalizarRuta(body.lugares, body.segmentos);
  const fechaInicio = body.fechaInicio ?? "";
  const fechaFin = body.fechaFin ?? "";
  if (
    lugaresNombres.length === 0 ||
    !TRIP_DATE_RE.test(fechaInicio) ||
    !TRIP_DATE_RE.test(fechaFin) ||
    fechaFin < fechaInicio
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (tripDays(fechaInicio, fechaFin) > MAX_TRIP_DAYS) {
    return NextResponse.json({ error: "viaje_largo" }, { status: 400 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id, outfits, paradas")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Las paradas ya resueltas del viaje: lo que no cambió de nombre reusa sus
  // coordenadas (sin re-geocodificar, sin riesgo de pisarlas con null si
  // Open-Meteo parpadea); el clima sí se resuelve de nuevo por las fechas.
  const previas = Array.isArray(trip.paradas) ? (trip.paradas as Parada[]) : [];
  const paradas: Parada[] = await resolverParadas(
    lugaresNombres,
    segNoches,
    fechaInicio,
    fechaFin,
    previas
  );
  const hasOutfits = Array.isArray(trip.outfits) && (trip.outfits as unknown[]).length > 0;

  const { error } = await supabase
    .from("trips")
    .update({
      lugar: lugarDisplay(paradas),
      lat: paradas[0]?.lat ?? null,
      lon: paradas[0]?.lon ?? null,
      paradas,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      weather: aggregateWeather(paradas),
      ...(hasOutfits ? { outfits_stale: true } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
