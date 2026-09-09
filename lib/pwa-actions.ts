"use server";

import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";

/**
 * LA PWA NO DEJABA HUELLA, Y NO SABÍAMOS SI ALGUIEN LA INSTALÓ.
 *
 * `pwa_prompt_shown` y `pwa_installed` estaban declarados en el CHECK de
 * `events` desde siempre, y el admin tiene la etiqueta "instaló la app"
 * esperándolos — pero NADIE los emitía. Cero filas en toda la vida del
 * producto (auditoría 2026-09-09).
 *
 * Importa más de lo que parece: la PWA es parte del MVP y una app instalada
 * retiene distinto que una pestaña. Sin el dato, "¿la gente vuelve?" y "¿la
 * gente la instaló?" son la misma pregunta sin respuesta.
 *
 * `motivo` dice QUÉ disparó la oferta ("like" | "look"): sin eso no se puede
 * saber cuál de los dos momentos convierte, que es justo lo que este cambio
 * quiere medir.
 */
export async function registrarPwa(
  evento: "pwa_prompt_shown" | "pwa_installed",
  motivo?: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await registrarEvento(supabase, {
    user_id: user.id,
    type: evento,
    data: motivo ? { motivo } : {},
  });
}
