"use client";

import { useEffect } from "react";

// Mantiene la pantalla despierta mientras `active` (generaciones de ~30s). El
// celular se auto-bloquea a media carga y eso mata la petición en curso → look
// colgado. El wake lock evita ese auto-bloqueo. iOS lo suelta al ocultar la
// página, así que lo re-pedimos al volver a visible. Si el navegador no soporta
// Wake Lock (o lo niega), no pasa nada — degrada en silencio.
type Sentinel = { release: () => Promise<void>; released?: boolean };
type WakeLockNav = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
};

export function useWakeLock(active: boolean) {
  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? (navigator as WakeLockNav) : null;
    if (!active || !nav?.wakeLock) return;

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        /* negado o no soportado — sin wake lock, no bloquea el flujo */
      }
    };
    const onVisible = () => {
      if (!cancelled && document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
