import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrigen } from "@/lib/origen";

// DE LA COOKIE AL PERFIL: el único eslabón entre el clic en el anuncio y la
// cuenta (lib/origen.ts explica la cookie; aquí se guarda).
//
// Lo llama /onboarding/genero en CADA carga mientras el perfil no tenga origen.
// La primera versión lo intentaba una sola vez, colgado del arranque del reloj:
// si ese único update fallaba, la cuenta quedaba para siempre como "directo".
//
// Nunca lanza: perder la atribución de una persona no puede costarle el
// onboarding. `is("origen", null)`: nunca pisa uno ya guardado, aunque dos
// pestañas lleguen a la vez.

export type ResultadoOrigen = "ya-tenia" | "sin-cookie" | "guardado" | "error";

export async function guardarOrigenEnPerfil(
  supabase: SupabaseClient,
  userId: string,
  origenActual: unknown,
  cookieCruda: string | undefined
): Promise<ResultadoOrigen> {
  if (origenActual) return "ya-tenia";
  const origen = parseOrigen(cookieCruda);
  if (!origen) return "sin-cookie";
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ origen })
      .eq("id", userId)
      .is("origen", null);
    if (error) {
      console.error(`[origen] no se guardó en el perfil: ${error.message}`);
      return "error";
    }
    return "guardado";
  } catch (e) {
    console.error(`[origen] excepción al guardar en el perfil: ${e instanceof Error ? e.message : String(e)}`);
    return "error";
  }
}
