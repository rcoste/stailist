"use client";

import { useEffect, useRef, useState } from "react";
import {
  CLAVE_PREGUNTADO,
  PARAMETRO_ABIERTO,
  pushActivo,
  VALOR_ABIERTO,
} from "@/lib/avisos-push";
import { registrarAviso } from "@/lib/push-actions";
import { estaInstalada, soportaPush, suscribirEsteNavegador } from "@/lib/push-navegador";

// EL PROMPT DE LOS AVISOS: "¿te aviso cuando esté tu look?". Se monta una vez
// (en el layout) y escucha el MISMO momento que la oferta de instalar la app
// (stailist:pwa-momento: tras el primer 👍 o tras generar un look en /hoy).
// Los dos nunca aparecen juntos: <PwaInstall/> sólo habla cuando la app NO
// está instalada; éste, sólo cuando SÍ lo está (en iPhone el push no existe
// de otra forma). Se pregunta UNA vez por navegador (CLAVE_PREGUNTADO); quien
// dice "ahora no" lo tiene en Perfil → Cuenta.
//
// También deja la huella de la apertura: si la URL trae ?desde=aviso es que
// entró tocando la notificación → push_abierto, y se limpia la URL.
//
// Apagado sin NEXT_PUBLIC_AVISOS_PUSH=1: no escucha, no pinta, no registra.

type Estado = "oculto" | "pregunta" | "pidiendo" | "negado";

export function AvisosPush() {
  const [estado, setEstado] = useState<Estado>("oculto");
  const motivoRef = useRef<string>("like");

  useEffect(() => {
    if (!pushActivo()) return;

    // Entró desde un aviso.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(PARAMETRO_ABIERTO) === VALOR_ABIERTO) {
        url.searchParams.delete(PARAMETRO_ABIERTO);
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        void registrarAviso("push_abierto");
      }
    } catch {}

    const onMomento = (e: Event) => {
      if (!soportaPush() || !estaInstalada()) return;
      if (Notification.permission !== "default") return;
      let preguntado = false;
      try {
        preguntado = localStorage.getItem(CLAVE_PREGUNTADO) === "1";
      } catch {}
      if (preguntado) return;
      motivoRef.current = (e as CustomEvent<string>).detail ?? "like";
      setEstado("pregunta");
      void registrarAviso("push_prompt_shown", { motivo: motivoRef.current });
    };
    window.addEventListener("stailist:pwa-momento", onMomento);
    return () => window.removeEventListener("stailist:pwa-momento", onMomento);
  }, []);

  function marcarPreguntado() {
    try {
      localStorage.setItem(CLAVE_PREGUNTADO, "1");
    } catch {}
  }

  function ahoraNo() {
    marcarPreguntado();
    setEstado("oculto");
    void registrarAviso("push_rechazado", { via: "prompt", motivo: motivoRef.current });
  }

  async function si() {
    marcarPreguntado();
    setEstado("pidiendo");
    const r = await suscribirEsteNavegador(motivoRef.current);
    if (r.ok) {
      setEstado("oculto");
      return;
    }
    if (r.motivo === "permiso_negado") {
      void registrarAviso("push_rechazado", { via: "permiso", motivo: motivoRef.current });
      setEstado("negado");
      return;
    }
    setEstado("oculto");
  }

  if (estado === "oculto") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="animate-[pushup_300ms_ease-out] w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-xl">
        {estado === "negado" ? (
          <>
            <h2 className="text-h3 font-semibold text-ink">Tu teléfono bloqueó los avisos</h2>
            <p className="mt-1 text-sm text-muted">
              Si cambias de opinión, actívalos en los ajustes de notificaciones de tu
              teléfono. Aquí no te vuelvo a preguntar.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setEstado("oculto")}
                className="min-h-12 rounded-sm bg-accent px-6 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
              >
                Entendido
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-h3 font-semibold text-ink">¿Te aviso cuando esté tu look?</h2>
            <p className="mt-1 text-sm text-muted">
              Cada mañana, un aviso con tu look del día. Lo apagas cuando quieras.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={si}
                disabled={estado === "pidiendo"}
                className="min-h-12 flex-1 rounded-sm bg-accent px-6 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
              >
                {estado === "pidiendo" ? "Un segundo…" : "Sí, avísame"}
              </button>
              <button
                type="button"
                onClick={ahoraNo}
                disabled={estado === "pidiendo"}
                className="min-h-12 rounded-sm px-4 text-sm font-medium text-muted hover:text-ink"
              >
                Ahora no
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes pushup { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
