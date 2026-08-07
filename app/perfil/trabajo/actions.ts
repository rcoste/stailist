"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WORK_DRESS_CODES } from "@/lib/dress-code";

/**
 * Guarda (o cambia) el código de vestimenta del trabajo.
 *
 * Existe porque la pregunta del wizard solo se hace UNA vez: sin esta pantalla,
 * contestar mal era permanente. Y porque el comparador corre sobre el perfil de
 * quien califica — sin este dato, los briefs de trabajo se generan sin calibrar
 * y no prueban nada. Lo cachó Roberto antes de lanzar el veredicto: "¿no
 * debería yo antes contestar la info de trabajo para probar la calibración?".
 */
export async function guardarDressCode(
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const perfil = await requireOnboarded();
  // Se valida contra la MISMA lista que pinta la pantalla: una server action es
  // un endpoint, y el CHECK de la columna es la segunda red, no la primera.
  if (!WORK_DRESS_CODES.some((d) => d.key === code)) {
    return { ok: false, error: "opción desconocida" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ work_dress_code: code })
    .eq("id", perfil.id);
  if (error) {
    console.error(`[perfil] guardarDressCode falló — ${error.message}`);
    return { ok: false, error: error.message.slice(0, 120) };
  }
  revalidatePath("/perfil");
  revalidatePath("/hoy");
  return { ok: true };
}
