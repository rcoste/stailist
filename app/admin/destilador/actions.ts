"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Juicio } from "@/lib/destilador-tipos";

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

  const { error } = await supabase.from("referencias").update(cambios).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
