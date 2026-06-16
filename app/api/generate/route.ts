import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOutfits } from "@/lib/engine/generate";
import { reviewOutfit } from "@/lib/engine/critic";
import {
  PROMPT_VERSION,
  type EngineItem,
  type EngineContext,
} from "@/lib/engine/prompt";
import { resolveWeather, type Weather } from "@/lib/weather";
import type { Season } from "@/lib/colorimetria";
import { OBJECTIVES } from "@/app/onboarding/objetivo/objectives";

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

        const [profileRes, itemsRes, recentRes] = await Promise.all([
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
        ]);

        const profile = profileRes.data;
        const items = (itemsRes.data ?? []) as EngineItem[];
        if (!profile || items.length < 3) {
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
        };
        const candidates = await generateOutfits(ctx);

        // El cliente mostrará N outfits con placeholders mientras llegan.
        send({ total: candidates.length });

        const gender = profile.gender as "hombre" | "mujer" | null;
        const itemById = new Map(items.map((i) => [i.id, i.attrs]));
        const finalized: typeof candidates = [];
        const changes: { before: string[]; after: string[]; changed: boolean }[] =
          [];

        // 2ª pasada POR OUTFIT: el juez (Sonnet) revisa y se va mostrando cada
        // uno apenas está, para esconder la latencia detrás del reveal.
        for (let i = 0; i < candidates.length; i++) {
          send({
            phase: i === 0 ? "afinando el styling…" : "armando el siguiente…",
          });
          const reviewed = await reviewOutfit(ctx, candidates[i], finalized, gender);

          const { data: row, error: saveError } = await supabase
            .from("outfits")
            .insert({
              user_id: user.id,
              item_ids: reviewed.item_ids,
              occasion: objective ?? "diario",
              weather,
              title: reviewed.nombre,
              explanation: reviewed.explicacion,
              prompt_version: PROMPT_VERSION,
            })
            .select("id, item_ids, title, explanation")
            .single();
          if (saveError || !row) continue; // si uno falla, seguimos con los demás

          finalized.push(reviewed);
          changes.push({
            before: candidates[i].item_ids,
            after: reviewed.item_ids,
            changed:
              reviewed.item_ids.join(",") !== candidates[i].item_ids.join(","),
          });
          send({
            index: i,
            outfit: {
              id: row.id,
              nombre: row.title ?? "Tu look",
              explicacion: row.explanation,
              prendas: (row.item_ids as string[]).map((id) => ({
                nombre: itemById.get(id)?.nombre ?? "Prenda",
                swatch: itemById.get(id)?.color_hex ?? "#E5E1DD",
                imagen: itemById.get(id)?.image_path ?? null,
              })),
            },
          });
        }

        if (finalized.length === 0) {
          send({ error: "no_pude_guardar" });
          controller.close();
          return;
        }
        const repaired = changes.filter((c) => c.changed).length;

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
              repaired,
              prompt_version: PROMPT_VERSION,
              // Antes/después por outfit: qué combinación tocó el juez. Cruzado
              // con las razones del 👎, es el dato para optimizar el prompt.
              changes,
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
