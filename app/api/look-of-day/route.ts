import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createTokenClient } from "@/lib/supabase/server";
import { generateOutfits } from "@/lib/engine/generate";
import { alcanceDeFormalidad } from "@/lib/engine/alcance";
import { reviewOutfit } from "@/lib/engine/critic";
import { armarLooks } from "@/lib/engine/pipeline";
import {
  cargarBaseDelMotor,
  construirContexto,
  recortarPlan,
  resolverYPersistirObjetivo,
} from "@/lib/engine/contexto";
import { OBJECTIVES } from "@/app/onboarding/objetivo/objectives";
import { PROMPT_VERSION, type EngineItem } from "@/lib/engine/prompt";
import {
  resolveWeather,
  getWeatherForDates,
  climaParaElMotor,
  hayLluvia,
  type Weather,
} from "@/lib/weather";
import { checkAnchorFit } from "@/lib/engine/anchor-fit";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";

// La generación corre en background (Next after(), que en Vercel Pro + Fluid
// Compute sigue tras la respuesta), así que le damos holgura.
export const maxDuration = 120;

// Un look "generating" más viejo que esto se considera muerto (el background se
// cayó) → el cliente puede reintentar.
const STALE_MS = 150_000;

type Body = {
  lat?: number;
  lon?: number;
  weather?: { temp_c?: number; condition?: string };
  objective?: string;
  plan?: string;
  momento?: string;
  force?: boolean;
  seedItemIds?: string[]; // anclas: prendas que la usuaria quiere usar hoy
  /** @deprecated el singular de antes; se sigue leyendo. */
  seedItemId?: string;
  forceAnchor?: boolean; // ya confirmó usar el ancla pese al aviso de ocasión
  formality?: string; // solo en "evento". Los valores viven en Formalidad (lib/formalidad.ts) —
  // NO se re-enumeran aquí: esta lista ya se quedó corta cuando entró "playa".
  /** QUÉ evento es, del catálogo (lib/eventos.ts). */
  tipoEvento?: string | null;
  paraguas?: boolean; // solo cuando el clima trae lluvia
  /**
   * "¿la lluvia te toca?" → techado. Solo se pregunta cuando el pronóstico trae
   * lluvia. Si es true, el motor NO se entera de que llueve (ver
   * climaParaElMotor): la mitigación pasa ANTES del modelo, no como una regla
   * más del prompt. El clima que se guarda con el look sigue siendo el real.
   */
  techado?: boolean;
  workDressCode?: string; // solo la primera vez que elige "trabajo"
  /** Del día: solo cuenta si su código de trabajo es "variable". */
  veCliente?: boolean;
  /** Fecha calendario LOCAL del dispositivo (YYYY-MM-DD). El server corre en
   *  UTC — a las 6pm de CDMX ya cree que es mañana. */
  fechaLocal?: string;
  /** Look pedido por adelantado: fecha futura (≤ ~16 días). */
  plannedFor?: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// El "hoy" REAL: la fecha local del cliente si viene y es sana (±3 días del
// reloj del server — un cliente con el reloj roto no manda el look a 2019);
// si no, la del server como antes.
function fechaLocalDe(body: Body): string {
  const f = body.fechaLocal;
  if (typeof f === "string" && DATE_RE.test(f)) {
    const diff = Math.abs(new Date(f + "T12:00:00Z").getTime() - Date.now());
    if (diff < 3 * 86_400_000) return f;
  }
  return todayStr();
}

// La fecha planeada, validada: futura (hoy o pasado caen al flujo normal) y
// dentro del horizonte del pronóstico. Inválida = null = flujo de hoy.
function plannedForDe(body: Body, hoy: string): string | null {
  const p = body.plannedFor;
  if (typeof p !== "string" || !DATE_RE.test(p)) return null;
  if (p <= hoy) return null; // los strings ISO comparan bien lexicográficamente
  const dias =
    (new Date(p + "T00:00:00Z").getTime() - new Date(hoy + "T00:00:00Z").getTime()) /
    86_400_000;
  return dias > 16 ? null : p;
}

// Día D: ¿hay un look planeado para hoy? Promuévelo a look del día. Si esa
// fecha ya tiene look del día (índice único parcial), EL EXISTENTE GANA — el
// planeado se queda en historial. Determinista y sin crash.
async function promoverPlaneado(
  supabase: SupabaseClient,
  userId: string,
  today: string
): Promise<Record<string, unknown> | null> {
  const CAMPOS = "id, item_ids, title, explanation, tip, gen_status, created_at";
  const { data: plan } = await supabase
    .from("outfits")
    .select(CAMPOS)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("planned_for", today)
    .eq("is_look_of_day", false)
    .eq("gen_status", "ready")
    // Varios looks para la misma fecha: el más reciente gana (los demás quedan
    // en historial, como cualquier look).
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!plan) return null;

  const { error } = await supabase
    .from("outfits")
    .update({ is_look_of_day: true, look_date: today })
    .eq("id", plan.id as string)
    .eq("user_id", userId);
  if (error) {
    // 23505 del índice (user, look_date) where is_look_of_day: alguien ya es el
    // look del día (transición/carrera) — se lee y se devuelve al ganador.
    const { data: winner } = await supabase
      .from("outfits")
      .select(CAMPOS)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_look_of_day", true)
      .eq("look_date", today)
      .maybeSingle();
    const st = winner ? ((winner.gen_status as string | null) ?? "ready") : null;
    return st === "ready" ? winner : null;
  }
  return plan;
}

// POST: arranca (o devuelve) el look de hoy. Crea un placeholder 'generating',
// responde al instante con su id, y genera en background. El cliente hace polling
// del GET. Resiliente a que el cliente se vaya a media carga.
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
    // sin body = sin clima
  }
  const force = !!body.force;
  const seedItemIds = anclasDe(body);
  // El código de vestimenta se PERSISTE la primera (y única) vez que llega:
  // es de la persona, no de la petición. La lista se valida aquí porque una
  // server route es un endpoint — el CHECK de la columna es la segunda red.
  if (
    typeof body.workDressCode === "string" &&
    ["formal", "business_casual", "casual", "variable"].includes(body.workDressCode)
  ) {
    await supabase
      .from("profiles")
      .update({ work_dress_code: body.workDressCode })
      .eq("id", user.id);
  }
  const forceAnchor = !!body.forceAnchor;
  // "Hoy" es el del DISPOSITIVO (fechaLocal del body), no el del server: antes
  // se usaba todayStr() (UTC) y el look del día rotaba a las 6pm de CDMX.
  const today = fechaLocalDe(body);
  const plannedFor = plannedForDe(body, today);

  // Gate de ocasión: si ancló una prenda y aún no confirmó, checa que vaya con la
  // ocasión. Si es un mismatch obvio (traje de baño + boda), devuelve un aviso
  // (sin generar) para que decida armar igual o cambiar de prenda.
  if (seedItemIds.length && !forceAnchor) {
    const warning = await anchorWarningIfUnfit(supabase, user.id, seedItemIds, body);
    if (warning) return NextResponse.json(warning);
  }

  // ¿Ya hay look de hoy? Si está listo y no es "otro look", devuélvelo. Si está
  // generándose (y no muerto), devuelve su id para que el cliente siga el polling.
  // No aplica cuando está anclando una prenda ni cuando el look es para OTRO
  // día (plannedFor): ahí siempre arma un look nuevo.
  if (!force && !seedItemIds.length && !plannedFor) {
    const { data: existing } = await supabase
      .from("outfits")
      .select("id, item_ids, title, explanation, tip, gen_status, created_at")
      .eq("user_id", user.id)
      // Si borraste el look de hoy, no cuenta como cacheado: te armamos otro.
      .is("deleted_at", null)
      .eq("is_look_of_day", true)
      .eq("look_date", today)
      .maybeSingle();
    if (existing) {
      const status = (existing.gen_status as string | null) ?? "ready";
      if (status === "ready") {
        return NextResponse.json({
          outfitId: existing.id,
          status: "ready",
          outfit: await shape(supabase, existing),
          alternos: await alternosDe(supabase, user.id, existing.id as string),
        });
      }
      if (status === "generating" && !isStale(existing.created_at as string)) {
        return NextResponse.json({ outfitId: existing.id, status: "generating" });
      }
      // 'error' o 'generating' muerto → cae a regenerar.
    }

    // Sin look de hoy usable: ¿hay uno PLANEADO para hoy? Amanece siendo el
    // look del día — sin generar (ni pagar) nada nuevo.
    const plan = await promoverPlaneado(supabase, user.id, today);
    if (plan) {
      return NextResponse.json({
        outfitId: plan.id,
        status: "ready",
        outfit: await shape(supabase, plan as Parameters<typeof shape>[1]),
      });
    }
  }

  // "Otro look" / regenerar: el look de hoy anterior pierde el flag (sigue en
  // historial) para respetar el índice único (user, look_date). Un look para
  // OTRO día no toca el de hoy.
  if (!plannedFor) {
    await supabase
      .from("outfits")
      .update({ is_look_of_day: false })
      .eq("user_id", user.id)
      .eq("is_look_of_day", true)
      .eq("look_date", today);
  }

  const objHint =
    typeof body.objective === "string" && body.objective in OBJECTIVES
      ? body.objective
      : "diario";

  const { data: placeholder, error: insErr } = await supabase
    .from("outfits")
    .insert({
      user_id: user.id,
      item_ids: [],
      occasion: objHint,
      explanation: "",
      prompt_version: PROMPT_VERSION,
      // Look para OTRO día: se guarda colgado a su fecha (planned_for) y NO es
      // el look del día — lo será al llegar su día, vía promoverPlaneado().
      is_look_of_day: !plannedFor,
      look_date: plannedFor ? null : today,
      ...(plannedFor ? { planned_for: plannedFor } : {}),
      gen_status: "generating",
    })
    .select("id")
    .single();
  if (insErr || !placeholder) {
    return NextResponse.json({ error: "no_pude_guardar" }, { status: 500 });
  }
  const outfitId = placeholder.id as string;

  // Token para el cliente de background (las cookies no viven tras la respuesta).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (token) {
    after(async () => {
      const bg = createTokenClient(token);
      await generateInto(bg, user.id, outfitId, body);
    });
  } else {
    // Sin token (raro): genera sincrónico para no dejar el placeholder colgado.
    await generateInto(supabase, user.id, outfitId, body);
  }

  return NextResponse.json({ outfitId, status: "generating" });
}

// GET ?id=X: estado del look (para el polling del cliente).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // ?promover=<fecha_local>: el check ligero al abrir la home. NO genera nada:
  // si hay look del día listo lo devuelve; si hay uno PLANEADO para esa fecha
  // lo promueve y lo devuelve; si no, "none" y el cliente sigue en idle.
  const promover = request.nextUrl.searchParams.get("promover");
  if (promover) {
    const today = fechaLocalDe({ fechaLocal: promover });
    const { data: existing } = await supabase
      .from("outfits")
      .select("id, item_ids, title, explanation, tip, gen_status, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("is_look_of_day", true)
      .eq("look_date", today)
      .maybeSingle();
    if (existing && ((existing.gen_status as string | null) ?? "ready") === "ready") {
      return NextResponse.json({
        status: "ready",
        outfit: await shape(supabase, existing),
      });
    }
    const plan = await promoverPlaneado(supabase, user.id, today);
    if (plan) {
      return NextResponse.json({
        status: "ready",
        outfit: await shape(supabase, plan as Parameters<typeof shape>[1]),
      });
    }
    return NextResponse.json({ status: "none" });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: o } = await supabase
    .from("outfits")
    .select("id, item_ids, title, explanation, tip, gen_status, gen_error, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!o) return NextResponse.json({ error: "no_outfit" }, { status: 404 });

  const status = (o.gen_status as string | null) ?? "ready";
  if (status === "error") {
    const ge = (o.gen_error as string) ?? "generacion";
    // "El clóset no alcanza para ese código" NO es un error genérico: trae la
    // lista de lo que falta y su pantalla propia. Viaja codificado en gen_error
    // porque la generación corre en background (after()) y su return se pierde
    // — antes este caso dejaba el placeholder colgado hasta el timeout de 150s.
    if (ge.startsWith("no_alcanza:")) {
      let faltan: string[] = [];
      try {
        const parsed = JSON.parse(ge.slice("no_alcanza:".length));
        if (Array.isArray(parsed)) faltan = parsed.filter((x) => typeof x === "string");
      } catch {
        /* lista ilegible → pantalla sin detalle, mejor que un error genérico */
      }
      return NextResponse.json({ status: "no_alcanza", faltan });
    }
    return NextResponse.json({ status: "error", error: ge });
  }
  if (status === "generating") {
    if (isStale(o.created_at as string)) {
      return NextResponse.json({ status: "error", error: "timeout" });
    }
    return NextResponse.json({ status: "generating" });
  }
  return NextResponse.json({
    status: "ready",
    outfit: await shape(supabase, o),
    alternos: await alternosDe(supabase, user.id, o.id as string),
  });
}

/** Los dos eventos de instrumentación de una generación del look de hoy. Es el
 *  camino que corre solo, en background y todos los días — o sea el que más
 *  barato sale de olvidar y más caro sale de no ver. Compartido por el camino
 *  single (plannedFor) y el del trío para que ninguno se quede sin recibo. */
async function registrarEventos(
  supabase: SupabaseClient,
  userId: string,
  gender: string | null,
  d: {
    ms: number;
    anclas: number;
    plannedFor: string | null;
    planLibre: boolean;
    reviews: {
      before: string[];
      after: string[];
      changed: boolean;
      verdict: string;
      razon: string | null;
      shown: boolean;
    }[];
  }
) {
  await supabase.from("events").insert([
    {
      user_id: userId,
      type: "generation_timing",
      data: {
        ms: d.ms,
        prompt_version: PROMPT_VERSION,
        look_of_day: true,
        anchored: d.anclas > 0, // ¿usó ancla? (medir adopción)
        anclas: d.anclas, // cuántas — para ver si el plural se usa
        // Los dos gates pre-registrados del rediseño del wizard (2026-08-10):
        // planned_for ≥1/usuaria activa en 2 semanas → se construye la agenda;
        // % con plan_libre → se construye el parser del campo abierto.
        planned_for: d.plannedFor,
        plan_libre: d.planLibre,
      },
    },
    {
      user_id: userId,
      type: "critic_review",
      data: {
        gender,
        prompt_version: PROMPT_VERSION,
        look_of_day: true,
        repaired: d.reviews.filter((r) => r.verdict === "reparado").length,
        rejected: d.reviews.filter((r) => r.verdict === "rechazado").length,
        regenerated: 0,
        changes: d.reviews,
      },
    },
  ]);
}

/** Los looks ALTERNOS de una generación: el resto del trío, ya listos. El lazo
 *  es grupo_generacion = id del principal (migración 0143) — adivinar por
 *  look_date confundiría los alternos con los descartes de "otro look". */
async function alternosDe(supabase: SupabaseClient, userId: string, principalId: string) {
  const { data } = await supabase
    .from("outfits")
    .select("id, item_ids, title, explanation, tip, gen_status, created_at")
    .eq("user_id", userId)
    .eq("grupo_generacion", principalId)
    .eq("gen_status", "ready")
    .is("deleted_at", null)
    .order("created_at");
  return Promise.all((data ?? []).map((a) => shape(supabase, a)));
}

function isStale(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t > STALE_MS;
}

// Chequeo de ocasión del ancla. Devuelve el payload de aviso si la prenda NO va
// con la ocasión, o null si va (o no hay con qué decidir → no estorbar). Usa el
// clima manual si lo hay (no resuelve geo aquí, para no meter latencia al gate).
/**
 * Las anclas que trae la petición, en la forma nueva o en la vieja.
 *
 * Un helper y no dos lecturas sueltas porque el cuerpo se lee en DOS puntas —el
 * gate de ocasión y la generación— y si una entendiera `seedItemIds` y la otra
 * sólo `seedItemId`, un cliente sin recargar pasaría el gate con una prenda y
 * generaría sin ninguna. Ése es el tipo de desincronía que no truena: sólo
 * devuelve un look que ignora lo que la persona pidió.
 */
function anclasDe(body: Body): string[] {
  if (Array.isArray(body.seedItemIds)) {
    return body.seedItemIds.filter((x): x is string => typeof x === "string" && !!x);
  }
  return typeof body.seedItemId === "string" && body.seedItemId ? [body.seedItemId] : [];
}

async function anchorWarningIfUnfit(
  supabase: SupabaseClient,
  userId: string,
  seedItemIds: string[],
  body: Body
): Promise<{ status: "anchor_warning"; note: string; seedItemName: string } | null> {
  const { data: rows } = await supabase
    .from("items")
    .select("id, attrs")
    .in("id", seedItemIds)
    .eq("user_id", userId)
    .is("deleted_at", null);
  // Ninguna existe (borradas) → que generateInto haga el fallback. Si existen
  // algunas, se revisan ésas: perder una no debe cancelar el aviso de las otras.
  if (!rows?.length) return null;
  // En el orden en que las eligió, no en el que las devolvió Postgres: el aviso
  // nombra una prenda y debe ser predecible.
  const items = seedItemIds
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is (typeof rows)[number] => !!r);

  const attrs = (items[0].attrs ?? {}) as { nombre?: string };
  const occasion =
    (typeof body.plan === "string" && body.plan.trim()) ||
    (typeof body.objective === "string" && body.objective in OBJECTIVES
      ? OBJECTIVES[body.objective as keyof typeof OBJECTIVES]
      : "el día a día");
  // EL TECHADO TAMBIÉN MANDA AQUÍ. Este gate corre ANTES de generar y puede
  // bloquear el flujo con "esa prenda no va con la lluvia" — o sea que sin este
  // filtro era la única pantalla donde el agua que la persona acaba de decir
  // que no le toca vuelve a aparecer, y encima frenando.
  const wCrudo =
    typeof body.weather?.temp_c === "number"
      ? {
          temp_c: body.weather.temp_c,
          condition: body.weather.condition ?? "despejado",
        }
      : null;
  const wGate = climaParaElMotor(wCrudo, body.techado === true);
  const weatherLine = wGate ? `${wGate.temp_c}°C, ${wGate.condition}` : null;

  const fit = await checkAnchorFit(
    items.map((i) => ({ id: i.id as string, attrs: i.attrs as EngineItem["attrs"] })),
    occasion,
    weatherLine
  );
  if (fit.fits) return null;
  return {
    status: "anchor_warning",
    note: fit.note || "Esa prenda no es la mejor para esta ocasión.",
    seedItemName: attrs.nombre ?? "esa prenda",
  };
}

// Error de generación con código para mostrar al usuario.
class GenError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// El trabajo pesado: lee el contexto, genera + revisa, y ESCRIBE el resultado en
// el placeholder (ready) o marca el error. Corre en background (after()).
async function generateInto(
  supabase: SupabaseClient,
  userId: string,
  outfitId: string,
  body: Body
) {
  try {
    // La carga y la construcción del contexto son las COMPARTIDAS
    // (lib/engine/contexto.ts): "Tu look de hoy" llama al MISMO motor que
    // /api/generate, y tener dos copias ya había derivado (esta ruta no pasaba
    // fitPref; la otra no filtraba placeholders del historial).
    const carga = await cargarBaseDelMotor(supabase, userId);
    if ("error" in carga) throw new GenError("closet_vacio");
    const { base } = carga;
    const profile = base.profile;

    // Look para otro día + ubicación: el clima es el PRONÓSTICO de esa fecha
    // (getWeatherForDates, la misma pieza del modo Viaje — con fallback a
    // histórico si algo falla dentro). El clima manual (bandas) manda igual
    // que siempre. Riesgo aceptado y documentado: el pronóstico es del día en
    // que se PIDE el look; el día D no se re-verifica.
    const plannedFor = plannedForDe(body, fechaLocalDe(body));
    const manual =
      !!body.weather && typeof body.weather.temp_c === "number";
    const weather: Weather | null =
      plannedFor && !manual && typeof body.lat === "number" && typeof body.lon === "number"
        ? await getWeatherForDates(body.lat, body.lon, plannedFor, plannedFor)
        : await resolveWeather(body);

    const seedItemIds = anclasDe(body);

    const objective = await resolverYPersistirObjetivo(
      supabase,
      profile,
      body.objective,
      userId,
      OBJECTIVES
    );

    // BAJO TECHO LA LLUVIA NO EXISTE PARA EL MOTOR. Dijo que va a estar
    // entechado: se le quita el dato del agua y queda solo la temperatura (el
    // porqué, en climaParaElMotor). El paraguas deja de tener sentido con él.
    const techado = body.techado === true;
    const ctx = construirContexto(base, {
      objective,
      plan: typeof body.plan === "string" ? body.plan : null,
      momento: typeof body.momento === "string" ? body.momento : null,
      weather: climaParaElMotor(weather, techado),
      seedItemIds,
      formality: typeof body.formality === "string" ? body.formality : null,
      tipoEvento: typeof body.tipoEvento === "string" ? body.tipoEvento : null,
      // Solo cuenta si de verdad llueve: un "sí llevo paraguas" con sol no debe
      // soltarle la mano a la capa exterior. El contexto lo pasa tal cual y la
      // regla #7 solo mira `paraguas` cuando `lluvia` es cierto.
      paraguas: body.paraguas === true && !techado,
      // NO se persiste: es del día, como el paraguas. Solo cuenta si su código
      // de trabajo es "variable" (el prompt lo ignora en los otros tres).
      veCliente: typeof body.veCliente === "boolean" ? body.veCliente : null,
    });
    // Las que el contexto RESOLVIÓ — pueden ser menos que las pedidas: una
    // prenda borrada se cae y las demás siguen. Nombre propio para no tapar a
    // `seedItemIds` de arriba, que son las que llegaron en la petición.
    const anclasResueltas = ctx.seedItemIds ?? [];

    // ¿Este clóset da para el código que pidió? Se contesta ANTES de generar:
    // es una consulta al clóset, no una opinión. Roberto: "boda de etiqueta y
    // el usuario no tiene traje — debería decir NO, no 'ok, pues puede con unos
    // jeans más un suéter'". Decirlo hoy vale más que un look que la deja mal
    // en la puerta.
    const alcance = alcanceDeFormalidad(
      ctx.items,
      (body.formality as never) ?? null,
      ctx.gender
    );
    if (alcance.faltaLoEsencial) {
      // OJO: esto corre en background (after()) — devolver un NextResponse aquí
      // se perdía en el vacío y el placeholder quedaba "generating" hasta el
      // timeout de 150s. El veredicto se escribe al placeholder y el GET lo
      // traduce de vuelta a la pantalla de no_alcanza.
      await supabase
        .from("outfits")
        .update({
          gen_status: "error",
          gen_error: "no_alcanza:" + JSON.stringify(alcance.faltan ?? []),
          is_look_of_day: false,
        })
        .eq("id", outfitId)
        .eq("user_id", userId);
      return;
    }

    const startedAt = Date.now();
    const quien = { supabase, userId };

    // Los campos que comparten el principal y sus alternos: son la MISMA
    // generación, así que llevan el mismo plan, clima y ocasión.
    const camposComunes = {
      occasion: objective ?? "diario",
      plan: recortarPlan(body.plan),
      weather:
        techado && hayLluvia(weather?.condition) ? { ...weather, techado: true } : weather,
      prompt_version: PROMPT_VERSION,
    };

    // ── EL TRÍO. Desde v54 el generador produce EXACTAMENTE 3 outfits en una
    //    sola llamada — ya pagados. Esta ruta revisaba el primero y TIRABA los
    //    otros dos; Roberto: "si estamos generando dos o tres, no perdemos
    //    nada… sino es desperdiciar lo que ya se hizo". Ahora corre el pipeline
    //    COMPARTIDO (armarLooks — el mismo de /api/generate y el comparador):
    //    el primer look aprobado se escribe al placeholder (el cliente lo está
    //    polleando: la primera pantalla no espera al trío) y los siguientes se
    //    guardan como alternos ligados por grupo_generacion (0143).
    //
    //    Los looks para OTRO día (plannedFor) siguen generando UNO: sus
    //    alternos ensuciarían promoverPlaneado, que promovería cualquiera de
    //    los tres al amanecer.
    if (plannedFor) {
      const candidates = await generateOutfits(ctx, {}, quien);
      const result = await reviewOutfit(ctx, candidates[0], [], false, {}, quien);
      const elegido = result.outfit;

      const { error: upErr } = await supabase
        .from("outfits")
        .update({
          item_ids: elegido.item_ids,
          ...camposComunes,
          title: elegido.nombre,
          explanation: elegido.explicacion,
          tip: elegido.tip ?? null,
          gen_status: "ready",
          gen_error: null,
        })
        .eq("id", outfitId)
        .eq("user_id", userId);
      if (upErr) throw new GenError("no_pude_guardar");

      await registrarEventos(supabase, userId, profile.gender as string | null, {
        ms: Date.now() - startedAt,
        anclas: seedItemIds.length,
        plannedFor,
        planLibre: typeof body.plan === "string" && body.plan.trim().length > 0,
        reviews: [
          {
            before: candidates[0].item_ids,
            after: elegido.item_ids,
            changed: elegido.item_ids.join(",") !== candidates[0].item_ids.join(","),
            verdict: result.verdict,
            razon: result.razon,
            shown: true,
          },
        ],
      });
      return;
    }

    // El camino de HOY: el trío completo.
    let principalListo = false;
    const { finalized, reviews } = await armarLooks(
      ctx,
      {},
      {
        alAprobar: async (outfit) => {
          if (!principalListo) {
            const { error } = await supabase
              .from("outfits")
              .update({
                item_ids: outfit.item_ids,
                ...camposComunes,
                title: outfit.nombre,
                explanation: outfit.explicacion,
                tip: outfit.tip ?? null,
                gen_status: "ready",
                gen_error: null,
              })
              .eq("id", outfitId)
              .eq("user_id", userId);
            if (error) return false;
            principalListo = true;
            return true;
          }
          // Alterno: fila propia, ligada al principal. NO es look del día — es
          // la otra opción del trío, visible en las pestañas y en el diario.
          const { error } = await supabase.from("outfits").insert({
            user_id: userId,
            item_ids: outfit.item_ids,
            ...camposComunes,
            title: outfit.nombre,
            explanation: outfit.explicacion,
            tip: outfit.tip ?? null,
            is_look_of_day: false,
            look_date: fechaLocalDe(body),
            gen_status: "ready",
            grupo_generacion: outfitId,
          });
          return !error;
        },
      },
      quien
    );
    if (!finalized.length) throw new GenError("generacion");

    await registrarEventos(supabase, userId, profile.gender as string | null, {
      ms: Date.now() - startedAt,
      anclas: seedItemIds.length,
      plannedFor: null,
      planLibre: typeof body.plan === "string" && body.plan.trim().length > 0,
      reviews,
    });
  } catch (err) {
    const code =
      err instanceof GenError
        ? err.code
        : err instanceof Error && err.message === "ENGINE_NOT_CONNECTED"
          ? "sin_api_key"
          : "generacion";
    // El placeholder fallido deja de ser el look del día (no muestra una card rota).
    await supabase
      .from("outfits")
      .update({ gen_status: "error", gen_error: code, is_look_of_day: false })
      .eq("id", outfitId)
      .eq("user_id", userId);
  }
}

// Da forma a un outfit + sus prendas (con imagen resuelta y firmada) para el
// cliente. Resuelve igual que la carga inicial (arquetipo → render → foto →
// swatch), así el polling no deja prendas con foto/render como swatch. El `id`
// va para el render bajo demanda (RenderableTile) cuando aún falta imagen.
async function shape(
  supabase: SupabaseClient,
  o: {
    id: string;
    item_ids: unknown;
    title: string | null;
    explanation: string;
    tip?: string | null;
  }
) {
  const itemIds = (o.item_ids as string[]) ?? [];
  const { data: items } = await supabase
    .from("items")
    .select("id, photo_path, render_status, render_path, attrs, archetypes(name, image_path)")
    .in("id", itemIds);
  const list = items ?? [];

  const paths = list
    .flatMap((i) => [i.photo_path as string | null, i.render_path as string | null])
    .filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrls(Array.from(new Set(paths)), 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  const byId = new Map(
    list.map((i) => {
      const arch = i.archetypes as { name?: string; image_path?: string | null } | null;
      const attrs = (i.attrs ?? {}) as { nombre?: string; color_hex?: string; conjunto?: string };
      return [
        i.id as string,
        {
          nombre: arch?.name ?? attrs.nombre ?? "Prenda",
          swatch: attrs.color_hex ?? "#E5E1DD",
          imagen: itemImageUrlSync(i as ItemImageRow, (p) => signed.get(p)),
          conjunto: attrs.conjunto ?? null,
        },
      ];
    })
  );

  return {
    id: o.id,
    nombre: o.title ?? "Tu look",
    explicacion: o.explanation,
    tip: o.tip ?? null,
    prendas: itemIds.map((id) => ({
      id,
      nombre: byId.get(id)?.nombre ?? "Prenda",
      swatch: byId.get(id)?.swatch ?? "#E5E1DD",
      imagen: byId.get(id)?.imagen ?? null,
    })),
  };
}
