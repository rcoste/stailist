import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOutfits } from "@/lib/engine/generate";
import { reviewOutfits } from "@/lib/engine/critic";
import { type EngineContext } from "@/lib/engine/prompt";
import { OBJECTIVES } from "@/app/onboarding/objetivo/objectives";
import { PROMPT_VERSION, type EngineItem } from "@/lib/engine/prompt";
import { resolveWeather, type Weather } from "@/lib/weather";
import type { Season } from "@/lib/colorimetria";

export const maxDuration = 60;

// Genera (o devuelve) el "look de hoy": UN outfit marcado como el del día.
// 1 por día — re-abrir no regenera; solo "otro look" (force) genera otro,
// quitándole el flag al anterior (que queda en el historial).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: {
    lat?: number;
    lon?: number;
    weather?: { temp_c?: number; condition?: string };
    objective?: string;
    force?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    // sin body = sin clima
  }
  const { force } = body;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        // Salvaguarda anti doble-generación: si ya hay look de hoy y no es
        // "otro look", devuélvelo en vez de gastar otra llamada.
        if (!force) {
          const { data: existing } = await supabase
            .from("outfits")
            .select("id, item_ids, title, explanation")
            .eq("user_id", user.id)
            .eq("is_look_of_day", true)
            .eq("look_date", today)
            .maybeSingle();
          if (existing) {
            const { data: items } = await supabase
              .from("items")
              .select("id, attrs")
              .in("id", existing.item_ids as string[]);
            send({ done: true, outfit: shape(existing, items ?? []) });
            controller.close();
            return;
          }
        }

        send({ phase: "leyendo tu clóset…" });
        const startedAt = Date.now();

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

        send({ phase: "viendo el clima de tu día…" });
        const weather: Weather | null = await resolveWeather(body);

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

        send({ phase: "afinando el styling…" });
        const outfits = await reviewOutfits(
          ctx,
          candidates,
          profile.gender as "hombre" | "mujer" | null
        );
        const elegido = outfits[0]; // el look del día es uno solo

        // "Otro look": el look de hoy anterior pierde el flag (sigue en
        // historial), para respetar el índice único (user, look_date).
        await supabase
          .from("outfits")
          .update({ is_look_of_day: false })
          .eq("user_id", user.id)
          .eq("is_look_of_day", true)
          .eq("look_date", today);

        const { data: saved, error: saveError } = await supabase
          .from("outfits")
          .insert({
            user_id: user.id,
            item_ids: elegido.item_ids,
            occasion: objective ?? "diario",
            weather,
            title: elegido.nombre,
            explanation: elegido.explicacion,
            prompt_version: PROMPT_VERSION,
            is_look_of_day: true,
            look_date: today,
          })
          .select("id, item_ids, title, explanation")
          .single();
        if (saveError || !saved) {
          send({ error: "no_pude_guardar" });
          controller.close();
          return;
        }

        await supabase.from("events").insert([
          {
            user_id: user.id,
            type: "generation_timing",
            data: {
              ms: Date.now() - startedAt,
              prompt_version: PROMPT_VERSION,
              look_of_day: true,
            },
          },
          {
            user_id: user.id,
            type: "critic_review",
            data: {
              gender: profile.gender,
              prompt_version: PROMPT_VERSION,
              look_of_day: true,
              changes: outfits.map((o, i) => ({
                before: candidates[i]?.item_ids ?? null,
                after: o.item_ids,
                changed: candidates[i]
                  ? o.item_ids.join(",") !== candidates[i].item_ids.join(",")
                  : true,
              })),
            },
          },
        ]);

        send({ done: true, outfit: shape(saved, items) });
      } catch (err) {
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

// Da forma a un outfit + sus prendas (con foto) para el cliente.
function shape(
  o: { id: string; item_ids: unknown; title: string | null; explanation: string },
  items: { id: string; attrs: unknown }[]
) {
  const byId = new Map(
    items.map((i) => [
      i.id,
      i.attrs as {
        nombre?: string;
        color_hex?: string;
        image_path?: string | null;
      },
    ])
  );
  return {
    id: o.id,
    nombre: o.title ?? "Tu look",
    explicacion: o.explanation,
    prendas: (o.item_ids as string[]).map((id) => ({
      nombre: byId.get(id)?.nombre ?? "Prenda",
      swatch: byId.get(id)?.color_hex ?? "#E5E1DD",
      imagen: byId.get(id)?.image_path ?? null,
    })),
  };
}
