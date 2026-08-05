"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Las dos decisiones que sólo el dueño del clóset puede tomar.
//
// NO SE BORRA NADA DE VERDAD: fusionar usa deleted_at, que es el borrado suave
// que ya usan prendas, outfits y viajes. Si Roberto se equivoca al decir "es la
// misma", se deshace con un update. Fusionar a lo bruto le borraría una prenda
// real del clóset y no habría cómo saber cuál era.

/**
 * "Es la misma prenda": se conserva una fila y las demás se van al borrado
 * suave. `conservar` lo decide la pantalla con cualConservar (la que trae foto
 * propia y más atributos), no el orden en que llegaron.
 */
export async function fusionar(
  conservar: string,
  descartar: string[]
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  if (!descartar.length) return { ok: true };
  const supabase = await createClient();

  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", descartar);
  if (error) return { error: error.message };
  // La conservada NO se marca como revisada a propósito: si mañana entra otra
  // copia por una foto nueva, el grupo se vuelve a formar y se vuelve a
  // preguntar. Marcarla escondería duplicados futuros de la misma prenda.
  return { ok: true };
}

/**
 * "Son prendas distintas": se marcan para no volver a preguntar.
 *
 * Roberto lo pidió antes de que yo tocara nada: "puedo tener dos o tres grises
 * que son diferentes, un cuello V y un crewneck". Sin esta salida, la pantalla
 * le preguntaría lo mismo cada vez que entre.
 */
export async function marcarDistintas(
  ids: string[]
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const supabase = await createClient();

  // attrs es jsonb: se lee y se reescribe con la marca, para no pisar el resto.
  const { data: filas, error: eLeer } = await supabase
    .from("items")
    .select("id, attrs")
    .in("id", ids);
  if (eLeer) return { error: eLeer.message };

  for (const f of filas ?? []) {
    const attrs = { ...((f.attrs as Record<string, unknown>) ?? {}), dup_ok: true };
    const { error } = await supabase.from("items").update({ attrs }).eq("id", f.id);
    if (error) return { error: error.message };
  }
  return { ok: true };
}
