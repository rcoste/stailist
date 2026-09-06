import type { SupabaseClient } from "@supabase/supabase-js";

// LA ÚNICA PUERTA PARA ESCRIBIR EN `events`.
//
// POR QUÉ EXISTE
// Había 23 `supabase.from("events").insert(...)` sueltos y la mayoría no leía
// el `error`. Si el CHECK de la columna rechazaba el tipo, si la RLS decía que
// no, si la red se caía: silencio. Medido en la auditoría del 2026-09-01: dos
// perfiles con vetos y CERO eventos `style_vetoes_edit`; cinco outfits borrados
// y CERO `outfit_deleted`. No se puede saber si fue un insert que falló o un
// borrado a mano — y ésa es exactamente la pregunta que la tabla existe para
// contestar.
//
// Ya había pasado antes con `trip_item_swap`: el código lo emitía, el CHECK no
// lo conocía, y durante semanas no se guardó ninguno sin que nadie lo notara.
//
// LO QUE HACE: inserta, y si falla LO DICE en la consola (que en Vercel son los
// logs). Nunca lanza en producción: la persona está esperando su look y un
// renglón de telemetría perdido no puede costarle la respuesta. Con
// TELEMETRIA_ESTRICTA=1 (tests, local) sí lanza, para que un tipo nuevo que
// falte en el CHECK truene en la primera prueba y no en producción.

export type FilaEvento = {
  user_id: string;
  type: string;
  data?: Record<string, unknown>;
  outfit_id?: string | null;
};

export type ResultadoEvento = { ok: true } | { ok: false; error: string };

export async function registrarEvento(
  supabase: SupabaseClient,
  fila: FilaEvento | FilaEvento[]
): Promise<ResultadoEvento> {
  const filas = Array.isArray(fila) ? fila : [fila];
  if (filas.length === 0) return { ok: true };
  try {
    const { error } = await supabase.from("events").insert(
      filas.map((f) => ({
        user_id: f.user_id,
        type: f.type,
        data: f.data ?? {},
        outfit_id: f.outfit_id ?? null,
      }))
    );
    if (!error) return { ok: true };
    const tipos = [...new Set(filas.map((f) => f.type))].join(", ");
    console.error(`[telemetria] no se guardó el evento (${tipos}): ${error.message}`);
    if (process.env.TELEMETRIA_ESTRICTA === "1") {
      throw new Error(`evento rechazado (${tipos}): ${error.message}`);
    }
    return { ok: false, error: error.message };
  } catch (e) {
    if (process.env.TELEMETRIA_ESTRICTA === "1") throw e;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[telemetria] excepción al guardar evento: ${msg}`);
    return { ok: false, error: msg };
  }
}
