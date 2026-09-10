"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  cargarEtiquetas,
  etiquetasCargadas,
  linkSaleDeZona,
  permitidoEnEsteNavegador,
  registrarConversion,
  registrarVista,
  rutaMedible,
  salirSinEtiquetas,
  tomarConversionPendiente,
} from "@/lib/publicidad";

// El único lugar que decide, en cada cambio de ruta, si las etiquetas de
// publicidad viven o no. Las reglas están en lib/publicidad.ts; aquí sólo se
// aplican. No pinta nada.
export function TagsPublicidad() {
  const pathname = usePathname();

  useEffect(() => {
    // Una conversión que pidió el servidor (hoy: el registro, que se decide al
    // guardar la edad) se consume SIEMPRE, aunque no se pueda medir: si no, se
    // quedaría esperando y saldría en otra visita.
    const pendiente = tomarConversionPendiente();
    const fuera = !rutaMedible(pathname);

    // RED DE SEGURIDAD. Si las etiquetas siguen vivas donde ya no deben —se
    // salió de la zona por un camino que no fue navegación completa, o esta
    // cuenta resultó ser de 13-17 años— una recarga las suelta. El aviso de
    // privacidad promete ambas cosas. Sólo pasa si estaban cargadas, así que no
    // hay bucle. Las salidas conocidas ya son navegación completa (abajo, y
    // salirSinEtiquetas en la landing y el wow).
    if (etiquetasCargadas() && (fuera || !permitidoEnEsteNavegador())) {
      window.location.reload();
      return;
    }
    if (fuera) return;

    if (!cargarEtiquetas()) return;
    registrarVista();
    if (pendiente) registrarConversion(pendiente);
  }, [pathname]);

  // LOS LINKS QUE SALEN DE LA ZONA (el try-on del wow lleva a /perfil/avatar)
  // navegan sin recargar, y el router cambia la URL antes de que la recarga de
  // arriba alcance a correr: con etiquetas vivas, esa primera página de la app
  // la verían. En fase de captura, antes que el Link: si sale de la zona, se
  // cancela y se va con navegación completa. Clics con modificador o a otra
  // pestaña no se tocan (no cambian esta página).
  useEffect(() => {
    function alHacerClic(e: MouseEvent) {
      if (!etiquetasCargadas() || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const destino = new URL(a.href, window.location.href);
      if (!linkSaleDeZona(destino, window.location.origin)) return;
      e.preventDefault();
      salirSinEtiquetas(destino.pathname + destino.search + destino.hash);
    }
    document.addEventListener("click", alHacerClic, true);
    return () => document.removeEventListener("click", alHacerClic, true);
  }, []);

  return null;
}
