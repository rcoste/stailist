import "server-only";
import webpush from "web-push";
import type { Aviso } from "@/lib/avisos-push";

// EL ENVÍO: una llamada de web-push por suscripción, firmada con las llaves
// VAPID (el par que identifica a nuestro servidor ante Apple y Google). La
// llave pública es la misma que ve el navegador al suscribirse; la privada
// vive sólo en Vercel y en .env.local.
//
// Lo que devuelve es lo que el cron necesita decidir: si la suscripción
// MURIÓ (404/410: la persona quitó el permiso, borró la app o cambió de
// teléfono) se marca revoked_at de inmediato; cualquier otro error suma un
// fallo y a los tres se deja de intentar (lib/avisos-push.ts).

export function vapidListo(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;
}

let configurado = false;
function configurar() {
  if (configurado) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("VAPID: faltan llaves");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hola@stailist.co", pub, priv);
  configurado = true;
}

export type SuscripcionGuardada = { endpoint: string; p256dh: string; auth: string };

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; muerta: boolean; error: string };

/** Si el teléfono está apagado, el aviso espera hasta esto; después se
 *  descarta: "buenos días" a las 9 de la noche no sirve. */
const TTL_SEGUNDOS = 6 * 3600;

export async function enviarAviso(s: SuscripcionGuardada, aviso: Aviso): Promise<ResultadoEnvio> {
  configurar();
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(aviso),
      { TTL: TTL_SEGUNDOS, urgency: "normal" }
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    const mensaje = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      muerta: status === 404 || status === 410,
      error: `${status ?? "?"} ${mensaje}`.slice(0, 300),
    };
  }
}
