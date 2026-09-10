"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { readFileSync } from "node:fs";

/** La versión que corre el servidor, igual que /api/version. */
const APP_VERSION = (() => {
  try {
    return readFileSync("VERSION", "utf8").trim();
  } catch {
    return process.env.NEXT_PUBLIC_APP_VERSION ?? "desconocida";
  }
})();

/**
 * EL BUZÓN. Recibe lo que la persona escribe y le pega el contexto que ella no
 * tiene por qué darnos.
 *
 * POR QUÉ EL CONTEXTO VA APARTE DEL TEXTO. Lo que hace útil un reporte no es la
 * descripción sino saber dónde estaba, con qué versión y qué le acababa de
 * pasar. Pedirle eso a la persona es pedirle que haga de soporte técnico — y
 * quien está molesto porque algo falló no va a escribir un informe.
 *
 * El caso que lo motiva: Val intentó verse un look CUATRO veces el 2026-09-09,
 * falló las cuatro por una caída del proveedor de imágenes, y no reportó nada.
 * Con este buzón, un "no me sale el look" suyo habría llegado con la ruta, la
 * versión y sus cuatro fallos de `tryon` adjuntos.
 */
export async function enviarReporte(datos: {
  texto: string;
  tipo?: "problema" | "idea";
  ruta?: string;
  fotoPath?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const texto = datos.texto.trim();
  if (!texto) return { ok: false, error: "vacio" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_auth" };

  // LO QUE YA SE SABÍA SIN PREGUNTARLE. Sus últimos eventos y sus fallos de IA
  // recientes: es lo que convierte "no me funcionó" en algo accionable. Va
  // acotado a 10 y a 2 horas para que la fila no crezca sin límite.
  const [{ data: eventos }, { data: fallos }] = await Promise.all([
    supabase
      .from("events")
      .select("type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ai_calls")
      .select("tarea, ok, ms, created_at")
      .eq("user_id", user.id)
      .eq("ok", false)
      .gte("created_at", new Date(Date.now() - 2 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const contexto = {
    eventos: (eventos ?? []).map((e) => `${e.type}@${e.created_at}`),
    fallosIaRecientes: (fallos ?? []).map((f) => `${f.tarea} ${Math.round(Number(f.ms) / 1000)}s`),
  };

  const { error } = await supabase.from("reportes").insert({
    user_id: user.id,
    tipo: datos.tipo ?? "problema",
    texto: texto.slice(0, 4000),
    ruta: datos.ruta?.slice(0, 200) ?? null,
    version: APP_VERSION,
    foto_path: datos.fotoPath ?? null,
    contexto,
  });
  if (error) return { ok: false, error: error.message };

  // El correo NO bloquea el "gracias": si Postmark falla, el reporte ya está
  // guardado y el admin lo ve en el panel. Al revés sería perder el reporte por
  // un problema de correo.
  const admin = process.env.ADMIN_EMAIL;
  if (admin) {
    const fallosTxt = contexto.fallosIaRecientes.length
      ? `\n\nFallos de IA en las últimas 2 h: ${contexto.fallosIaRecientes.join(", ")}`
      : "";
    void sendEmail({
      to: admin,
      subject: `[${datos.tipo === "idea" ? "idea" : "problema"}] ${user.email ?? "alguien"}`,
      text:
        `${texto}\n\n—\nDe: ${user.email ?? user.id}\nPantalla: ${datos.ruta ?? "?"}\n` +
        `Versión: ${APP_VERSION}${fallosTxt}`,
      // Sin plantilla: es una alarma operativa para el admin, no un correo de
      // producto. El <pre> conserva los saltos de línea del contexto.
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${texto
        .replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}\n\n—\nDe: ${user.email ?? user.id}\nPantalla: ${datos.ruta ?? "?"}\nVersión: ${APP_VERSION}${fallosTxt}</pre>`,
    }).catch(() => {});
  }
  return { ok: true };
}
