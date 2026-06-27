"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

// Fila "Instalar la app" del Perfil. El prompt automático solo sale una vez (tras
// el 1er 👍), así que aquí dejamos reacceder a las instrucciones. Detecta la
// plataforma y muestra el paso correcto; se oculta si ya está instalada (o en SSR).
type Platform = "unknown" | "installed" | "ios" | "other";

export function InstallAppRow() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setPlatform("installed");
      return;
    }
    const ios =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !/crios|fxios/i.test(window.navigator.userAgent);
    setPlatform(ios ? "ios" : "other");
  }, []);

  // Oculta si ya está instalada o aún no sabemos (evita parpadeo en SSR).
  if (platform === "unknown" || platform === "installed") return null;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-accent"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name="mas" size={16} />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">instalar la app</span>
          <span className="text-xs text-muted">
            tenla en tu pantalla de inicio, de un toque.
          </span>
        </div>
        <Icon
          name="chevron"
          size={16}
          className={`ml-auto shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open ? (
        <div className="mt-2 rounded-lg border border-line bg-bg p-4 text-xs leading-relaxed text-muted">
          {platform === "ios" ? (
            <>
              Toca <span className="font-medium text-ink">Compartir</span> abajo y
              luego <span className="font-medium text-ink">“Agregar a inicio”</span>.
            </>
          ) : (
            <>
              Abre el menú del navegador y elige{" "}
              <span className="font-medium text-ink">“Instalar app”</span> o{" "}
              <span className="font-medium text-ink">
                “Agregar a pantalla de inicio”
              </span>
              .
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
