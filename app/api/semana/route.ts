import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createTokenClient } from "@/lib/supabase/server";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import { revisarCuota } from "@/lib/cuotas";
import { diaLocal } from "@/lib/visitas";
import { STALE_MS, fechaLocalDe, generateInto, shape } from "@/lib/look-del-dia/nucleo";
import {
  EN_FILA,
  MIN_PRENDAS_SEMANA,
  diasOfrecidos,
  estadoDelDia,
  ocupaLaFecha,
  validarPeticion,
  type EstadoDia,
} from "@/lib/semana";

// "ARMA MI SEMANA" (lib/semana.ts explica el porqué).
//
// POST crea TODAS las filas de una vez (marcadas EN_FILA) y responde al
// instante; un trabajador en background arma los días UNO TRAS OTRO con el
// mismo núcleo que el look planeado de /api/look-of-day (generateInto). En
// fila y no en paralelo a propósito: cada día recarga el clóset y sus "combos
// recientes", así que el jueves ve el look del miércoles y no repite el
// conjunto (la guarda vive en el núcleo, en código). La prenda sí se puede
// repetir: unos jeans tres veces en la semana es normal.
//
// EL TRABAJADOR SE RETOMA. Una función de Vercel tiene techo (maxDuration) y un
// proveedor lento puede comerse el presupuesto: por eso cada corrida se para
// antes del techo y deja el resto EN_FILA, y el GET —que la pantalla consulta
// cada 5 s, y que corre también al volver a abrirla— relanza el trabajador si
// hay días en fila y ninguno generándose. Medido en local: ~10 s por día.
//
// NADIE ARMA DOS VECES EL MISMO DÍA. Cada día se RECLAMA con un update
// condicionado a que siga EN_FILA: si dos trabajadores coinciden, sólo uno
// obtiene la fila. Y si su fecha ya tiene un look listo (dos pedidos casi
// simultáneos), la fila sobrante se borra sin gastar IA.
export const maxDuration = 300;

/** El trabajador no empieza un día nuevo pasado este tiempo: deja margen al techo. */
const PRESUPUESTO_MS = 180_000;
/**
 * El GET relanza sólo si no hubo NINGUNA actividad en este tiempo. Entre un día
 * y el siguiente, o en los milisegundos entre el POST y su trabajador, hay filas
 * en fila y ninguna generándose: sin esta espera se arrancaba un segundo
 * trabajador en paralelo, y dos días armados a la vez ya no se ven entre sí.
 */
const SIN_ACTIVIDAD_MS = 90_000;

type Body = {
  dias?: unknown;
  fechaLocal?: string;
  lat?: number;
  lon?: number;
  workDressCode?: string;
};

const CODIGOS_TRABAJO = ["formal", "business_casual", "casual", "variable"];

async function contarPrendas(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);
  return count ?? 0;
}

type Coordenadas = { lat?: number; lon?: number };

/**
 * Arma los días EN_FILA de la persona, en orden de calendario, hasta agotar el
 * presupuesto. Cada día se reclama atómicamente antes de generarlo.
 */
async function trabajar(db: SupabaseClient, userId: string, coords: Coordenadas) {
  const inicio = Date.now();
  const hoy = diaLocal(new Date());
  while (Date.now() - inicio < PRESUPUESTO_MS) {
    const { data: siguiente } = await db
      .from("outfits")
      .select("id, planned_for, occasion")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("gen_status", "generating")
      .eq("gen_error", EN_FILA)
      .order("planned_for")
      .limit(1)
      .maybeSingle();
    if (!siguiente) return;
    const fecha = siguiente.planned_for as string;

    // Reclamo: sólo un trabajador pasa de EN_FILA a generando. Su reloj de
    // muerto (STALE_MS) arranca ahora, no cuando se pidió la semana.
    const { data: reclamada } = await db
      .from("outfits")
      .update({ gen_error: null, created_at: new Date().toISOString() })
      .eq("id", siguiente.id as string)
      .eq("user_id", userId)
      .eq("gen_error", EN_FILA)
      .select("id");
    if (!reclamada?.length) continue; // otro trabajador se la llevó

    // Un día que ya pasó (la fila se quedó colgada hasta mañana) no se arma.
    if (fecha <= hoy) {
      await db
        .from("outfits")
        .update({ gen_status: "error", gen_error: "vencido" })
        .eq("id", siguiente.id as string)
        .eq("user_id", userId);
      continue;
    }

    // ¿Ya hay un look listo para esa fecha? (dos pedidos casi a la vez)
    const { data: yaListo } = await db
      .from("outfits")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("planned_for", fecha)
      .eq("gen_status", "ready")
      .neq("id", siguiente.id as string)
      .limit(1);
    if (yaListo?.length) {
      await db
        .from("outfits")
        .update({ deleted_at: new Date().toISOString(), gen_status: "error", gen_error: "duplicado" })
        .eq("id", siguiente.id as string)
        .eq("user_id", userId);
      continue;
    }

    const cuota = await revisarCuota(db, userId, "looks");
    if (!cuota.permitido) {
      // Sin cuota se detiene toda la fila: los días que siguen tampoco pasarían.
      await db
        .from("outfits")
        .update({ gen_status: "error", gen_error: "cuota" })
        .eq("user_id", userId)
        .eq("gen_status", "generating")
        .in("gen_error", [EN_FILA])
        .gte("planned_for", fecha);
      await db
        .from("outfits")
        .update({ gen_status: "error", gen_error: "cuota" })
        .eq("id", siguiente.id as string)
        .eq("user_id", userId);
      return;
    }

    await generateInto(db, userId, siguiente.id as string, {
      objective: (siguiente.occasion as string | null) ?? "diario",
      plannedFor: fecha,
      fechaLocal: hoy,
      noPersistirObjetivo: true,
      lat: coords.lat,
      lon: coords.lon,
    });
  }
}

/** El token de la sesión para el trabajador en background (las cookies no viven tras la respuesta). */
async function tokenDe(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // El "hoy" del cliente (su zona) acotado por el del servidor: fechaLocalDe
  // tolera ±3 días de reloj, pero una semana no puede incluir días pasados.
  const hoy = fechaLocalDe({ fechaLocal: body.fechaLocal });
  const v = validarPeticion(body.dias, hoy);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const hoyServidor = diaLocal(new Date());
  if (v.dias.some((d) => d.fecha <= hoyServidor)) {
    return NextResponse.json({ error: "dias_invalidos" }, { status: 400 });
  }

  const token = await tokenDe(supabase);
  // Sin token no hay trabajador en background, y armar siete días dentro de la
  // petición se come el techo con la pantalla esperando. Mejor decir que no.
  if (!token) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });

  const prendas = await contarPrendas(supabase, user.id);
  if (prendas < MIN_PRENDAS_SEMANA) {
    return NextResponse.json(
      { error: "pocas_prendas", tienes: prendas, minimo: MIN_PRENDAS_SEMANA },
      { status: 400 }
    );
  }

  const cuota = await revisarCuota(supabase, user.id, "looks");
  if (!cuota.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: cuota.motivo, mensaje: cuota.mensaje },
      { status: 429 }
    );
  }

  // El código de vestimenta es de la PERSONA: se guarda la primera vez, igual
  // que en /api/look-of-day. El CHECK de la columna es la segunda red.
  if (typeof body.workDressCode === "string" && CODIGOS_TRABAJO.includes(body.workDressCode)) {
    await supabase.from("profiles").update({ work_dress_code: body.workDressCode }).eq("id", user.id);
  }

  // Fechas que ya tienen un look vivo no se vuelven a armar.
  const fechas = v.dias.map((d) => d.fecha);
  const { data: existentes } = await supabase
    .from("outfits")
    .select("planned_for, gen_status, gen_error, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .in("planned_for", fechas);
  const ahora = Date.now();
  const ocupadas = new Set(
    (existentes ?? [])
      .filter((o) =>
        ocupaLaFecha(
          estadoDelDia(
            {
              gen_status: o.gen_status as string | null,
              gen_error: o.gen_error as string | null,
              created_at: o.created_at as string,
            },
            ahora,
            STALE_MS
          )
        )
      )
      .map((o) => o.planned_for as string)
  );
  const porArmar = v.dias.filter((d) => !ocupadas.has(d.fecha));
  if (porArmar.length === 0) return NextResponse.json({ encolados: [] });

  const { error: insErr } = await supabase.from("outfits").insert(
    porArmar.map((d) => ({
      user_id: user.id,
      item_ids: [],
      occasion: d.ocasion,
      explanation: "",
      prompt_version: PROMPT_VERSION,
      is_look_of_day: false,
      look_date: null,
      planned_for: d.fecha,
      gen_status: "generating",
      gen_error: EN_FILA,
    }))
  );
  if (insErr) return NextResponse.json({ error: "no_pude_guardar" }, { status: 500 });

  // Sin evento propio: cada día deja su generation_timing con planned_for (lo
  // escribe generateInto), que es lo que dirá si la semana se usa.
  const coords = { lat: body.lat, lon: body.lon };
  after(async () => {
    await trabajar(createTokenClient(token), user.id, coords);
  });

  return NextResponse.json({ encolados: porArmar.map((d) => d.fecha) });
}

// GET ?fechaLocal=YYYY-MM-DD&lat&lon: el estado de los 7 días que se ofrecen.
// Si hay días en fila y ninguno generándose, relanza el trabajador (la corrida
// anterior se cortó o se quedó sin presupuesto).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  const q = request.nextUrl.searchParams;
  const hoy = fechaLocalDe({ fechaLocal: q.get("fechaLocal") ?? undefined });
  const fechas = diasOfrecidos(hoy).map((d) => d.fecha);
  const { data: filas } = await supabase
    .from("outfits")
    .select("id, item_ids, title, explanation, tip, occasion, gen_status, gen_error, created_at, planned_for")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .in("planned_for", fechas)
    .order("created_at", { ascending: false });

  const ahora = Date.now();
  const dias: Record<string, { estado: EstadoDia; ocasion: string | null; look?: unknown }> = {};
  let enFila = false;
  let generando = false;
  let ultimaActividad = 0;
  for (const o of filas ?? []) {
    ultimaActividad = Math.max(ultimaActividad, new Date(o.created_at as string).getTime());
    const fecha = o.planned_for as string;
    const estado = estadoDelDia(
      {
        gen_status: o.gen_status as string | null,
        gen_error: o.gen_error as string | null,
        created_at: o.created_at as string,
      },
      ahora,
      STALE_MS
    );
    if (estado === "en_fila") enFila = true;
    if (estado === "generando") generando = true;
    // Por fecha, el mejor estado gana (un listo tapa un error viejo de la misma fecha).
    const previo = dias[fecha];
    const rango: Record<EstadoDia, number> = { listo: 3, generando: 2, en_fila: 1, error: 0 };
    if (previo && rango[previo.estado] >= rango[estado]) continue;
    dias[fecha] = {
      estado,
      ocasion: (o.occasion as string | null) ?? null,
      ...(estado === "listo" ? { look: await shape(supabase, o as Parameters<typeof shape>[1]) } : {}),
    };
  }

  if (enFila && !generando && ahora - ultimaActividad > SIN_ACTIVIDAD_MS) {
    const token = await tokenDe(supabase);
    if (token) {
      const lat = Number(q.get("lat"));
      const lon = Number(q.get("lon"));
      const coords = Number.isFinite(lat) && Number.isFinite(lon) && q.get("lat") ? { lat, lon } : {};
      after(async () => {
        await trabajar(createTokenClient(token), user.id, coords);
      });
    }
  }

  return NextResponse.json({ dias });
}
