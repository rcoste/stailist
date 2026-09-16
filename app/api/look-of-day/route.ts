import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createTokenClient } from "@/lib/supabase/server";
import { OBJECTIVES } from "@/app/onboarding/objetivo/objectives";
import { PROMPT_VERSION, type EngineItem } from "@/lib/engine/prompt";
import { climaParaElMotor } from "@/lib/weather";
import { checkAnchorFit } from "@/lib/engine/anchor-fit";
import { revisarCuota } from "@/lib/cuotas";
import {
  anclasDe,
  fechaLocalDe,
  generateInto,
  isStale,
  plannedForDe,
  shape,
  type Body,
} from "@/lib/look-del-dia/nucleo";

// La generación corre en background (Next after(), que en Vercel Pro + Fluid
// Compute sigue tras la respuesta), así que le damos holgura.
export const maxDuration = 120;

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

  // Tope diario de IA (lib/cuotas.ts). 429 y NO 500: no es un fallo, es un
  // límite, y el cliente lo distingue para enseñar el mensaje tal cual.
  const cuota = await revisarCuota(supabase, user.id, "looks");
  if (!cuota.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: cuota.motivo, mensaje: cuota.mensaje },
      { status: 429 }
    );
  }

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

// Chequeo de ocasión del ancla. Devuelve el payload de aviso si la prenda NO va
// con la ocasión, o null si va (o no hay con qué decidir → no estorbar). Usa el
// clima manual si lo hay (no resuelve geo aquí, para no meter latencia al gate).
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
