import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { armarLooks } from "@/lib/engine/pipeline";
import type { GeneratedOutfit } from "@/lib/engine/generate";
import {
  cargarBaseDelMotor,
  construirContexto,
  resolverYPersistirObjetivo,
} from "@/lib/engine/contexto";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import { resolveWeather, type Weather } from "@/lib/weather";
import { OBJECTIVES } from "@/app/onboarding/objetivo/objectives";
import {
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";

// Dentro del límite de 60s de Vercel Hobby. El retry es SIEMPRE client-side
// (petición nueva) — nunca reintentamos aquí adentro.
export const maxDuration = 60;

// Respuesta NDJSON (una línea JSON por evento): primero fases de progreso,
// al final {done} con los outfits o {error}. El streaming mantiene viva la
// conexión mientras el modelo piensa.
//
// La carga del contexto vive en lib/engine/contexto.ts (compartida con el
// look de hoy y el comparador) y el pipeline (generar → juez → piso de 2) en
// lib/engine/pipeline.ts (compartido con el comparador; el look de hoy genera
// UN solo look y no usa este loop): esta ruta solo pone el streaming, el
// guardado y la instrumentación.
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
    paraguas?: boolean;
    workDressCode?: string;
    /** Del día: solo cuenta si su código de trabajo es "variable". */
    veCliente?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    // sin body = sin clima, no pasa nada
  }
  // El código de vestimenta del trabajo se PERSISTE la primera (y única) vez
  // que llega: es de la persona, no de la petición. Se valida aquí porque una
  // route es un endpoint; el CHECK de la columna es la segunda red.
  if (
    typeof body.workDressCode === "string" &&
    ["formal", "business_casual", "casual", "variable"].includes(body.workDressCode)
  ) {
    await supabase
      .from("profiles")
      .update({ work_dress_code: body.workDressCode })
      .eq("id", user.id);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      // FUERA del try: el catch lo necesita para decir en qué punto del
      // onboarding se rompió, y `profile` se destructura dentro.
      let pasoOnboarding: number | null = null;

      try {
        const startedAt = Date.now();
        send({ phase: "leyendo tu clóset…" });

        const carga = await cargarBaseDelMotor(supabase, user.id);
        if ("error" in carga) {
          send({ error: "closet_vacio" });
          controller.close();
          return;
        }
        const { base } = carga;
        const { profile, items } = base;
        pasoOnboarding = Number(profile.onboarding_step) || null;

        send({ phase: "combinando colores…" });
        const weather: Weather | null = await resolveWeather(body);

        // Ocasión: la del request si es válida, si no la última guardada.
        const objective = await resolverYPersistirObjetivo(
          supabase,
          profile,
          body.objective,
          user.id,
          OBJECTIVES
        );

        send({ phase: "afinando para tu paleta…" });
        const ctx = construirContexto(base, {
          objective,
          plan: typeof body.plan === "string" ? body.plan : null,
          momento: typeof body.momento === "string" ? body.momento : null,
          weather,
          // Solo cuenta si de verdad llueve: un "sí llevo paraguas" con sol no
          // debe soltarle la mano a la capa exterior.
          paraguas: body.paraguas === true,
          // NO se persiste: es del día, como el paraguas. Solo cuenta si su código
          // de trabajo es "variable" (el prompt lo ignora en los otros tres).
          veCliente: typeof body.veCliente === "boolean" ? body.veCliente : null,
        });

        const gender = profile.gender as "hombre" | "mujer" | null;

        // Las fotos propias y los renders viven en el bucket privado: hay que
        // firmarlas. Se firman TODAS de una vez aquí y no por outfit, porque
        // esto corre dentro del stream y una petición a Storage por look se
        // notaría como retraso entre carta y carta.
        const privadas = Array.from(
          new Set(items.flatMap((i) => itemPrivatePaths(i as ItemImageRow)))
        );
        const firmadas = new Map<string, string>();
        if (privadas.length > 0) {
          const { data: urls } = await supabase.storage
            .from("prendas")
            .createSignedUrls(privadas, 3600);
          urls?.forEach((u) => {
            if (u.path && u.signedUrl) firmadas.set(u.path, u.signedUrl);
          });
        }
        const itemById = new Map(
          items.map((i) => [
            i.id,
            {
              ...i.attrs,
              imagen: itemImageUrlSync(i as ItemImageRow, (p) => firmadas.get(p)),
            },
          ])
        );

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
                imagen: itemById.get(id)?.imagen ?? null,
              })),
            },
          });
          return true;
        };

        // El pipeline compartido: generar → juez por outfit → piso de 2. Cada
        // look se guarda y streamea apenas se aprueba (hook alAprobar), para
        // esconder la latencia del juez detrás del reveal.
        const { finalized, reviews, noAlcanza } = await armarLooks(ctx, {}, {
          alCandidatos: (n) => send({ total: n }),
          alRevisar: (i) =>
            send({
              phase: i === 0 ? "afinando el styling…" : "armando el siguiente…",
            }),
          alAprobar: saveAndStream,
        });

        // El clóset no da para el código pedido: NO es un fallo, es la
        // respuesta. Va con lo que falta para que la pantalla lo pueda decir.
        if (noAlcanza) {
          send({ error: "no_alcanza", faltan: noAlcanza.faltan });
          controller.close();
          return;
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
            (Date.now() - new Date(profile.created_at as string).getTime()) / 1000
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
        // QUE QUEDE ESCRITO, no sólo en la consola.
        //
        // El 2026-08-09 una corrida guardó 2 outfits y murió antes de la cola.
        // Se pudo deducir por lo que FALTABA (ni critic_review ni
        // generation_timing ni el paso 5), pero el motivo se lo llevó una
        // consola que ya no existe. Un fallo que sólo se puede diagnosticar por
        // ausencia es un fallo que no se puede arreglar.
        //
        // Best-effort y al final: si esto también truena, no puede tapar el
        // error de verdad que le vamos a mandar a la persona.
        await supabase
          .from("events")
          .insert({
            user_id: user.id,
            type: "generation_failed",
            data: { message: message.slice(0, 300), paso: pasoOnboarding },
          })
          .then(undefined, () => {});
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
