import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodePlace, getWeatherForDates } from "@/lib/weather";
import { generateTripCapsuleTarget, type TripAncla } from "@/lib/engine/trip-capsule";
import { matchCapsule } from "@/lib/engine/capsule-match";
import { loadClosetLite } from "@/lib/capsule-data";
import { vetoLabels, type StyleVetoes } from "@/lib/vetoes";
import { CATEGORIES, FORMALIDADES, type CapsuleItem, type Category, type Formalidad, type MatchEntry } from "@/lib/capsule";
import {
  tripDays,
  OCCASIONS,
  LUGGAGE,
  dominantLuggage,
  type Bolsas,
  type Occasion,
  type Luggage,
  type Parada,
  type TripWeather,
} from "@/lib/trip";
import type { Season } from "@/lib/colorimetria";

export const maxDuration = 60;

const VALID_OCC = new Set(OCCASIONS.map((o) => o.value));
const VALID_LUG = new Set(LUGGAGE.map((l) => l.value));

// Limpia el `bolsas` del body: solo tipos válidos, enteros 0..4 (tope sano).
// Devuelve null si no hay ninguna bolsa (cae al maleta legacy en el caller).
function parseBolsas(raw: unknown): Bolsas | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const out: Bolsas = {};
  let any = false;
  for (const l of LUGGAGE) {
    const v = obj[l.value];
    const n = typeof v === "number" && Number.isInteger(v) ? Math.max(0, Math.min(v, 4)) : 0;
    if (n > 0) {
      out[l.value] = n;
      any = true;
    }
  }
  return any ? out : null;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PARADAS = 6;

// Agrega los climas de las paradas a un resumen único (para el header del viaje):
// temperatura promedio; precipitación SOLO si domina (más de la mitad de las
// ciudades), distinguiendo nieve de lluvia; estimado si alguna parada lo es.
function aggregateWeather(paradas: Parada[]): TripWeather | null {
  const withW = paradas.filter((p) => p.weather);
  if (withW.length === 0) return null;
  const avg = Math.round(
    withW.reduce((s, p) => s + (p.weather as TripWeather).temp_c, 0) / withW.length
  );
  const conds = withW.map((p) => (p.weather as TripWeather).condition);
  const snowN = conds.filter((c) => /nieve/.test(c)).length;
  const rainN = conds.filter((c) => /lluvia|tormenta|chubasco|llovizna/.test(c)).length;
  const estimated = withW.some((p) => (p.weather as TripWeather).estimated);
  // Solo precipitación dominante (mayoría de ciudades) marca el viaje.
  const condition =
    snowN + rainN > withW.length / 2 ? (snowN >= rainN ? "nieve" : "lluvia") : conds[0];
  return {
    temp_c: avg,
    condition,
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
    maleta?: string; // legacy (cliente viejo single-select)
    bolsas?: Record<string, unknown>; // multi-maleta: cantidades por tipo
    anclas?: unknown; // ids de prendas que quiere llevar sí o sí (máx 4)
    contexto?: string; // texto libre: qué va a hacer en el viaje (afina cápsula + looks)
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
  // Multi-maleta: cantidades por tipo (modelo aerolínea). `maleta` (texto) se
  // conserva como la bolsa dominante para back-compat; si un cliente viejo manda
  // solo `maleta`, se deriva `bolsas` = 1 de ese tipo.
  const maletaLegacy = VALID_LUG.has(body.maleta as Luggage) ? (body.maleta as Luggage) : null;
  const bolsas: Bolsas | null = parseBolsas(body.bolsas) ?? (maletaLegacy ? { [maletaLegacy]: 1 } : null);
  const maleta = dominantLuggage(bolsas) ?? maletaLegacy;

  // Contexto libre: qué va a hacer en el viaje (un partido, una boda, hiking…).
  // Afina la cápsula y los looks. Tope de 200 chars (igual que el plan de Hoy).
  const contexto =
    typeof body.contexto === "string" && body.contexto.trim()
      ? body.contexto.trim().slice(0, 200)
      : null;

  // Anclas: ids de prendas que la persona quiere llevar sí o sí (máx 4).
  const anclaIds = Array.isArray(body.anclas)
    ? Array.from(
        new Set(body.anclas.filter((x): x is string => typeof x === "string" && x.length > 0))
      ).slice(0, 4)
    : [];

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

        // Resuelve las anclas contra el clóset real (propiedad + no borradas).
        let anclas: TripAncla[] = [];
        if (anclaIds.length > 0) {
          const { data: anclaRows } = await supabase
            .from("items")
            .select("id, attrs, archetypes(name, category)")
            .in("id", anclaIds)
            .eq("user_id", user.id)
            .is("deleted_at", null);
          anclas = (anclaRows ?? []).map((r) => {
            const arch = r.archetypes as { name?: string; category?: string } | null;
            const a = (r.attrs ?? {}) as {
              nombre?: string;
              tipo?: string;
              categoria?: string;
              color?: string;
              formalidad?: string;
              temporada?: string;
            };
            return {
              nombre: arch?.name ?? a.nombre ?? "Prenda",
              tipo: a.tipo ?? null,
              category: arch?.category ?? a.categoria ?? null,
              color: a.color ?? null,
              formalidad: a.formalidad ?? null,
              temporada: a.temporada ?? null,
            };
          });
        }

        // Memoria de rechazos: prendas que la persona ya cambió con "no me late"
        // en maletas anteriores (eventos trip_item_swap). El motor evita armar
        // ideales para ellas y el match las usa como último recurso. Sin esto,
        // cada maleta nueva re-proponía la misma prenda rechazada (bug real,
        // 2026-07-15). Máx 8 recientes para no inflar el prompt.
        let rechazadas: string[] = [];
        try {
          const { data: swapRows } = await supabase
            .from("events")
            .select("data")
            .eq("user_id", user.id)
            .eq("type", "trip_item_swap")
            .order("created_at", { ascending: false })
            .limit(30);
          const anclaSet = new Set(anclas.map((a) => a.nombre.toLowerCase()));
          rechazadas = Array.from(
            new Set(
              (swapRows ?? [])
                .map((r) => ((r.data as { from?: string } | null)?.from ?? "").trim())
                .filter((n) => n.length > 0)
                // Un ancla gana sobre un rechazo viejo: si hoy la pidió, no es rechazada.
                .filter((n) => !anclaSet.has(n.toLowerCase()))
            )
          ).slice(0, 8);
        } catch {
          rechazadas = [];
        }

        send({ phase: "armando tu cápsula de viaje…" });
        const target = await generateTripCapsuleTarget({
          days,
          ocasiones,
          maleta,
          bolsas,
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
          anclas,
          rechazadas,
          contexto,
        });

        // Las anclas entran al target COMO ITEMS deterministas (el motor recibió
        // la instrucción de NO listarlas — aquí van al frente, y por si acaso se
        // dedupe cualquier eco suyo en la lista del motor).
        if (anclas.length > 0) {
          const anclaNames = new Set(anclas.map((a) => a.nombre.toLowerCase()));
          const anclaItems: CapsuleItem[] = anclas.map((a) => ({
            nombre: a.nombre,
            tipo:
              a.tipo ??
              a.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-").slice(0, 28),
            category: (CATEGORIES as readonly string[]).includes(a.category ?? "")
              ? (a.category as Category)
              : "top",
            colorFamilia: a.color ?? "neutro",
            formalidad: (FORMALIDADES as readonly string[]).includes(a.formalidad ?? "")
              ? (a.formalidad as Formalidad)
              : "casual",
            temporada: a.temporada ?? "todo-el-año",
            prioridad: 1,
            porque: "Va porque tú la pediste — armé el resto para combinar con ella.",
          }));
          target.items = [
            ...anclaItems,
            ...target.items.filter((it) => !anclaNames.has(it.nombre.toLowerCase())),
          ];
        }

        send({ phase: "viendo qué ya tienes…" });
        const closet = await loadClosetLite(supabase, user.id);
        let match = null;
        try {
          match = await matchCapsule(target, closet, gender, rechazadas);
        } catch {
          match = null;
        }
        // Garantía: las anclas SON del clóset → siempre "tienes" (aunque el
        // matcher tropiece). Van al frente del target, índices 0..n-1.
        if (match && anclas.length > 0) {
          const entries = match.entries as MatchEntry[];
          anclas.forEach((a, i) => {
            entries[i] = { status: "tienes", by: a.nombre };
          });
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
            bolsas,
            contexto,
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
