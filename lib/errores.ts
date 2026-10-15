import type { SupabaseClient } from "@supabase/supabase-js";

// LA PUERTA PARA ANOTAR UN ERROR DESDE EL SERVIDOR (2026-10-14). Lo que el
// navegador ve llega por /api/errores; aquí entra lo que sólo el servidor sabe
// (los frenos de cuota). Igual que registrarEvento: NUNCA lanza — la persona
// está esperando y un renglón de diagnóstico no puede costarle la respuesta.
export async function registrarError(
  supabase: SupabaseClient,
  fila: {
    userId: string;
    origen: "navegador" | "servidor";
    clave: string;
    pantalla?: string | null;
    mensaje?: string | null;
    tecnico?: string | null;
    version?: string | null;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("errores").insert({
      user_id: fila.userId,
      origen: fila.origen,
      clave: fila.clave.slice(0, 120),
      pantalla: fila.pantalla?.slice(0, 200) ?? null,
      mensaje: fila.mensaje?.slice(0, 300) ?? null,
      tecnico: fila.tecnico?.slice(0, 500) ?? null,
      version: (fila.version ?? process.env.NEXT_PUBLIC_APP_VERSION ?? null)?.slice(0, 40) ?? null,
    });
    if (error) console.error(`[errores] no se guardó (${fila.clave}): ${error.message}`);
  } catch (e) {
    console.error("[errores] excepción:", e instanceof Error ? e.message : e);
  }
}
