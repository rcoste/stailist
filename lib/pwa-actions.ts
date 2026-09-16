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
  // Una sola instalación por persona: la de `appinstalled` y la de "abrió en
  // modo app" (abajo) describen el mismo hecho, y contarla dos veces inflaría
  // el porcentaje del panel.
  if (evento === "pwa_installed" && (await yaInstalo(supabase, user.id))) return;
  await registrarEvento(supabase, {
    user_id: user.id,
    type: evento,
    data: motivo ? { motivo } : {},
  });
}

async function yaInstalo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("events")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "pwa_installed")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * LA APP SE ABRIÓ DESDE SU ÍCONO (display-mode standalone) — 2026-09-16.
 *
 * `appinstalled` sólo lo dispara Chrome/Android, y sólo si la instalación pasó
 * por nuestro aviso. Safari de iPhone —casi todo el público— nunca lo manda, y
 * quien instaló antes del 2026-09-09 tampoco dejó huella: cero eventos en toda
 * la vida del producto. Abrir la app en modo standalone es la prueba que sí
 * funciona en todos lados: si se abre sin barra de navegador, está instalada.
 * Se registra como `pwa_installed` (via: "standalone"), una vez por persona.
 */
export async function registrarAppAbiertaInstalada(): Promise<void> {
  await registrarPwa("pwa_installed", "standalone");
}
