import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createTokenClient } from "@/lib/supabase/server";
import { generateOutfits } from "@/lib/engine/generate";
import { reviewOutfit } from "@/lib/engine/critic";
import { type EngineContext } from "@/lib/engine/prompt";
import { OBJECTIVES } from "@/app/onboarding/objetivo/objectives";
import { PROMPT_VERSION, type EngineItem } from "@/lib/engine/prompt";
import { resolveWeather, type Weather } from "@/lib/weather";
import type { Season } from "@/lib/colorimetria";
import { lifestyleSummary, type LifestyleAnswers } from "@/lib/capsule";
import { applyVetoes, vetoLabels, EMPTY_VETOES, type StyleVetoes } from "@/lib/vetoes";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";

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
  const today = todayStr();

  // ¿Ya hay look de hoy? Si está listo y no es "otro look", devuélvelo. Si está
  // generándose (y no muerto), devuelve su id para que el cliente siga el polling.
  if (!force) {
    const { data: existing } = await supabase
      .from("outfits")
      .select("id, item_ids, title, explanation, tip, gen_status, created_at")
      .eq("user_id", user.id)
      .eq("is_look_of_day", true)
      .eq("look_date", today)
      .maybeSingle();
    if (existing) {
      const status = (existing.gen_status as string | null) ?? "ready";
      if (status === "ready") {
        const { data: items } = await supabase
          .from("items")
          .select("id, attrs")
          .in("id", existing.item_ids as string[]);
        return NextResponse.json({
          outfitId: existing.id,
          status: "ready",
          outfit: shape(existing, items ?? []),
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
  const { data: items } = await supabase
    .from("items")
    .select("id, attrs")
    .in("id", o.item_ids as string[]);
  return NextResponse.json({ status: "ready", outfit: shape(o, items ?? []) });
}

function isStale(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t > STALE_MS;
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
    const [profileRes, itemsRes, recentRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("items").select("id, attrs").eq("user_id", userId).is("deleted_at", null),
      supabase
        .from("outfits")
        .select("item_ids")
        .eq("user_id", userId)
        // Solo combos COMPLETOS (legacy null o 'ready'); nunca placeholders.
        .or("gen_status.is.null,gen_status.eq.ready")
        .gte("created_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()),
    ]);

    const profile = profileRes.data;
    if (!profile) throw new GenError("closet_vacio");
    const vetoes = (profile.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;
    const { items } = applyVetoes((itemsRes.data ?? []) as EngineItem[], vetoes);
    if (items.length < 3) throw new GenError("closet_vacio");

    const weather: Weather | null = await resolveWeather(body);

    const objective =
      typeof body.objective === "string" && body.objective in OBJECTIVES
        ? body.objective
        : profile.last_objective;
    if (objective && objective !== profile.last_objective) {
      await supabase.from("profiles").update({ last_objective: objective }).eq("id", userId);
    }

    const ctx: EngineContext = {
      objective,
      plan: typeof body.plan === "string" ? body.plan.slice(0, 200) : null,
      lifestyle: lifestyleSummary(profile.lifestyle as LifestyleAnswers | null),
      tasteTags: (profile.taste_tags ?? []) as string[],
      archetype:
        (profile.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
      season: profile.palette_season as Season | null,
      flow: profile.palette_flow as Season | null,
      items,
      weather,
      recentCombos: (recentRes.data ?? []).map((o) => o.item_ids as string[]),
      vetoes: vetoLabels(vetoes),
      timeOfDay: body.momento === "noche" ? "noche" : body.momento === "dia" ? "dia" : null,
      silueta: siluetaPromptLine(
        profile.body_build as Build | null,
        profile.body_volume as Volume | null
      ),
    };
    const startedAt = Date.now();
    const candidates = await generateOutfits(ctx);
    const result = await reviewOutfit(
      ctx,
      candidates[0],
      [],
      profile.gender as "hombre" | "mujer" | null
    );
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
        data: { ms: Date.now() - startedAt, prompt_version: PROMPT_VERSION, look_of_day: true },
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

// Da forma a un outfit + sus prendas (con foto) para el cliente.
function shape(
  o: {
    id: string;
    item_ids: unknown;
    title: string | null;
    explanation: string;
    tip?: string | null;
  },
  items: { id: string; attrs: unknown }[]
) {
  const byId = new Map(
    items.map((i) => [
      i.id,
      i.attrs as { nombre?: string; color_hex?: string; image_path?: string | null },
    ])
  );
  return {
    id: o.id,
    nombre: o.title ?? "Tu look",
    explicacion: o.explanation,
    tip: o.tip ?? null,
    prendas: (o.item_ids as string[]).map((id) => ({
      nombre: byId.get(id)?.nombre ?? "Prenda",
      swatch: byId.get(id)?.color_hex ?? "#E5E1DD",
      imagen: byId.get(id)?.image_path ?? null,
    })),
  };
}
