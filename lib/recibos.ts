import type { SupabaseClient } from "@supabase/supabase-js";
import type { Modelo, Recibo } from "@/lib/proveedores";

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
