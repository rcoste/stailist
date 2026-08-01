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
 * "no es lo mío" DEVUELVE la foto a la destilación (sirve = true) y de paso
 * deja constancia de que no es del gusto de quien cura (mio = false). Esa es la
 * corrección que justifica toda la segunda pasada: el estilo lo define la
 * taxonomía, no el guardarropa de una persona.
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
      mio: revision === "no-es-lo-mio" ? false : undefined,
      juzgada_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
