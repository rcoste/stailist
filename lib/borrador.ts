import type { SupabaseClient } from "@supabase/supabase-js";

// EMPEZAR SIN REGISTRARSE (2026-10-02).
//
// Hasta hoy lo primero que la app pedía era el correo, antes de dar nada. Ahora
// el botón de la landing abre un BORRADOR: una sesión anónima de Supabase, sin
// correo, con la que la persona hace el onboarding (género, edad, swipes,
// colores, básicos). El correo se pide justo antes de armar su primer look
// (/onboarding/correo) y, al verificarlo, el borrador se vuelve su cuenta con
// todo lo que ya contestó.
//
// "Borrador" y no "usuaria anónima" a propósito: sin correo NO hay app. No se
// arma ningún look, no se sube nada, no se entra al clóset ni al diario. Lo
// impiden tres candados que no dependen de los botones:
//   · lib/cuotas.ts: las rutas de IA rechazan una sesión sin correo;
//   · migración 0167: Storage no deja escribir a una sesión sin correo;
//   · el paso 3 → 4 del onboarding (el objetivo) exige correo (aquí abajo).
//
// El interruptor: NEXT_PUBLIC_ENTRADA_SIN_CORREO=1. Sin él, la landing manda a
// /login como siempre y nadie crea borradores desde la app.

export function entradaSinCorreo(): boolean {
  return process.env.NEXT_PUBLIC_ENTRADA_SIN_CORREO === "1";
}

/** ¿La sesión de este request es un borrador (sin correo verificado)? */
export async function esBorrador(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.is_anonymous === true;
  } catch {
    return false;
  }
}

/** Borradores nuevos por dirección de internet y hora. Holgado a propósito: los
 *  operadores celulares sacan a mucha gente por la misma dirección. Pasado el
 *  tope no se bloquea a nadie: se le manda al registro con correo de siempre. */
export const TOPE_BORRADORES_POR_IP_HORA = 20;

/** Cómo quedan anotados en `login_intentos` (comparte tabla y limpieza con los códigos). */
export const MARCA_BORRADOR = "borrador";
