"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { clarityId, rutaConClarity, URL_SCRIPT } from "@/lib/clarity";
import { permitidoEnEsteNavegador } from "@/lib/publicidad";
import { estaInstalada } from "@/lib/push-navegador";

// El único lugar que decide, en cada cambio de ruta, si Clarity vive. Las
// reglas están en lib/clarity.ts; aquí sólo se aplican. No pinta nada.
//
// El tapado de imágenes y textos NO está aquí: es el data-clarity-mask del
// <body> en app/layout.tsx, que actúa antes de que salga nada del navegador.

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

let cargada = false;

export function Clarity() {
  const pathname = usePathname();

  useEffect(() => {
    const id = clarityId();
    if (!id) return;

    const permitido = permitidoEnEsteNavegador();
    // RED DE SEGURIDAD, igual que las etiquetas de publicidad: si ya estaba
    // grabando y esta persona pulsó el interruptor de /privacidad, mandó la
    // señal GPC o resultó tener 13-17 años, una recarga la suelta. Sólo pasa
    // si estaba cargada, así que no hay bucle.
    if (cargada && !permitido) {
      window.location.reload();
      return;
    }
    if (!permitido || !rutaConClarity(pathname) || cargada) return;

    cargada = true;
    const w = window as Window & { clarity?: ClarityFn };
    if (!w.clarity) {
      const cola: ClarityFn = (...args: unknown[]) => {
        (cola.q = cola.q || []).push(args);
      };
      w.clarity = cola;
    }
    const s = document.createElement("script");
    s.async = true;
    s.src = URL_SCRIPT(id);
    document.head.appendChild(s);
    // Para separar en el panel a quien tiene la app en su pantalla de inicio.
    w.clarity("set", "app_instalada", estaInstalada() ? "si" : "no");
  }, [pathname]);

  return null;
}
