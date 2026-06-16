"use client";

import { useEffect, useRef, useState } from "react";

// Prompt de instalación de la PWA. Se monta una vez (en el layout) y:
// 1. Registra el service worker.
// 2. Captura beforeinstallprompt (Chrome/Android) para dispararlo cuando QUERAMOS.
// 3. Escucha el evento "stailist:first-like" → muestra el prompt en el pico
//    emocional (tras el primer 👍), UNA sola vez (flag en localStorage).
// iOS Safari no soporta beforeinstallprompt: ahí mostramos instrucciones manuales.

const SEEN_KEY = "stailist:pwa-seen";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    !/crios|fxios/i.test(window.navigator.userAgent) // Chrome/FF en iOS no instalan
  );
}

export function PwaInstall() {
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
    };
    const onInstalled = () => {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {}
      setMode("hidden");
    };
    const onFirstLike = () => {
      let seen = false;
      try {
        seen = localStorage.getItem(SEEN_KEY) === "1";
      } catch {}
      if (seen || isStandalone()) return;
      if (deferred.current) setMode("android");
      else if (isIOS()) setMode("ios");
      // Sin evento capturado y no-iOS: el navegador no permite instalar → nada.
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("stailist:first-like", onFirstLike);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("stailist:first-like", onFirstLike);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setMode("hidden");
  }

  async function install() {
    const ev = deferred.current;
    if (!ev) return dismiss();
    await ev.prompt();
    await ev.userChoice.catch(() => {});
    deferred.current = null;
    dismiss();
  }

  if (mode === "hidden") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="animate-[pwaup_300ms_ease-out] w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <h2 className="text-h3 font-semibold text-ink">
          Llévame en tu bolsillo
        </h2>
        {mode === "android" ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Agrégame a tu pantalla de inicio y tu look del día te espera de un
              toque.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={install}
                className="min-h-12 flex-1 rounded-full bg-accent px-6 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
              >
                Agregar a mi pantalla
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="min-h-12 rounded-full px-4 text-sm font-medium text-muted hover:text-ink"
              >
                Ahora no
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Toca{" "}
              <span className="font-medium text-ink">Compartir</span> abajo y
              luego{" "}
              <span className="font-medium text-ink">
                “Agregar a inicio”
              </span>{" "}
              — así me tienes de un toque.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={dismiss}
                className="min-h-12 rounded-full bg-accent px-6 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
              >
                Entendido
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes pwaup { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
