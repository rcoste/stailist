import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOutfits, type GeneratedOutfit } from "@/lib/engine/generate";
import { reviewOutfit, type CriticVerdict } from "@/lib/engine/critic";
import {
  PROMPT_VERSION,
  type EngineItem,
  type EngineContext,
} from "@/lib/engine/prompt";
import { resolveWeather, type Weather } from "@/lib/weather";
import type { Season } from "@/lib/colorimetria";
import { OBJECTIVES } from "@/app/onboarding/objetivo/objectives";
import { lifestyleSummary, type LifestyleAnswers } from "@/lib/capsule";
import { applyVetoes, vetoLabels, EMPTY_VETOES, type StyleVetoes } from "@/lib/vetoes";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import { loadTasteSignal } from "@/lib/engine/taste-signal";
import { styleReferenceForEngine } from "@/lib/estilo-referencia";

// Dentro del límite de 60s de Vercel Hobby. El retry es SIEMPRE client-side
// (petición nueva) — nunca reintentamos aquí adentro.
export const maxDuration = 60;

// Respuesta NDJSON (una línea JSON por evento): primero fases de progreso,
// al final {done} con los outfits o {error}. El streaming mantiene viva la
// conexión mientras el modelo piensa.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  let body: {
    lat?: number;
    lon?: number;
    weather?: { temp_c?: number; condition?: string };
    objective?: string;
    plan?: string;
    momento?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    // sin body = sin clima, no pasa nada
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const startedAt = Date.now();
        send({ phase: "leyendo tu clóset…" });

        const [profileRes, itemsRes, recentRes, tasteSignal] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase
            .from("items")
            .select("id, attrs")
            .eq("user_id", user.id)
            .is("deleted_at", null),
          supabase
            .from("outfits")
            .select("item_ids")
            .eq("user_id", user.id)
            .gte(
              "created_at",
              new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
            ),
          loadTasteSignal(supabase, user.id),
        ]);

        const profile = profileRes.data;
        if (!profile) {
          send({ error: "closet_vacio" });
          controller.close();
          return;
        }
        // Vetos (issue #2): quita las prendas vetadas ANTES del check de mínimo,
        // para que vetar hacia un clóset corto caiga al estado de "insuficiente".
        const vetoes = (profile.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;
        const { items } = applyVetoes(
          (itemsRes.data ?? []) as EngineItem[],
          vetoes
        );
        if (items.length < 3) {
          send({ error: "closet_vacio" });
          controller.close();
          return;
        }

        send({ phase: "combinando colores…" });
        const weather: Weather | null = await resolveWeather(body);

        // Ocasión: la del request si es válida, si no la última guardada.
        const objective =
          typeof body.objective === "string" && body.objective in OBJECTIVES
            ? body.objective
            : profile.last_objective;
        if (objective && objective !== profile.last_objective) {
          await supabase
            .from("profiles")
            .update({ last_objective: objective })
            .eq("id", user.id);
        }

        send({ phase: "afinando para tu paleta…" });
        const ctx: EngineContext = {
          objective,
          plan: typeof body.plan === "string" ? body.plan.slice(0, 200) : null,
          lifestyle: lifestyleSummary(profile.lifestyle as LifestyleAnswers | null),
          tasteTags: (profile.taste_tags ?? []) as string[],
          archetype:
            (profile.style_archetype as {
              nombre: string;
              descripcion: string;
            } | null) ?? null,
          season: profile.palette_season as Season | null,
          flow: profile.palette_flow as Season | null,
          items,
          weather,
          recentCombos: (recentRes.data ?? []).map(
            (o) => o.item_ids as string[]
          ),
          vetoes: vetoLabels(vetoes),
          timeOfDay:
            body.momento === "noche" ? "noche" : body.momento === "dia" ? "dia" : null,
          silueta: siluetaPromptLine(
            profile.body_build as Build | null,
            profile.body_volume as Volume | null
          ),
          tasteSignal,
          styleReference: styleReferenceForEngine(profile.style_reference),
        };
        const candidates = await generateOutfits(ctx);

        // El cliente mostrará N outfits con placeholders mientras llegan.
        send({ total: candidates.length });

        const gender = profile.gender as "hombre" | "mujer" | null;
        const itemById = new Map(items.map((i) => [i.id, i.attrs]));
        const finalized: typeof candidates = [];

        // Registro por outfit para el flywheel: qué pasó con cada candidato.
        type Review = {
          before: string[];
          after: string[];
          changed: boolean;
          verdict: CriticVerdict;
          razon: string | null;
          shown: boolean;
        };
        const reviews: Review[] = [];
        // Rechazados retenidos: solo se muestran si caemos por debajo de 2.
        const held: { outfit: GeneratedOutfit; review: Review }[] = [];
        let slot = 0; // el cliente APPENDea cada outfit; el index es informativo.

        // Guarda en DB + streamea un outfit ya aprobado. Devuelve true si se mostró.
        const saveAndStream = async (outfit: GeneratedOutfit): Promise<boolean> => {
          const { data: row, error: saveError } = await supabase
            .from("outfits")
            .insert({
              user_id: user.id,
              item_ids: outfit.item_ids,
              occasion: objective ?? "diario",
              weather,
              title: outfit.nombre,
              explanation: outfit.explicacion,
              tip: outfit.tip ?? null,
              prompt_version: PROMPT_VERSION,
            })
            .select("id, item_ids, title, explanation, tip")
            .single();
          if (saveError || !row) return false;

          finalized.push(outfit);
          send({
            index: slot++,
            outfit: {
              id: row.id,
              nombre: row.title ?? "Tu look",
              explicacion: row.explanation,
              tip: row.tip ?? null,
              prendas: (row.item_ids as string[]).map((id) => ({
                nombre: itemById.get(id)?.nombre ?? "Prenda",
                swatch: itemById.get(id)?.color_hex ?? "#E5E1DD",
                imagen: itemById.get(id)?.image_path ?? null,
              })),
            },
          });
          return true;
        };

        // 2ª pasada POR OUTFIT: el juez (Sonnet) revisa y se va mostrando cada
        // uno apenas se aprueba, para esconder la latencia detrás del reveal.
        // Si el juez RECHAZA (irreparable con este clóset), lo retenemos: solo
        // lo mostramos al final si nos quedaríamos con menos de 2 looks.
        for (let i = 0; i < candidates.length; i++) {
          send({
            phase: i === 0 ? "afinando el styling…" : "armando el siguiente…",
          });
          const result = await reviewOutfit(ctx, candidates[i], finalized, gender);
          const review: Review = {
            before: candidates[i].item_ids,
            after: result.outfit.item_ids,
            changed:
              result.outfit.item_ids.join(",") !== candidates[i].item_ids.join(","),
            verdict: result.verdict,
            razon: result.razon,
            shown: false,
          };

          if (result.verdict === "rechazado") {
            held.push({ outfit: result.outfit, review });
            reviews.push(review);
            continue;
          }

          if (await saveAndStream(result.outfit)) review.shown = true;
          reviews.push(review);
        }

        // Piso de 2 looks: si descartar rechazados nos dejó cortos, rellenamos
        // con los retenidos (mejor un look mediocre que menos de 2). #4b: aquí
        // iría una regeneración dirigida en vez de rescatar el rechazado.
        for (const h of held) {
          if (finalized.length >= 2) break;
          if (await saveAndStream(h.outfit)) h.review.shown = true;
        }

        if (finalized.length === 0) {
          send({ error: "no_pude_guardar" });
          controller.close();
          return;
        }
        const repaired = reviews.filter((r) => r.changed).length;
        const rejected = reviews.filter((r) => r.verdict === "rechazado").length;
        const backfilled = reviews.filter(
          (r) => r.verdict === "rechazado" && r.shown
        ).length;

        const elapsedMs = Date.now() - startedAt;

        // Instrumentación + cierre del onboarding si éste era el momento wow.
        const events: Record<string, unknown>[] = [
          {
            user_id: user.id,
            type: "generation_timing",
            data: { ms: elapsedMs, prompt_version: PROMPT_VERSION },
          },
          {
            user_id: user.id,
            type: "critic_review",
            data: {
              gender,
              prompt_version: PROMPT_VERSION,
              repaired, // cuántos reparó el juez (diff de prendas)
              rejected, // cuántos rechazó por irreparables con este clóset
              backfilled, // rechazados que igual mostramos para no bajar de 2
              regenerated: 0, // A no regenera; placeholder para #4b
              // Antes/después + veredicto + razón por outfit. Cruzado con las
              // razones del 👎, es el dato para decidir si #4b (regenerar) vale.
              changes: reviews,
            },
          },
        ];
        if (profile.onboarding_step === 4) {
          const ttvSeconds = Math.round(
            (Date.now() - new Date(profile.created_at).getTime()) / 1000
          );
          events.push(
            {
              user_id: user.id,
              type: "first_outfit_ttv",
              data: { seconds: ttvSeconds },
            },
            {
              user_id: user.id,
              type: "onboarding_step",
              data: { step: 5 },
            }
          );
          await supabase
            .from("profiles")
            .update({
              onboarding_step: 5,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id)
            .eq("onboarding_step", 4);
        }
        await supabase.from("events").insert(events);

        // Los outfits ya se streamearon uno por uno; solo cerramos.
        send({ done: true });
      } catch (err) {
        console.error("[generate] fallo:", err);
        const message = err instanceof Error ? err.message : "desconocido";
        send({
          error:
            message === "ENGINE_NOT_CONNECTED" ? "sin_api_key" : "generacion",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
