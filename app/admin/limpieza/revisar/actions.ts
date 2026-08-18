"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Las dos respuestas a "¿tienes esta prenda?".
//
// NO SE BORRA DE VERDAD: "no la tengo" usa deleted_at, el borrado suave que ya
// usan prendas, outfits y viajes. Un dedo mal puesto no le cuesta a nadie una
// prenda real, y los outfits viejos que la incluían siguen leyéndose.

/** "Sí la tengo": queda confirmada y no se vuelve a preguntar. */
export async function confirmar(id: string): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: fila, error: eLeer } = await supabase
    .from("items")
    .select("attrs")
    .eq("id", id)
    .single();
  if (eLeer) return { error: eLeer.message };

  const attrs = { ...((fila?.attrs as Record<string, unknown>) ?? {}), existe: true };
  const { error } = await supabase.from("items").update({ attrs }).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

/** "No la tengo": fuera del clóset, recuperable. */
export async function quitar(id: string): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
