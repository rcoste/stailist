import type { SupabaseClient } from "@supabase/supabase-js";

// LA ÚNICA PUERTA PARA ESCRIBIR EN `ai_trazas` — el prompt que se mandó y el
// razonamiento con el que el modelo contestó.
//
// POR QUÉ EXISTE, y por qué no es `ai_calls`: el recibo de una llamada (ms,
// tokens, costo) dice CUÁNTO costó; no dice POR QUÉ salió lo que salió. Cuando
// Roberto abre su cápsula y ve un traje negro donde esperaba uno marino, el
// recibo no ayuda en nada: la pregunta es qué le pedimos al modelo y qué se
// contestó a sí mismo antes de listar prendas. Eso es esto.
//
// LO QUE NO HACE: no bloquea. Guardar la traza es para depurar después; si
// falla, la persona igual se queda con sus esenciales. Falla ruidoso en los
// logs y sigue.
//
// SÓLO INSERTA. La versión que hacía upsert para dejar una sola fila por
// persona no podía existir: ON CONFLICT DO UPDATE necesita leer la fila en
// conflicto, y aquí la persona escribe pero no lee. La más nueva manda; el
// histórico queda de pilón. Ver la migración 0157.

export type FilaTraza = {
  user_id: string;
  /** 'capsula-ideal', … — mismo vocabulario que `tarea` en ai_calls. */
  tarea: string;
  modelo?: string | null;
  version?: string | null;
  promptSystem?: string | null;
  promptUsuario?: string | null;
  /** El borrador de trabajo del modelo. La persona nunca lo ve. */
  razonamiento?: string | null;
};

export async function guardarTraza(
  supabase: SupabaseClient,
  fila: FilaTraza
): Promise<{ ok: boolean }> {
  try {
    const { error } = await supabase.from("ai_trazas").insert({
      user_id: fila.user_id,
      tarea: fila.tarea,
      modelo: fila.modelo ?? null,
      version: fila.version ?? null,
      prompt_system: fila.promptSystem ?? null,
      prompt_usuario: fila.promptUsuario ?? null,
      razonamiento: fila.razonamiento ?? null,
    });
    if (error) {
      console.error(`[trazas] no se guardó la traza (${fila.tarea}): ${error.message}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error(
      `[trazas] excepción al guardar traza (${fila.tarea}): ${e instanceof Error ? e.message : String(e)}`
    );
    return { ok: false };
  }
}
