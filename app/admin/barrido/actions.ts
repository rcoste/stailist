"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Veredicto = "acerto" | "exagero";

/**
 * Guarda el juicio de un look del barrido.
 *
 * Se guarda por campo y en cuanto cambia (sin botón de "guardar"): son ~50
 * juicios escritos a mano en una sola sesión, y perder los últimos veinte por
 * cerrar la pestaña sin darle a un botón sería tirar el dato más caro de esta
 * fase.
 *
 * upsert por look_n: revisar es volver atrás y cambiar de opinión.
 */
export async function guardarNota(
  lookN: number,
  campos: { veredicto?: Veredicto | null; comentario?: string }
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const supabase = await createClient();

  // Se lee lo que ya hay para no borrar el otro campo al guardar uno: los dos
  // controles guardan por separado y un upsert parcial dejaría el comentario en
  // null cada vez que se toca el veredicto.
  const { data: previo } = await supabase
    .from("barrido_notas")
    .select("veredicto, comentario")
    .eq("look_n", lookN)
    .maybeSingle();

  const { error } = await supabase.from("barrido_notas").upsert({
    look_n: lookN,
    veredicto: campos.veredicto !== undefined ? campos.veredicto : (previo?.veredicto ?? null),
    comentario:
      campos.comentario !== undefined ? campos.comentario : (previo?.comentario ?? null),
    updated_at: new Date().toISOString(),
  });
  return { ok: !error };
}
