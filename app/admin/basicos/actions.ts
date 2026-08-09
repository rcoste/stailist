"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Pone o quita una prenda de la lista de básicos del onboarding.
 *
 *  Es un toggle sobre `archetypes.onboarding_subset`, la MISMA columna que
 *  filtra /onboarding/closet. No hay copia ni tabla aparte a propósito: una
 *  segunda fuente de verdad para "qué básicos se muestran" es exactamente el
 *  tipo de cosa que se desincroniza en silencio y nadie nota hasta que a un
 *  usuario nuevo le sale una lista rara. */
export async function toggleBasico(
  id: number,
  activo: boolean
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("archetypes")
    .update({ onboarding_subset: activo })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/basicos");
  return { ok: true };
}
