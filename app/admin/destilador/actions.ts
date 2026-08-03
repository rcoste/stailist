"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REVISIONES, type Juicio } from "@/lib/destilador-tipos";

export async function guardarJuicio(
  id: string,
  juicio: Juicio
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const supabase = await createClient();

  // Solo se escriben los campos que vienen: marcar "así me vestiría yo" no debe
  // borrar el motivo que ya estaba puesto, y viceversa.
  const cambios: Record<string, unknown> = {};
  if (juicio.sirve !== undefined) {
    cambios.sirve = juicio.sirve;
    cambios.juzgada_en = new Date().toISOString();
  }
  if (juicio.motivo !== undefined) cambios.motivo = juicio.motivo;
  if (juicio.mio !== undefined) cambios.mio = juicio.mio;
  if (juicio.nota !== undefined) cambios.nota = juicio.nota;
  if (juicio.revision !== undefined) cambios.revision = juicio.revision;

  const { error } = await supabase.from("referencias").update(cambios).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Resuelve una discrepancia de la segunda pasada.
 *
 * Las dos salidas que rescatan DEVUELVEN la foto a la destilación (sirve =
 * true) y se diferencian en el gusto: "me equivoqué" deja mio = true, "no es lo
 * mío" deja mio = false. Esa es la corrección que justifica toda la segunda
 * pasada: el estilo lo define la taxonomía, no el guardarropa de una persona.
 *
 * `mio` sale de la opción y ya no de una comparación con el id: cuando estaba
 * escrito a mano aquí, agregar una salida nueva pedía acordarse de tocar este
 * archivo también, y olvidarlo no rompía nada visible — solo dejaba el gusto sin
 * registrar.
 */
export async function resolverDiscrepancia(
  id: string,
  revision: string
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const opcion = REVISIONES.find((r) => r.id === revision);
  if (!opcion) return { error: "revisión inválida" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("referencias")
    .update({
      revision,
      sirve: opcion.destila,
      // Las que no destilan no opinan del gusto: dejan `mio` como estaba.
      mio: "mio" in opcion ? opcion.mio : undefined,
      juzgada_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
