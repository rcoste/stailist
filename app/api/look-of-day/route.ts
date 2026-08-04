import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createTokenClient } from "@/lib/supabase/server";
import { generateOutfits } from "@/lib/engine/generate";
import { reviewOutfit } from "@/lib/engine/critic";
import { type EngineContext } from "@/lib/engine/prompt";
import { OBJECTIVES } from "@/app/onboarding/objetivo/objectives";
import { PROMPT_VERSION, orderClosetForEngine, type EngineItem } from "@/lib/engine/prompt";
import { resolveWeather, type Weather } from "@/lib/weather";
import type { Season } from "@/lib/colorimetria";
import { lifestyleSummary, type LifestyleAnswers } from "@/lib/capsule";
import { applyVetoes, vetoLabels, EMPTY_VETOES, type StyleVetoes } from "@/lib/vetoes";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import { ageStylingLine, type AgeRange } from "@/lib/edad";
import { loadTasteSignal } from "@/lib/engine/taste-signal";
import { checkAnchorFit } from "@/lib/engine/anchor-fit";
import { conCategoria, ITEM_IMAGE_SELECT, itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { styleReferenceForEngine } from "@/lib/estilo-referencia";

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
  seedItemId?: string; // ancla: prenda que la usuaria quiere usar hoy
  forceAnchor?: boolean; // ya confirmó usar el ancla pese al aviso de ocasión
  formality?: string; // solo en "evento": casual | semiformal | formal | gala
};

const todayStr = () => new Date().toISOString().slice(0, 10);

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
  const seedItemId = typeof body.seedItemId === "string" ? body.seedItemId : null;
  const forceAnchor = !!body.forceAnchor;
  const today = todayStr();

  // Gate de ocasión: si ancló una prenda y aún no confirmó, checa que vaya con la
  // ocasión. Si es un mismatch obvio (traje de baño + boda), devuelve un aviso
  // (sin generar) para que decida armar igual o cambiar de prenda.
  if (seedItemId && !forceAnchor) {
    const warning = await anchorWarningIfUnfit(supabase, user.id, seedItemId, body);
    if (warning) return NextResponse.json(warning);
  }

  // ¿Ya hay look de hoy? Si está listo y no es "otro look", devuélvelo. Si está
  // generándose (y no muerto), devuelve su id para que el cliente siga el polling.
  // No aplica cuando está anclando una prenda: ahí siempre arma un look nuevo.
  if (!force && !seedItemId) {
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
        });
      }
      if (status === "generating" && !isStale(existing.created_at as string)) {
        return NextResponse.json({ outfitId: existing.id, status: "generating" });
      }
      // 'error' o 'generating' muerto → cae a regenerar.
    }
  }

  // "Otro look" / regenerar: el look de hoy anterior pierde el flag (sigue en
  // historial) para respetar el índice único (user, look_date).
  await supabase
    .from("outfits")
    .update({ is_look_of_day: false })
    .eq("user_id", user.id)
    .eq("is_look_of_day", true)
    .eq("look_date", today);

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
      is_look_of_day: true,
      look_date: today,
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
    return NextResponse.json({ status: "error", error: (o.gen_error as string) ?? "generacion" });
  }
  if (status === "generating") {
    if (isStale(o.created_at as string)) {
      return NextResponse.json({ status: "error", error: "timeout" });
    }
    return NextResponse.json({ status: "generating" });
  }
  return NextResponse.json({ status: "ready", outfit: await shape(supabase, o) });
}

function isStale(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t > STALE_MS;
}

// Chequeo de ocasión del ancla. Devuelve el payload de aviso si la prenda NO va
// con la ocasión, o null si va (o no hay con qué decidir → no estorbar). Usa el
// clima manual si lo hay (no resuelve geo aquí, para no meter latencia al gate).
async function anchorWarningIfUnfit(
  supabase: SupabaseClient,
  userId: string,
  seedItemId: string,
  body: Body
): Promise<{ status: "anchor_warning"; note: string; seedItemName: string } | null> {
  const { data: item } = await supabase
    .from("items")
    .select("attrs")
    .eq("id", seedItemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) return null; // prenda borrada → que generateInto haga el fallback

  const attrs = (item.attrs ?? {}) as { nombre?: string };
  const occasion =
    (typeof body.plan === "string" && body.plan.trim()) ||
    (typeof body.objective === "string" && body.objective in OBJECTIVES
      ? OBJECTIVES[body.objective as keyof typeof OBJECTIVES]
      : "el día a día");
  const weatherLine =
    typeof body.weather?.temp_c === "number"
      ? `${body.weather.temp_c}°C, ${body.weather.condition ?? "despejado"}`
      : null;

  const fit = await checkAnchorFit(
    { id: seedItemId, attrs: item.attrs as EngineItem["attrs"] },
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
    const [profileRes, itemsRes, recentRes, tasteSignal] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      // ITEM_IMAGE_SELECT trae también la categoría del arquetipo: las prendas
      // del catálogo no la copian a sus attrs y sin ella el motor deduce del
      // nombre (ver conCategoria). "Tu look de hoy" llama al MISMO motor que
      // /api/generate, así que necesita el mismo dato o arma peor que la otra
      // pantalla sin que nada lo delate.
      supabase
        .from("items")
        .select(`id, ${ITEM_IMAGE_SELECT}`)
        .eq("user_id", userId)
        .is("deleted_at", null),
      supabase
        .from("outfits")
        .select("item_ids")
        .eq("user_id", userId)
        // Un look borrado no debe seguir restringiendo lo que te armo hoy.
        .is("deleted_at", null)
        // Solo los looks DIARIOS restringen al motor diario. Los del viaje y los
        // de la cápsula viven en outfits para el try-on/favorito, pero son otro
        // contexto: 15 looks de cápsula dejarían al motor de Hoy sin qué armar.
        .eq("source", "daily")
        // Solo combos COMPLETOS (legacy null o 'ready'); nunca placeholders.
        .or("gen_status.is.null,gen_status.eq.ready")
        .gte("created_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()),
      loadTasteSignal(supabase, userId),
    ]);

    const profile = profileRes.data;
    if (!profile) throw new GenError("closet_vacio");
    const vetoes = (profile.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;
    const allItems = (itemsRes.data ?? []) as EngineItem[];
    const { items } = applyVetoes(
      conCategoria(allItems as unknown as ItemImageRow[]) as unknown as EngineItem[],
      vetoes
    );
    if (items.length < 3) throw new GenError("closet_vacio");

    // Ancla (Hoy): la prenda fijada debe estar disponible para el motor aunque
    // esté vetada o de otra temporada — es elección explícita de la usuaria. Si
    // la prenda ya no existe (borrada), cae a sin-ancla.
    let seedItemId: string | null =
      typeof body.seedItemId === "string" ? body.seedItemId : null;
    if (seedItemId && !items.some((i) => i.id === seedItemId)) {
      const original = allItems.find((i) => i.id === seedItemId);
      if (original) items.push(original);
      else seedItemId = null;
    }

    const weather: Weather | null = await resolveWeather(body);

    const objective =
      typeof body.objective === "string" && body.objective in OBJECTIVES
        ? body.objective
        : profile.last_objective;
    if (objective && objective !== profile.last_objective) {
      await supabase.from("profiles").update({ last_objective: objective }).eq("id", userId);
    }

    const ctx: EngineContext = {
      gender: profile.gender as "hombre" | "mujer" | null,
      objective,
      plan: typeof body.plan === "string" ? body.plan.slice(0, 200) : null,
      lifestyle: lifestyleSummary(profile.lifestyle as LifestyleAnswers | null),
      tasteTags: (profile.taste_tags ?? []) as string[],
      archetype:
        (profile.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
      season: profile.palette_season as Season | null,
      flow: profile.palette_flow as Season | null,
      // Agrupado por categoría + barajado por llamada (anti sesgo posicional).
      items: orderClosetForEngine(items),
      weather,
      recentCombos: (recentRes.data ?? []).map((o) => o.item_ids as string[]),
      vetoes: vetoLabels(vetoes),
      timeOfDay: body.momento === "noche" ? "noche" : body.momento === "dia" ? "dia" : null,
      silueta: siluetaPromptLine(
        profile.body_build as Build | null,
        profile.body_volume as Volume | null
      ),
      ageStyling: ageStylingLine(profile.age_range as AgeRange | null),
      tasteSignal,
      seedItemId,
      formality: typeof body.formality === "string" ? body.formality : null,
      styleReference: styleReferenceForEngine(profile.style_reference),
      styleWords: (profile.style_words as string | null) ?? null,
    };
    const startedAt = Date.now();
    const candidates = await generateOutfits(ctx);
    const result = await reviewOutfit(ctx, candidates[0], []);
    const elegido = result.outfit;

    const { error: upErr } = await supabase
      .from("outfits")
      .update({
        item_ids: elegido.item_ids,
        occasion: objective ?? "diario",
        weather,
        title: elegido.nombre,
        explanation: elegido.explicacion,
        tip: elegido.tip ?? null,
        gen_status: "ready",
        gen_error: null,
      })
      .eq("id", outfitId)
      .eq("user_id", userId);
    if (upErr) throw new GenError("no_pude_guardar");

    await supabase.from("events").insert([
      {
        user_id: userId,
        type: "generation_timing",
        data: {
          ms: Date.now() - startedAt,
          prompt_version: PROMPT_VERSION,
          look_of_day: true,
          anchored: !!seedItemId, // ¿usó ancla? (medir adopción de la feature)
        },
      },
      {
        user_id: userId,
        type: "critic_review",
        data: {
          gender: profile.gender,
          prompt_version: PROMPT_VERSION,
          look_of_day: true,
          rejected: result.verdict === "rechazado" ? 1 : 0,
          regenerated: 0,
          changes: [
            {
              before: candidates[0].item_ids,
              after: elegido.item_ids,
              changed: elegido.item_ids.join(",") !== candidates[0].item_ids.join(","),
              verdict: result.verdict,
              razon: result.razon,
              shown: true,
            },
          ],
        },
      },
    ]);
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
      const attrs = (i.attrs ?? {}) as { nombre?: string; color_hex?: string };
      return [
        i.id as string,
        {
          nombre: arch?.name ?? attrs.nombre ?? "Prenda",
          swatch: attrs.color_hex ?? "#E5E1DD",
          imagen: itemImageUrlSync(i as ItemImageRow, (p) => signed.get(p)),
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
