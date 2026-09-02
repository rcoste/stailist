import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTripCapsuleTarget, type TripAncla } from "@/lib/engine/trip-capsule";
import { matchCapsule } from "@/lib/engine/capsule-match";
import { loadClosetLite } from "@/lib/capsule-data";
import { vetoLabels, type StyleVetoes } from "@/lib/vetoes";
import { styleReferenceForEngine } from "@/lib/estilo-referencia";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import { ageStylingLine, type AgeRange } from "@/lib/edad";
import { loadTasteSignal } from "@/lib/engine/taste-signal";
import { CATEGORIES, FORMALIDADES, type CapsuleItem, type Category, type Formalidad, type MatchEntry } from "@/lib/capsule";
import {
  tripDays,
  OCCASIONS,
  LUGGAGE,
  dominantLuggage,
  capsuleFloor,
  capsuleFloorGaps,
  luggageCapacity,
  type Bolsas,
  type Occasion,
  type Luggage,
  type Parada,
} from "@/lib/trip";
import {
  TRIP_DATE_RE,
  MAX_TRIP_DAYS,
  normalizarRuta,
  resolverParadas,
  aggregateWeather,
  lugarDisplay,
} from "@/lib/trip-ruta";
import type { Season } from "@/lib/colorimetria";
import { revisarGasto } from "@/lib/cuotas";

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
// La validación de fechas y la resolución de paradas (geocode + clima) viven
// en lib/trip-ruta, compartidas con PATCH /api/trip/[id]/ruta.

// Modo viaje: arma la cápsula del viaje y la cruza con el clóset. Streaming con
// fases (la generación tarda). Guarda un trip y devuelve su id.
export async function POST(request: NextRequest) {
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
    editId?: string; // rehacer la maleta de un viaje EXISTENTE (editar ruta y fechas)
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Multidestino: acepta `lugares[]` o cae al `lugar` único (compat). La
  // normalización va EN PARES con los segmentos (ver lib/trip-ruta).
  const { lugares: lugaresNombres, segNoches } = normalizarRuta(
    Array.isArray(body.lugares) ? body.lugares : body.lugar ? [body.lugar] : [],
    body.segmentos
  );

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
  const days = tripDays(fechaInicio, fechaFin);
  if (days > MAX_TRIP_DAYS) return NextResponse.json({ error: "viaje_largo" }, { status: 400 });

  // Rehacer un viaje existente ("editar ruta y fechas" → "rehaz mi maleta"):
  // misma generación, pero el resultado ACTUALIZA su fila — el id, los looks
  // guardados en el diario y el link no cambian. La propiedad se verifica aquí,
  // antes de pagar geocoding + IA.
  const editId = typeof body.editId === "string" && body.editId.length > 0 ? body.editId : null;
  // Las paradas ya resueltas del viaje que se rehace: los nombres sin cambios
  // reusan sus coordenadas (igual que el PATCH) — menos round-trips al
  // geocoder y cero riesgo de perder coords si un label no re-resuelve.
  let previas: Parada[] = [];
  if (editId) {
    const { data: existing } = await supabase
      .from("trips")
      .select("id, paradas")
      .eq("id", editId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
    previas = Array.isArray(existing.paradas) ? (existing.paradas as Parada[]) : [];
  }

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
        const paradas: Parada[] = await resolverParadas(
          lugaresNombres,
          segNoches,
          fechaInicio,
          fechaFin,
          previas
        );
        const aggWeather = aggregateWeather(paradas);
        const lugar = lugarDisplay(paradas);

        // Perfil y feedback en paralelo (ambos solo dependen de user.id): evita
        // sumar round-trips en serie a una ruta que ya corre contra los 60s.
        const [{ data: profile, error: profileErr }, tasteSignal] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "gender, taste_tags, style_archetype, palette_season, palette_flow, style_vetoes, style_reference, style_words, body_build, body_volume, age_range"
            )
            .eq("id", user.id)
            .single(),
          // v24: el feedback real también orienta qué se empaca (señal suave).
          loadTasteSignal(supabase, user.id),
        ]);
        // Sin perfil la generación degrada en silencio (género neutro, sin vetos,
        // sin paleta) — que al menos quede ruido en los logs.
        if (profileErr) console.error(`trip_profile_select_failed: ${profileErr.message}`);
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

        // Memoria de rechazos: prendas que la persona ya cambió con "no me convence"
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

        send({ phase: "armando tu maleta…" });
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
          styleReference: styleReferenceForEngine(profile?.style_reference),
          styleWords: (profile?.style_words as string | null) ?? null,
          silueta: siluetaPromptLine(
            (profile?.body_build as Build | null) ?? null,
            (profile?.body_volume as Volume | null) ?? null
          ),
          ageStyling: ageStylingLine((profile?.age_range as AgeRange | null) ?? null),
          tasteSignal,
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

        // Instrumentación del piso de suficiencia (v24): si el motor quedó
        // debajo del piso pese a la regla dura, que quede en los logs — es la
        // señal para endurecer el prompt o agregar retry.
        const gaps = capsuleFloorGaps(
          target.items,
          capsuleFloor(days, ocasiones, luggageCapacity(bolsas, maleta))
        );
        if (gaps.length > 0) {
          console.warn(`trip_capsule_underfloor user=${user.id} gaps=${gaps.join(",")}`);
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

        const fila = {
          lugar,
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
        };

        if (editId) {
          // Rehacer: la maleta nueva reemplaza TODO lo derivado de la vieja —
          // decisiones de duelo, cheques de empacado y looks pertenecen a una
          // cápsula que ya no existe. La fila conserva su id.
          //
          // PRIMERO se desvinculan las filas de `outfits` del viaje (corazones,
          // try-ons): se enlazan a los looks POR ÍNDICE (trip_look_index) y con
          // la maleta rehecha el look nuevo en el índice N heredaría el corazón
          // de un look de otra cápsula (red team del ship). El orden importa:
          // si esto falla, se aborta con el viaje viejo intacto — al revés, un
          // fallo del unlink dejaba el sangrado que dice prevenir. El look
          // favorito sobrevive en el diario con su propio snapshot.
          const { error: unlinkError } = await supabase
            .from("outfits")
            .update({ trip_look_index: null })
            .eq("trip_id", editId)
            .eq("user_id", user.id)
            .eq("source", "viaje");
          if (unlinkError) {
            send({ error: "guardar" });
            controller.close();
            return;
          }
          const { error } = await supabase
            .from("trips")
            .update({
              ...fila,
              overrides: {},
              empacado: {},
              outfits: null,
              outfits_stale: false,
            })
            .eq("id", editId)
            .eq("user_id", user.id);
          if (error) {
            send({ error: "guardar" });
            controller.close();
            return;
          }
          send({ done: true, tripId: editId });
          controller.close();
          return;
        }

        const { data: inserted, error } = await supabase
          .from("trips")
          .insert({ user_id: user.id, ...fila })
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
