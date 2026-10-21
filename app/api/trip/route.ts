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
  type CambioDeRopa,
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
import { quizMetalDe, type Season } from "@/lib/colorimetria";
import type { ApetitoAcentos } from "@/lib/looks";
import { revisarGasto } from "@/lib/cuotas";
import { registrarEvento } from "@/lib/telemetria";
import { tokenValido } from "@/lib/viaje-invitacion";
import { cargarRechazadas } from "@/lib/trip-recalcular";

// 300 s, no 60 (2026-10-14). La ruta vivía al filo: ~12 s de preparar
// (paradas, clima, perfil), la cápsula de la IA (mediana 36 s, máx 48 s
// medidos) y el match contra el clóset (6-9 s): ~54 s de mediana. Ese día
// Vercel la cortó a los 60 s justo al terminar la cápsula, antes del insert,
// y el viaje no se guardó ("No pude armar tu maleta"). Vercel permite 300 s en
// todos los planes; sólo se paga el tiempo que de verdad corre.
export const maxDuration = 300;

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
    invitacion?: string; // llegó por el link de otra persona (lib/viaje-invitacion.ts)
    cambioRopa?: string; // "repito" | "seguido": cómo es con la ropa (se guarda en su perfil)
    lavar?: boolean; // si va a poder lavar (sólo se pregunta cuando no cabe una base por día)
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
  let lavadoPrevio: boolean | null = null;
  if (editId) {
    const { data: existing } = await supabase
      .from("trips")
      .select("id, paradas, lavado")
      .eq("id", editId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
    previas = Array.isArray(existing.paradas) ? (existing.paradas as Parada[]) : [];
    lavadoPrevio = typeof existing.lavado === "boolean" ? existing.lavado : null;
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

  // Cuántas prendas base (2026-10-21, lib/trip.ts capsuleFloor): lo que contestó
  // en la maleta. Un valor raro se ignora; "no contestó" queda como null.
  const cambioRopaBody: CambioDeRopa | null =
    body.cambioRopa === "repito" || body.cambioRopa === "seguido" ? body.cambioRopa : null;
  // Rehacer desde "editar ruta y fechas" no pasa por la pregunta: se queda lo que dijo.
  const lavar = typeof body.lavar === "boolean" ? body.lavar : lavadoPrevio;

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
              "gender, taste_tags, style_archetype, palette_season, palette_flow, palette_quiz, style_vetoes, style_reference, style_words, body_build, body_volume, age_range, acento_apetito, acento_apetito_fuente, fit_pref, cambio_ropa"
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
        // Lo que contestó hoy gana y se guarda (se pregunta una sola vez); si
        // no contestó, lo de su perfil.
        const cambioRopa: CambioDeRopa | null =
          cambioRopaBody ?? ((profile?.cambio_ropa as CambioDeRopa | null) ?? null);
        if (cambioRopaBody && cambioRopaBody !== profile?.cambio_ropa) {
          const { error: ropaErr } = await supabase.from("profiles").update({ cambio_ropa: cambioRopaBody }).eq("id", user.id);
          if (ropaErr) console.error(`trip_cambio_ropa_update_failed: ${ropaErr.message}`);
        }

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
        const rechazadas = await cargarRechazadas(
          supabase,
          user.id,
          new Set(anclas.map((a) => a.nombre.toLowerCase()))
        );

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
          metalQuiz: quizMetalDe(profile?.palette_quiz),
          // Sólo si lo ELIGIÓ: la semilla de los swipes no es su gusto (mismo
          // criterio que la cápsula del clóset, app/closet/capsula/actions.ts).
          acentoApetito:
            profile?.acento_apetito_fuente === "elegido"
              ? ((profile?.acento_apetito as ApetitoAcentos | null) ?? null)
              : null,
          fitPref: (profile?.fit_pref as "recta" | "holgada" | "mixta" | null) ?? null,
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
          cambioRopa,
          lavar,
        },
          { supabase, userId: user.id });

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
          capsuleFloor(days, ocasiones, luggageCapacity(bolsas, maleta), { cambio: cambioRopa, lavar })
        );
        if (gaps.length > 0) {
          console.warn(`trip_capsule_underfloor user=${user.id} gaps=${gaps.join(",")}`);
        }

        send({ phase: "viendo qué ya tienes…" });
        const closet = await loadClosetLite(supabase, user.id);
        let match = null;
        try {
          match = await matchCapsule(target, closet, gender, rechazadas, { supabase, userId: user.id });
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
          lavado: lavar,
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

        // Viene de una invitación: se enlaza al viaje de origen (para el
        // "N personas ya armaron su maleta" de quien invitó). La función sólo
        // devuelve el id; un token roto, o el propio viaje, no enlazan nada.
        let invitadoDe: string | null = null;
        if (tokenValido(body.invitacion)) {
          const { data: origen } = await supabase.rpc("viaje_id_por_invitacion", { p_token: body.invitacion });
          if (typeof origen === "string") {
            const { data: propio } = await supabase.from("trips").select("id").eq("id", origen).eq("user_id", user.id).maybeSingle();
            if (!propio) invitadoDe = origen;
          }
        }

        const { data: inserted, error } = await supabase
          .from("trips")
          .insert({ user_id: user.id, ...fila, ...(invitadoDe ? { invitado_de: invitadoDe } : {}) })
          .select("id")
          .single();

        if (error || !inserted) {
          send({ error: "guardar" });
          controller.close();
          return;
        }

        await registrarEvento(supabase, {
          user_id: user.id,
          type: "trip_created",
          data: { trip_id: inserted.id, ...(invitadoDe ? { invitacion: true } : {}) },
        });
        send({ done: true, tripId: inserted.id });
        controller.close();
      } catch (e) {
        // `detalle` viaja para que el navegador lo anote en /admin/errores
        // (lib/avisar-error.ts): sin él, "la IA no pudo" no decía por qué.
        send({ error: "generacion", detalle: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
