import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { armarLooks } from "@/lib/engine/pipeline";
import type { GeneratedOutfit } from "@/lib/engine/generate";
import {
  cargarBaseDelMotor,
  construirContexto,
  recortarPlan,
  resolverYPersistirObjetivo,
} from "@/lib/engine/contexto";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import {
  resolveWeather,
  climaParaElMotor,
  hayLluvia,
  type Weather,
} from "@/lib/weather";
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
    /**
     * QUÉ evento es y QUÉ TAN formal — las dos preguntas del paso de detalle
     * del wizard (lib/eventos.ts, lib/formalidad.ts).
     *
     * Estaban SIN DECLARAR hasta 2026-08-12, y esa omisión no fallaba: el
     * wizard las mandaba dentro de LookInput, llegaban por la red y aquí se
     * caían al piso en silencio, porque `body` está tipado a mano y lo que no
     * se nombra no existe. Resultado: en el onboarding podías decir "una boda"
     * y "formal" y recibir el look de un martes cualquiera — en el PRIMER look
     * de tu vida en la app, que es el que decide si vuelves.
     *
     * El hermano de este bug vivía en el CTA del home (devolvía el look
     * cacheado ignorando la ocasión recién elegida) y se arregló en 0.2.223.0.
     * Los dos son la misma forma: el wizard pregunta y la ruta no escucha.
     */
    formality?: string;
    tipoEvento?: string;
    paraguas?: boolean;
    /** Va a estar bajo techo: al motor no le llega la lluvia (climaParaElMotor). */
    techado?: boolean;
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
      // SI LA PERSONA SE VA, LA GENERACIÓN SIGUE Y TERMINA BIEN.
      //
      // Antes `send` escribía al controlador a pelo. Cuando el cliente cierra la
      // conexión —cambiar de app en iOS, bloquear la pantalla, tocar atrás— el
      // controlador queda cerrado y el PRIMER send posterior lanza
      // "Invalid state: Controller is already closed". Eso abortaba la corrida
      // a media faena: los outfits ya guardados se quedaban ahí, pero la cola
      // —el juez, los tiempos, y sobre todo el cierre del paso 5— nunca corría.
      //
      // Es exactamente lo que le pasó a Roberto hoy a las 15:17, deducido
      // entonces por lo que FALTABA y confirmado a las 18:27 con el evento
      // generation_failed: "Invalid state: Controller is already closed",
      // paso 4. Y era caro: lo dejaba atrapado en el paso 4 con looks huérfanos.
      //
      // Ahora escribir es best-effort. Si ya no hay nadie al otro lado, se
      // apunta y se sigue: el trabajo se termina y se guarda, que es lo que hace
      // que al volver encuentre sus looks en vez de una regeneración pagada.
      let cerrado = false;
      const send = (obj: unknown) => {
        if (cerrado) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          cerrado = true;
        }
      };
      /** Cerrar dos veces también lanza; el finally no puede ser quien rompa. */
      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        try {
          cerrar();
        } catch {
          /* ya estaba cerrado por el cliente */
        }
      };
      // El aborto del cliente llega por aquí antes que cualquier enqueue.
      request.signal?.addEventListener("abort", () => {
        cerrado = true;
      });

      // FUERA del try: el catch lo necesita para decir en qué punto del
      // onboarding se rompió, y `profile` se destructura dentro.
      let pasoOnboarding: number | null = null;

      try {
        const startedAt = Date.now();
        send({ phase: "leyendo tu clóset…" });

        const carga = await cargarBaseDelMotor(supabase, user.id);
        if ("error" in carga) {
          send({ error: "closet_vacio" });
          cerrar();
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
        // Bajo techo la lluvia no le llega al motor: solo la temperatura (el
        // porqué vive en climaParaElMotor). Lo que se guarda sigue siendo real.
        const techado = body.techado === true;
        const ctx = construirContexto(base, {
          objective,
          plan: typeof body.plan === "string" ? body.plan : null,
          momento: typeof body.momento === "string" ? body.momento : null,
          // Sin estas dos líneas el paso de detalle del wizard no sirve de nada
          // aquí: `construirContexto` sabe recibirlas desde siempre (:189, :217)
          // y era esta ruta la que no se las daba. La boda pedía traje y el
          // motor armaba un martes.
          formality: typeof body.formality === "string" ? body.formality : null,
          tipoEvento: typeof body.tipoEvento === "string" ? body.tipoEvento : null,
          weather: climaParaElMotor(weather, techado),
          // Solo cuenta si de verdad llueve: un "sí llevo paraguas" con sol no
          // debe soltarle la mano a la capa exterior.
          paraguas: body.paraguas === true && !techado,
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
              // El plan en sus palabras, con el mismo recorte que vio el motor
              // (migración 0132). Aquí importa el doble: es el PRIMER look, la
              // única muestra que hay de cómo pide las cosas alguien que
              // todavía no aprendió a usar la app.
              plan: recortarPlan(body.plan),
              // El clima REAL, con la marca de que se pidió bajo techo. La marca
              // es para DIAGNÓSTICO (consultar la tabla), no se muestra todavía
              // en ninguna pantalla — mismo caso que en /api/look-of-day.
              weather:
                techado && hayLluvia(weather?.condition)
                  ? { ...weather, techado: true }
                  : weather,
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
          cerrar();
          return;
        }
        if (finalized.length === 0) {
          send({ error: "no_pude_guardar" });
          cerrar();
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
        cerrar();
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
