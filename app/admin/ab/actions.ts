"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Eleccion = "izq" | "der" | "igual";

/**
 * Guarda el juicio ciego de un par del A/B.
 *
 * Guarda el LADO ("izq"/"der"), no el brazo. Traducir aquí a "con recetario" /
 * "sin recetario" metería la respuesta en la misma tabla que la pregunta: una
 * consulta descuidada mientras se revisa rompería el ciego. La traducción se
 * hace al final, cruzando con docs_para_claude/barrido/ab-clave.json.
 *
 * Autosave por campo, como en las notas del barrido: son ~18 juicios de corrido
 * y un botón de guardar es una oportunidad más de perderlos.
 */
export async function guardarVeredicto(
  parN: number,
  campos: { eleccion?: Eleccion | null; comentario?: string }
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: previo } = await supabase
    .from("ab_veredictos")
    .select("eleccion, comentario")
    .eq("par_n", parN)
    .maybeSingle();

  const { error } = await supabase.from("ab_veredictos").upsert({
    par_n: parN,
    eleccion: campos.eleccion !== undefined ? campos.eleccion : (previo?.eleccion ?? null),
    comentario:
      campos.comentario !== undefined ? campos.comentario : (previo?.comentario ?? null),
    updated_at: new Date().toISOString(),
  });
  return { ok: !error };
}
