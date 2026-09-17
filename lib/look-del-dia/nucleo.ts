import type { SupabaseClient } from "@supabase/supabase-js";
import { ciudadDeCoordenadas, conCiudad } from "@/lib/tryon-escena";
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
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import {
  resolveWeather,
  getWeatherForDates,
  getWeatherParaMomento,
  esMomento,
  climaParaElMotor,
  hayLluvia,
  type Weather,
} from "@/lib/weather";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { registrarEvento } from "@/lib/telemetria";
import { tituloLimpio } from "@/lib/engine/titulo";
import { esCombinacionRepetida } from "@/lib/engine/combinacion-repetida";

// EL NÚCLEO DEL LOOK DEL DÍA (y del look planeado para otra fecha).
//
// Vivía entero dentro de app/api/look-of-day/route.ts. Salió de ahí el
// 2026-09-16 cuando "arma mi semana" (app/api/semana) necesitó generar looks
// planeados en fila: un archivo de ruta de Next no puede exportar nada que no
// sea un método HTTP, y la alternativa —copiar generateInto— es la duplicación
// del motor que CLAUDE.md prohíbe (ya derivó una vez entre dos rutas).
// Lo que se movió no cambió de comportamiento: mismo código, otra casa.


// Un look "generating" más viejo que esto se considera muerto (el background se
// cayó) → el cliente puede reintentar.
export const STALE_MS = 150_000;

export type Body = {
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
  /** Sólo /api/semana: la ocasión es de ESE día, no se guarda en el perfil. */
  noPersistirObjetivo?: boolean;
};


export const todayStr = () => new Date().toISOString().slice(0, 10);

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// El "hoy" REAL: la fecha local del cliente si viene y es sana (±3 días del
// reloj del server — un cliente con el reloj roto no manda el look a 2019);
// si no, la del server como antes.
export function fechaLocalDe(body: Body): string {
  const f = body.fechaLocal;
  if (typeof f === "string" && DATE_RE.test(f)) {
    const diff = Math.abs(new Date(f + "T12:00:00Z").getTime() - Date.now());
    if (diff < 3 * 86_400_000) return f;
  }
  return todayStr();
}

// La fecha planeada, validada: futura (hoy o pasado caen al flujo normal) y
// dentro del horizonte del pronóstico. Inválida = null = flujo de hoy.
export function plannedForDe(body: Body, hoy: string): string | null {
  const p = body.plannedFor;
  if (typeof p !== "string" || !DATE_RE.test(p)) return null;
  if (p <= hoy) return null; // los strings ISO comparan bien lexicográficamente
  const dias =
    (new Date(p + "T00:00:00Z").getTime() - new Date(hoy + "T00:00:00Z").getTime()) /
    86_400_000;
  return dias > 16 ? null : p;
}


/** Los dos eventos de instrumentación de una generación del look de hoy. Es el
 *  camino que corre solo, en background y todos los días — o sea el que más
 *  barato sale de olvidar y más caro sale de no ver. Compartido por el camino
 *  single (plannedFor) y el del trío para que ninguno se quede sin recibo. */
export async function registrarEventos(
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
  await registrarEvento(supabase, [
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


export function isStale(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t > STALE_MS;
}


/**
 * Las anclas que trae la petición, en la forma nueva o en la vieja.
 *
 * Un helper y no dos lecturas sueltas porque el cuerpo se lee en DOS puntas —el
 * gate de ocasión y la generación— y si una entendiera `seedItemIds` y la otra
 * sólo `seedItemId`, un cliente sin recargar pasaría el gate con una prenda y
 * generaría sin ninguna. Ése es el tipo de desincronía que no truena: sólo
 * devuelve un look que ignora lo que la persona pidió.
 */
export function anclasDe(body: Body): string[] {
  if (Array.isArray(body.seedItemIds)) {
    return body.seedItemIds.filter((x): x is string => typeof x === "string" && !!x);
  }
  return typeof body.seedItemId === "string" && body.seedItemId ? [body.seedItemId] : [];
}


// Error de generación con código para mostrar al usuario.
export class GenError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// El trabajo pesado: lee el contexto, genera + revisa, y ESCRIBE el resultado en
// el placeholder (ready) o marca el error. Corre en background (after()).
export async function generateInto(
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
    // Y SI DIJO PARA CUÁNDO, EL CLIMA DE ESAS HORAS. Mismo criterio que el
    // wizard (ver lib/weather): un look de noche no se arma con el promedio del
    // día entero.
    //
    // OJO — HOY ESTA RAMA NO SE EJERCITA, y se deja a propósito. `LookInput` es
    // `{...} & ({lat,lon} | {weather})` y el wizard SIEMPRE toma la segunda: su
    // `armar()` no sale sin banda de clima, así que `manual` llega en true y
    // todo cae en `resolveWeather`. El arreglo de Val vive entero del lado del
    // cliente. Esto existe porque la rama de `getWeatherForDates` de aquí abajo
    // ya existía con la misma condición: si algún día alguien manda coords sin
    // clima, las dos puertas tienen que decidir IGUAL. Dejar sólo una
    // actualizada es la divergencia silenciosa que este repo ya pagó con la
    // lluvia del wizard contra la del motor.
    //
    // OJO al escribirlo: `body.lat` / `body.lon` van LITERALES, sin
    // destructurar. contrato-wizard-rutas.test.ts lee el código de esta ruta
    // como texto para verificar que ningún campo del wizard se pierda en
    // silencio, y un `const { lat, lon } = body` lo deja ciego.
    const weather: Weather | null =
      !manual && typeof body.lat === "number" && typeof body.lon === "number"
        ? esMomento(body.momento)
          ? await getWeatherParaMomento(
              body.lat,
              body.lon,
              plannedFor ?? fechaLocalDe(body),
              body.momento
            )
          : plannedFor
            ? await getWeatherForDates(body.lat, body.lon, plannedFor, plannedFor)
            : await resolveWeather(body)
        : await resolveWeather(body);

    const seedItemIds = anclasDe(body);

    // "Arma mi semana" manda una ocasión POR DÍA: si cada día se guardara como
    // last_objective, el wizard de Inicio amanecería con la del último día de
    // la fila (un viernes de trabajo), no con la que la persona eligió.
    const objective =
      body.noPersistirObjetivo === true
        ? typeof body.objective === "string" && body.objective in OBJECTIVES
          ? body.objective
          : null
        : await resolverYPersistirObjetivo(supabase, profile, body.objective, userId, OBJECTIVES);

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
      weather: conCiudad(
        techado && hayLluvia(weather?.condition) ? { ...weather, techado: true } : weather,
        ciudadDeCoordenadas(body.lat, body.lon)
      ),
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
      // NO REPETIR UN LOOK RECIENTE, en código (lib/engine/combinacion-repetida).
      // El generador devuelve 2-3 candidatos y antes se tomaba siempre el
      // primero; ahora el primero que no repita un conjunto de los últimos 14
      // días. Se revisa DESPUÉS del juez, que puede cambiar prendas. Si todos
      // repiten, se queda el primero, como antes: un look repetido es mejor
      // que ninguno. "Arma mi semana" depende de esto: cada día ve los
      // anteriores en recentCombos.
      let candidato = candidates[0];
      let result = await reviewOutfit(ctx, candidato, [], false, {}, quien);
      for (const otro of candidates.slice(1)) {
        if (!esCombinacionRepetida(result.outfit.item_ids, ctx.recentCombos)) break;
        if (esCombinacionRepetida(otro.item_ids, ctx.recentCombos)) continue;
        const intento = await reviewOutfit(ctx, otro, [], false, {}, quien);
        // Un look que el juez rechazó no le gana a uno aprobado sólo por ser
        // nuevo: repetir un buen look es mejor que estrenar uno malo.
        if (intento.verdict === "rechazado" && result.verdict !== "rechazado") continue;
        if (!esCombinacionRepetida(intento.outfit.item_ids, ctx.recentCombos)) {
          candidato = otro;
          result = intento;
        }
      }
      const elegido = result.outfit;

      const { error: upErr } = await supabase
        .from("outfits")
        .update({
          item_ids: elegido.item_ids,
          ...camposComunes,
          title: tituloLimpio(elegido.nombre),
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
            before: candidato.item_ids,
            after: elegido.item_ids,
            changed: elegido.item_ids.join(",") !== candidato.item_ids.join(","),
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
                title: tituloLimpio(outfit.nombre),
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
            title: tituloLimpio(outfit.nombre),
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
export async function shape(
  supabase: SupabaseClient,
  o: {
    id: string;
    item_ids: unknown;
    title: string | null;
    explanation: string;
    tip?: string | null;
    /** Pídelos en el select. Sin ellos el look llega sin render y sin corazón:
     *  así se perdía el render del look 2 (ver el comentario del return). */
    tryon_path?: string | null;
    favorited_at?: string | null;
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
    .concat(o.tryon_path ?? null)
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
    // EL RENDER Y EL CORAZÓN VIAJAN AQUÍ (2026-09-16). Antes `shape` sólo daba
    // prendas y textos, y el render lo firmaba aparte la carga inicial de /hoy
    // — que sólo carga el look principal. Los alternos (el "2" de "te armé 2
    // looks") salen de aquí, así que llegaban SIEMPRE sin render: Roberto
    // generó el del look 2 "varias veces" y cada vez que volvía tenía que
    // picarle otra vez. (No se pagaba de más: /api/tryon ve que el render ya
    // existe y lo devuelve cacheado. Lo que se perdía era la pantalla.)
    tryon: o.tryon_path ? signed.get(o.tryon_path) ?? null : null,
    favorited: !!o.favorited_at,
    prendas: itemIds.map((id) => ({
      id,
      nombre: byId.get(id)?.nombre ?? "Prenda",
      swatch: byId.get(id)?.swatch ?? "#E5E1DD",
      imagen: byId.get(id)?.imagen ?? null,
    })),
  };
}
