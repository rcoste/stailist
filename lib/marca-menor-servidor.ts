import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COOKIE_MENOR } from "@/lib/publicidad";
import { isMinor, type AgeRange } from "@/lib/edad";

// LA MARCA DE MENOR DESDE UNA ACCIÓN DEL SERVIDOR, para las salidas de la app.
//
// La marca la ponen /onboarding/edad (al guardar la edad) y el layout del
// onboarding (components/marca-menor.tsx). Pero una menor que terminó su
// onboarding ANTES de que existieran las etiquetas nunca pasó por ahí, y al
// cerrar sesión o borrar su cuenta la app la manda a "/", que sí es zona medida:
// ahí se cargaban Google y TikTok para una cuenta que dijo tener 13-17 (lo cazó
// el red team del 2026-09-10). Estas acciones la marcan antes de soltarla.
//
// Nunca lanza: marcar es cuidado extra, no puede impedir que alguien salga.

export const MARCA_MENOR_MAX_AGE_S = 60 * 60 * 24 * 365;

export async function marcarNavegadorSiEsMenor(supabase: SupabaseClient, userId?: string): Promise<boolean> {
  try {
    let id = userId;
    if (!id) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      id = user?.id;
    }
    if (!id) return false;
    const { data } = await supabase.from("profiles").select("age_range").eq("id", id).maybeSingle();
    if (!isMinor((data?.age_range ?? null) as AgeRange | null)) return false;
    (await cookies()).set(COOKIE_MENOR, "1", {
      path: "/",
      maxAge: MARCA_MENOR_MAX_AGE_S,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    return true;
  } catch (e) {
    console.error(`[marca-menor] no se pudo marcar: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
