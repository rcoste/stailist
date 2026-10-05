import type { SupabaseClient } from "@supabase/supabase-js";
import { llamar, type Modelo, type Peticion, type Recibo } from "@/lib/proveedores";
import { costoUsd } from "@/lib/proveedores/precios";

// GUARDAR EL RECIBO DE UNA LLAMADA DE IA.
//
// POR QUÉ NO VIVE DENTRO DE `llamar()`, que sería lo obvio: `lib/proveedores`
// es la puerta común y la usan también los scripts de terminal y el comparador,
// que no tienen sesión ni cliente de Supabase. Meterle la base la volvería
// inarrancable fuera de una request. Así que el registro es explícito y lo
// decide quien llama.
//
// EL PRECIO DE ESA DECISIÓN, dicho en voz alta: una tarea nueva que se olvide
// de llamar aquí no se instrumenta y nadie se entera. Es el tradeoff aceptado
// a cambio de que la puerta común siga siendo pura.
//
// EL PRECIO SE COBRÓ (2026-08-14). De ~20 caminos de IA en producción, sólo dos
// escribían recibo, y el fallo se registraba en UNO. O sea que la tabla existía,
// costaba una migración, y no podía contestar ninguna de las tres preguntas
// para las que se hizo. Dos remedios, y hacen falta los dos:
//
//   · `medir()` (abajo): llama Y registra en el mismo sitio, éxito o fallo. El
//     olvido posible pasa de "dos líneas fáciles de saltarse" a "usar la
//     función equivocada".
//   · `lib/cobertura-recibos.test.ts`: el candado. Enumera los archivos que
//     hablan con un modelo y exige que cada uno mida o esté declarado exento
//     con su razón. Sin candado, la siguiente tarea vuelve a nacer ciega —
//     que es exactamente lo que pasó aquí.

/**
 * Escribe el recibo. NUNCA lanza.
 *
 * Falla hacia adelante por la misma razón que el guardado del diario en el
 * espejo: la persona está esperando su consejo y un problema de la tabla de
 * instrumentación no puede costarle la respuesta. Si truena, se pierde un
 * renglón de telemetría — que es exactamente lo que se perdía antes de que
 * esta tabla existiera.
 */
export async function guardarRecibo(
  supabase: SupabaseClient,
  args: {
    userId: string;
    /** Qué trabajo se hizo: 'espejo', 'motor', 'vision'… */
    tarea: string;
    modelo: Modelo;
    /** La versión del prompt, si la tarea la versiona. */
    version?: string | null;
    recibo: Recibo;
  }
): Promise<void> {
  try {
    await supabase.from("ai_calls").insert({
      user_id: args.userId,
      tarea: args.tarea,
      proveedor: args.modelo.proveedor,
      modelo: args.modelo.id,
      version: args.version ?? null,
      ms: args.recibo.ms,
      tokens_entrada: args.recibo.tokens.entrada,
      tokens_salida: args.recibo.tokens.salida,
      costo_usd: args.recibo.costoUsd,
      ok: true,
    });
  } catch {
    // sin recibo, pero con respuesta
  }
}

/** A quién y a nombre de qué se le apunta la llamada. */
export type ContextoRecibo = {
  supabase: SupabaseClient;
  userId: string;
  /** Qué trabajo se hizo: 'motor', 'vision-prenda', 'capsula'… */
  tarea: string;
  /** La versión del prompt, si la tarea la versiona. */
  version?: string | null;
};

/**
 * QUIÉN paga la llamada — y NADA más.
 *
 * Es `ContextoRecibo` sin `tarea` ni `version`, y ésa es toda la idea: lo único
 * que la ruta sabe es de quién es la sesión; CÓMO se llama el trabajo y qué
 * versión de prompt lleva lo sabe el módulo que habla con el modelo. Por eso
 * las funciones de `lib/` reciben esto y sellan ellas su tarea al llamar a
 * `medir`.
 *
 * POR QUÉ NO AL REVÉS (que la ruta mande el nombre de la tarea): serían ocho
 * rutas escribiendo string literales para nueve tareas, y la primera vez que
 * alguien escriba "vision_prenda" o "Espejo" el reporte se parte en dos filas
 * que nadie va a notar. El nombre vive UNA vez, junto a la llamada que nombra.
 */
export type QuienMide = Omit<ContextoRecibo, "tarea" | "version">;

/**
 * LLAMAR MIDIENDO. Es `llamar()` de la puerta común, pero deja recibo.
 *
 * Esta es la función que deben usar los caminos de PRODUCCIÓN. La diferencia
 * con llamar+guardarRecibo a mano no es de comodidad: aquí el fallo también se
 * registra, y el fallo es justo lo que se perdía. De los dos únicos sitios
 * instrumentados antes de esto, sólo uno anotaba los errores — así que "¿cada
 * cuánto truena el motor?" no tenía respuesta ni donde sí había datos.
 *
 * `ctx: null` para los caminos que NO son de una persona (comparador, evales,
 * scripts de terminal): no hay sesión con la que insertar —la política de RLS
 * exige que el recibo sea tuyo— y medir una corrida de laboratorio como si
 * fuera uso real ensuciaría los promedios. Es explícito a propósito: pasar
 * `null` es una decisión visible, no un olvido.
 */
export async function medir(
  ctx: ContextoRecibo | null,
  peticion: Peticion
): Promise<Recibo> {
  const t0 = Date.now();
  try {
    const recibo = await llamar(peticion);
    if (ctx) {
      await guardarRecibo(ctx.supabase, {
        userId: ctx.userId,
        tarea: ctx.tarea,
        modelo: peticion.modelo,
        version: ctx.version,
        recibo,
      });
    }
    return recibo;
  } catch (e) {
    if (ctx) {
      await guardarFallo(ctx.supabase, {
        userId: ctx.userId,
        tarea: ctx.tarea,
        modelo: peticion.modelo,
        version: ctx.version,
        ms: Date.now() - t0,
      });
    }
    throw e;
  }
}

/**
 * El recibo de una llamada que TRONÓ.
 *
 * Se guarda aparte y a propósito: cuánto tarda un fallo y cada cuánto ocurre es
 * justo lo que no se puede reconstruir después, y es la mitad de la respuesta a
 * "¿cuánto tarda esta tarea?" — un promedio que sólo cuenta los éxitos miente
 * en la dirección optimista.
 */
export async function guardarFallo(
  supabase: SupabaseClient,
  args: { userId: string; tarea: string; modelo: Modelo; version?: string | null; ms: number }
): Promise<void> {
  try {
    await supabase.from("ai_calls").insert({
      user_id: args.userId,
      tarea: args.tarea,
      proveedor: args.modelo.proveedor,
      modelo: args.modelo.id,
      version: args.version ?? null,
      ms: args.ms,
      ok: false,
    });
  } catch {
    // ni recibo ni nada que hacer
  }
}

// ─── EL RECIBO DE UNA IMAGEN ─────────────────────────────────────────────────
//
// Aparte de `medir()` porque una imagen no pasa por `llamar()`: `pedirImagen`
// habla con Gemini por fetch directo (tiene su propio reintento, su timeout y
// su presupuesto) y no produce un `Recibo` con tokens. Lo que sí produce es lo
// único que importa para el costo: qué modelo, cuánto tardó, y si salió.
//
// Los tokens quedan en null a propósito. Poner 1120 —los que Google dice que
// consume una imagen de 1K— haría que el panel sumara "tokens" comparables con
// los de texto y el promedio de tokens por llamada dejaría de significar nada.
// El costo, que es la pregunta real, sí se guarda.

/** Escribe el recibo de una imagen generada. NUNCA lanza (ver guardarRecibo). */
export async function guardarReciboImagen(
  supabase: SupabaseClient,
  args: {
    userId: string;
    /** 'tryon', 'avatar', 'render-prenda', 'destino'… */
    tarea: string;
    /** El id del modelo de imagen, tal cual se le pidió a Gemini. */
    modeloId: string;
    ms: number;
    ok: boolean;
    /** null si el modelo no tiene tarifa conocida. */
    costoUsd: number | null;
  }
): Promise<void> {
  try {
    await supabase.from("ai_calls").insert({
      user_id: args.userId,
      tarea: args.tarea,
      proveedor: "google",
      modelo: args.modeloId,
      version: null,
      ms: args.ms,
      tokens_entrada: null,
      tokens_salida: null,
      // Una imagen que no salió no se cobra: el costo de un fallo es 0, no null
      // (null significa "no sé cuánto costó" y ensuciaría los promedios).
      costo_usd: args.ok ? args.costoUsd : 0,
      ok: args.ok,
    });
  } catch {
    // sin recibo, pero con imagen
  }
}

// ─── EL RECIBO DE UNA LLAMADA DIRECTA AL SDK DE ANTHROPIC ────────────────────
//
// Los caminos del motor que arman esenciales, viajes, arquetipo, preguntas de
// estilo, silueta, etc. llaman a `client.messages.create` directo y NO pasan
// por `llamar()`: cada uno tiene su propio manejo de reintentos (`maxRetries`),
// thinking, tools o parseo, y migrarlos a la puerta común cambiaría cómo le
// hablan al modelo — o sea, el motor. Hasta el 2026-10-05 por eso no dejaban
// recibo, y como los topes por persona (lib/cuotas.ts) suman `ai_calls`, ese
// gasto no contaba para ningún tope. La consola de Anthropic enseñaba gasto de
// Opus que la base no veía.
//
// `medirAnthropic` envuelve la llamada TAL CUAL: el mismo request, la misma
// respuesta; sólo lee `usage` y escribe el recibo (éxito o fallo).
//
// LOS TOKENS DE CACHÉ cuentan. `usage.input_tokens` NO incluye los tokens leídos
// o escritos en caché; si algún camino prende el caché de prompt, se cobran a
// 0.1× (lectura) y 1.25× (escritura) del precio de entrada. Hoy ninguno lo
// prende, pero sin esto el recibo mentiría hacia abajo el día que alguien lo
// haga.

type UsoAnthropic = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Tokens de entrada "a precio normal": los de caché se convierten con su tarifa. */
export function entradaEquivalente(u: UsoAnthropic): number {
  return (
    u.input_tokens +
    Math.round((u.cache_creation_input_tokens ?? 0) * 1.25) +
    Math.round((u.cache_read_input_tokens ?? 0) * 0.1)
  );
}

export async function medirAnthropic<R extends { usage: UsoAnthropic }>(
  ctx: ContextoRecibo | null,
  modeloId: string,
  llamada: () => Promise<R>
): Promise<R> {
  const modelo: Modelo = { proveedor: "anthropic", id: modeloId, etiqueta: modeloId };
  const t0 = Date.now();
  try {
    const res = await llamada();
    if (ctx) {
      const u = res.usage;
      const entrada =
        u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
      await guardarRecibo(ctx.supabase, {
        userId: ctx.userId,
        tarea: ctx.tarea,
        modelo,
        version: ctx.version,
        recibo: {
          texto: "",
          tokens: { entrada, salida: u.output_tokens },
          costoUsd: costoUsd(modeloId, { entrada: entradaEquivalente(u), salida: u.output_tokens }),
          ms: Date.now() - t0,
          truncada: false,
        },
      });
    }
    return res;
  } catch (e) {
    if (ctx) {
      await guardarFallo(ctx.supabase, {
        userId: ctx.userId,
        tarea: ctx.tarea,
        modelo,
        version: ctx.version,
        ms: Date.now() - t0,
      });
    }
    throw e;
  }
}
