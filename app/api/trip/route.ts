import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodePlace, getWeatherForDates } from "@/lib/weather";
import { generateTripCapsuleTarget } from "@/lib/engine/trip-capsule";
import { matchCapsule } from "@/lib/engine/capsule-match";
import { loadClosetLite } from "@/lib/capsule-data";
import { vetoLabels, type StyleVetoes } from "@/lib/vetoes";
import { tripDays, OCCASIONS, LUGGAGE, type Occasion, type Luggage } from "@/lib/trip";
import type { Season } from "@/lib/colorimetria";

export const maxDuration = 60;

const VALID_OCC = new Set(OCCASIONS.map((o) => o.value));
const VALID_LUG = new Set(LUGGAGE.map((l) => l.value));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const lugar = (body.lugar ?? "").trim();
  const fechaInicio = body.fechaInicio ?? "";
  const fechaFin = body.fechaFin ?? "";
  if (!lugar || !DATE_RE.test(fechaInicio) || !DATE_RE.test(fechaFin) || fechaFin < fechaInicio) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const days = tripDays(fechaInicio, fechaFin);
  if (days > 30) return NextResponse.json({ error: "viaje_largo" }, { status: 400 });

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
        send({ phase: "ubicando tu destino…" });
        const geo = await geocodePlace(lugar);
        const weather =
          geo !== null
            ? await getWeatherForDates(geo.lat, geo.lon, fechaInicio, fechaFin)
            : null;

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
          weather,
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
            lugar: geo?.label ?? lugar,
            lat: geo?.lat ?? null,
            lon: geo?.lon ?? null,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            ocasiones,
            maleta,
            weather,
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
