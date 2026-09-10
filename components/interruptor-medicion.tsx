"use client";

import { useEffect, useState } from "react";
import { OPT_OUT_KEY, gpcActivo } from "@/lib/publicidad";

type Estado = "cargando" | "medido" | "apagado" | "gpc" | "sin-storage";

// El botón para apagar las etiquetas de medición del aviso de privacidad. Vive
// en este navegador (localStorage) porque las etiquetas también: no hay cuenta
// de por medio cuando alguien llega de un anuncio. lib/publicidad.ts lo lee
// antes de cargar cualquier cosa.
export function InterruptorMedicion() {
  const [estado, setEstado] = useState<Estado>("cargando");

  useEffect(() => {
    let siguiente: Estado;
    if (gpcActivo()) siguiente = "gpc";
    else {
      try {
        siguiente = localStorage.getItem(OPT_OUT_KEY) === "1" ? "apagado" : "medido";
      } catch {
        siguiente = "sin-storage";
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única del navegador al montar
    setEstado(siguiente);
  }, []);

  function cambiar(apagar: boolean) {
    try {
      if (apagar) localStorage.setItem(OPT_OUT_KEY, "1");
      else localStorage.removeItem(OPT_OUT_KEY);
      setEstado(apagar ? "apagado" : "medido");
    } catch {
      setEstado("sin-storage");
    }
  }

  if (estado === "cargando") return null;

  // Botón secundario del sistema (rectángulo, no píldora: DESIGN.md reserva
  // rounded-full para puntos y el FAB). El foco lleva su propio indicador
  // porque globals.css apaga el outline del navegador.
  const boton =
    "mt-3 self-start min-h-12 rounded-sm border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-ink focus-visible:border-accent";

  if (estado === "gpc") {
    return (
      <p className="mt-3 text-base leading-relaxed text-ink2">
        Tu navegador ya pide no ser rastreado (Global Privacy Control), así que
        aquí no cargamos ninguna etiqueta.
      </p>
    );
  }
  if (estado === "sin-storage") {
    // lib/publicidad.ts falla cerrado: sin storage no carga etiquetas.
    return (
      <p className="mt-3 text-base leading-relaxed text-ink2">
        Tu navegador no nos deja guardar preferencias, así que aquí no cargamos
        ninguna etiqueta.
      </p>
    );
  }
  if (estado === "apagado") {
    return (
      <div className="flex flex-col">
        <p className="mt-3 text-base leading-relaxed text-ink2">
          Listo: en este navegador ya no cargamos etiquetas de medición.
        </p>
        <button type="button" className={boton} onClick={() => cambiar(false)}>
          volver a permitirlo
        </button>
      </div>
    );
  }
  return (
    <button type="button" className={boton} onClick={() => cambiar(true)}>
      no quiero que Google y TikTok me midan
    </button>
  );
}
