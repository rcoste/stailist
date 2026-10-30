"use client";

import { guardarSuscripcion } from "@/lib/push-actions";

// LO QUE HABLA CON EL NAVEGADOR: ¿soporta push? ¿está instalada? ¿ya hay
// suscripción? y el acto de suscribirse. Lo comparten el prompt tras el
// primer 👍 (components/avisos-push.tsx) y el interruptor de Perfil
// (components/avisos-push-toggle.tsx) para que no haya dos versiones del
// mismo baile — ya pasó con el vocabulario de las prendas.
//
// iPHONE: el push web sólo existe con la app en la pantalla de inicio (iOS
// 16.4+), y `Notification.requestPermission` tiene que correr DENTRO del toque
// de la persona, antes de cualquier await. Por eso el orden de
// suscribirEsteNavegador es permiso primero y service worker después.

export function soportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function esIPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

/** La llave pública VAPID viene en base64url; el navegador la quiere en bytes. */
function llaveComoBytes(b64url: string): Uint8Array {
  const relleno = "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob((b64url + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soportaPush()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export type ResultadoSuscribir =
  | { ok: true }
  | { ok: false; motivo: "sin_soporte" | "no_instalada" | "permiso_negado" | "sin_llave" | "error" };

function aGuardable(sub: PushSubscription) {
  const j = sub.toJSON();
  const keys = j.keys ?? {};
  return { endpoint: sub.endpoint, p256dh: keys.p256dh ?? "", auth: keys.auth ?? "" };
}

/**
 * Pide permiso, se suscribe y guarda. Llamar desde un click.
 * `motivo` dice qué puerta fue ("like" | "look" | "perfil"): sin eso no se
 * sabe cuál convierte.
 */
export async function suscribirEsteNavegador(motivo: string): Promise<ResultadoSuscribir> {
  if (!soportaPush()) return { ok: false, motivo: "sin_soporte" };
  if (esIPhone() && !estaInstalada()) return { ok: false, motivo: "no_instalada" };
  const llave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!llave) return { ok: false, motivo: "sin_llave" };

  // Permiso PRIMERO (dentro del gesto). Si ya estaba concedido, no pregunta.
  let permiso: NotificationPermission;
  try {
    permiso = await Notification.requestPermission();
  } catch {
    return { ok: false, motivo: "error" };
  }
  if (permiso !== "granted") return { ok: false, motivo: "permiso_negado" };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: llaveComoBytes(llave) as BufferSource,
      }));
    let r = await guardarSuscripcion(aGuardable(sub), navigator.userAgent, motivo);
    if (!r.ok && r.motivo === "endpoint_ajeno") {
      // Este teléfono estaba suscrito con otra cuenta: se suelta esa
      // dirección (muere para la cuenta anterior) y se pide una nueva.
      await sub.unsubscribe().catch(() => {});
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: llaveComoBytes(llave) as BufferSource,
      });
      r = await guardarSuscripcion(aGuardable(sub), navigator.userAgent, motivo);
    }
    return r.ok ? { ok: true } : { ok: false, motivo: "error" };
  } catch (e) {
    console.error("[push] no se pudo suscribir:", e instanceof Error ? e.message : e);
    return { ok: false, motivo: "error" };
  }
}

/** Suelta la suscripción de este navegador (el servidor la borra aparte). */
export async function desuscribirEsteNavegador(): Promise<string | null> {
  const sub = await suscripcionActual();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  return endpoint;
}
