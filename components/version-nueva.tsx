"use client";

import { useEffect, useState } from "react";
import { hayVersionNueva, VERSION_DESCONOCIDA } from "@/lib/version";

// "HAY UNA VERSIÓN NUEVA — RECARGA."
//
// De dónde sale: el 2026-08-08 se arregló dos veces el mismo síntoma. La
// segunda vez, Roberto probó desde su teléfono un arreglo que YA estaba
// desplegado, no funcionó, y los dos investigamos hasta descubrir que su
// navegador seguía corriendo el JavaScript de antes. No es un caso raro: quien
// prueba una app tiene la pestaña abierta desde hace rato, y las pantallas de
// Next se quedan con los trozos de JavaScript que cargaron al abrirse.
//
// LO QUE COMPARA son dos cosas del mismo despliegue: la versión HORNEADA en
// este bundle (next.config la mete al build) contra la que el servidor tiene
// AHORA. Si difieren, el código que estás viendo correr es viejo — y eso es un
// hecho comprobable, no una corazonada.
//
// AVISA, NO RECARGA SOLA. Recargar en medio de una carga de doce fotos tiraría
// el trabajo de varios minutos; es exactamente el error de arreglar un problema
// creando uno peor. La barra se queda hasta que se recarga o se cierra.
//
// CUÁNDO PREGUNTA: al abrir y cada vez que la app vuelve al frente. Ese segundo
// momento es el que importa en una PWA instalada — se vuelve a ella horas
// después, que es justo cuando el bundle lleva más tiempo rezagado.
export function VersionNueva() {
  const [hay, setHay] = useState(false);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    const mia = process.env.NEXT_PUBLIC_APP_VERSION;
    // Sin versión horneada no hay nada que comparar: mejor callar que inventar.
    if (!mia || mia === VERSION_DESCONOCIDA) return;

    let vivo = true;
    const revisar = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { version } = (await r.json()) as { version?: string };
        // La regla —y por qué es tan conservadora— vive en lib/version, con casos.
        if (vivo && hayVersionNueva(mia, version)) setHay(true);
      } catch {
        // Sin conexión no se avisa nada.
      }
    };

    revisar();
    const alVolver = () => {
      if (document.visibilityState === "visible") revisar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  if (!hay || cerrado) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-accent px-4 py-2.5 text-on-accent">
      <p className="flex-1 text-[13px] leading-snug">
        Hay una versión nueva. Recarga para tenerla.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-sm bg-on-accent/15 px-3 py-1.5 text-[13px] font-semibold text-on-accent transition-colors hover:bg-on-accent/25"
      >
        recargar
      </button>
      <button
        type="button"
        onClick={() => setCerrado(true)}
        aria-label="Ahora no"
        className="shrink-0 px-1 text-[15px] leading-none text-on-accent/70"
      >
        ×
      </button>
    </div>
  );
}
