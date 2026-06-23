import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodePlace, getWeatherForDates } from "@/lib/weather";
import { generateTripCapsuleTarget } from "@/lib/engine/trip-capsule";
import { matchCapsule } from "@/lib/engine/capsule-match";
import { loadClosetLite } from "@/lib/capsule-data";
import { vetoLabels, type StyleVetoes } from "@/lib/vetoes";
import {
  tripDays,
  OCCASIONS,
  LUGGAGE,
  type Occasion,
  type Luggage,
  type Parada,
  type TripWeather,
} from "@/lib/trip";
import type { Season } from "@/lib/colorimetria";

export const maxDuration = 60;

const VALID_OCC = new Set(OCCASIONS.map((o) => o.value));
const VALID_LUG = new Set(LUGGAGE.map((l) => l.value));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PARADAS = 6;

// Agrega los climas de las paradas a un resumen único (para el header del viaje):
// temperatura promedio, lluvia si cualquier parada llueve, estimado si alguna lo es.
function aggregateWeather(paradas: Parada[]): TripWeather | null {
  const withW = paradas.filter((p) => p.weather);
  if (withW.length === 0) return null;
  const avg = Math.round(
    withW.reduce((s, p) => s + (p.weather as TripWeather).temp_c, 0) / withW.length
  );
  const rainy = withW.some((p) =>
    /lluvia|tormenta|chubasco|llovizna|nieve/.test((p.weather as TripWeather).condition)
  );
  const estimated = withW.some((p) => (p.weather as TripWeather).estimated);
  return {
    temp_c: avg,
    condition: rainy ? "lluvia" : (withW[0].weather as TripWeather).condition,
    ...(estimated ? { estimated: true } : {}),
  };
}

// Modo viaje: arma la cápsula del viaje y la cruza con el clóset. Streaming con
// fases (la generación tarda). Guarda un trip y devuelve su id.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: {
    lugar?: string;
    lugares?: string[];
    segmentos?: { lugar?: string; noches?: number }[];
    fechaInicio?: string;
    fechaFin?: string;
    ocasiones?: string[];
    maleta?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Multidestino: acepta `lugares[]` o cae al `lugar` único (compat). Normaliza,
  // quita vacíos/duplicados y limita a MAX_PARADAS.
  const rawLugares = Array.isArray(body.lugares)
    ? body.lugares
    : body.lugar
      ? [body.lugar]
      : [];
  const lugaresNombres = Array.from(
    new Set(rawLugares.map((l) => String(l ?? "").trim()).filter((l) => l.length > 1))
  ).slice(0, MAX_PARADAS);

  const fechaInicio = body.fechaInicio ?? "";
  const fechaFin = body.fechaFin ?? "";
  if (
    lugaresNombres.length === 0 ||
    !DATE_RE.test(fechaInicio) ||
    !DATE_RE.test(fechaFin) ||
    fechaFin < fechaInicio
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const days = tripDays(fechaInicio, fechaFin);
  if (days > 30) return NextResponse.json({ error: "viaje_largo" }, { status: 400 });

  // Noches por parada (modo "por lugar"): empareja por orden con `lugares`.
  const segNoches =
    Array.isArray(body.segmentos) && body.segmentos.length === lugaresNombres.length
      ? body.segmentos.map((s) =>
          Number.isInteger(s?.noches) && (s!.noches as number) > 0 ? (s!.noches as number) : null
        )
      : null;

  const ocasiones = (body.ocasiones ?? []).filter((o): o is Occasion =>
    VALID_OCC.has(o as Occasion)
  );
  const maleta = VALID_LUG.has(body.maleta as Luggage) ? (body.maleta as Luggage) : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        send({
          phase:
            lugaresNombres.length > 1
              ? `ubicando tus ${lugaresNombres.length} paradas…`
              : "ubicando tu destino…",
        });
        // Geocodifica cada parada y resuelve su clima en el rango del viaje (en
        // paralelo). Una parada que no geocodifica conserva su nombre, sin clima.
        const paradas: Parada[] = await Promise.all(
          lugaresNombres.map(async (nombre, i) => {
            const geo = await geocodePlace(nombre);
            const weather = geo
              ? await getWeatherForDates(geo.lat, geo.lon, fechaInicio, fechaFin)
              : null;
            return {
              lugar: geo?.label ?? nombre,
              lat: geo?.lat ?? null,
              lon: geo?.lon ?? null,
              ...(segNoches && segNoches[i] ? { noches: segNoches[i] as number } : {}),
              weather,
            };
          })
        );
        const aggWeather = aggregateWeather(paradas);
        const lugarDisplay = paradas.map((p) => p.lugar.split(",")[0].trim()).join(" · ");

        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "gender, taste_tags, style_archetype, palette_season, palette_flow, style_vetoes"
          )
          .eq("id", user.id)
          .single();
        const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

        send({ phase: "armando tu cápsula de viaje…" });
        const target = await generateTripCapsuleTarget({
          days,
          ocasiones,
          maleta,
          weather: aggWeather,
          paradas: paradas.map((p) => ({ lugar: p.lugar.split(",")[0].trim(), weather: p.weather ?? null })),
          gender,
          tasteTags: (profile?.taste_tags ?? []) as string[],
          archetype:
            (profile?.style_archetype as { nombre: string; descripcion: string } | null) ??
            null,
          season: (profile?.palette_season as Season | null) ?? null,
          flow: (profile?.palette_flow as Season | null) ?? null,
          vetoes: vetoLabels((profile?.style_vetoes as StyleVetoes | null) ?? null),
        });

        send({ phase: "viendo qué ya tienes…" });
        const closet = await loadClosetLite(supabase, user.id);
        let match = null;
        try {
          match = await matchCapsule(target, closet, gender);
        } catch {
          match = null;
        }

        const { data: inserted, error } = await supabase
          .from("trips")
          .insert({
            user_id: user.id,
            lugar: lugarDisplay,
            lat: paradas[0]?.lat ?? null,
            lon: paradas[0]?.lon ?? null,
            paradas,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            ocasiones,
            maleta,
            weather: aggWeather,
            capsule_target: target,
            capsule_match: match,
          })
          .select("id")
          .single();

        if (error || !inserted) {
          send({ error: "guardar" });
          controller.close();
          return;
        }

        send({ done: true, tripId: inserted.id });
        controller.close();
      } catch {
        send({ error: "generacion" });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
