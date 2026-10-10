"use client";

import { useEffect } from "react";
import { diaLocal } from "@/lib/dia-local";

// AVISA CUANDO ALGUIEN VUELVE A UNA PESTAÑA QUE DEJÓ ABIERTA (2026-10-10).
//
// El porqué completo está en app/api/visita/route.ts. Lo esencial: volver a
// una pestaña abierta no recarga la página, así que el servidor no se entera.
// Aquí, cuando la página vuelve a estar a la vista (o el navegador la restaura
// de su caché con "atrás"), si ya es OTRO día que el último que se avisó, se
// le avisa al servidor. El mismo día no manda nada: la visita es una al día, y
// cambiar de pestaña veinte veces no tiene por qué costar veinte peticiones.
//
// `redirect: "manual"`: sin sesión (la landing) el proxy contesta con un
// redirect a /login, y no hay por qué descargar esa página.
export function VisitaAlVolver() {
  useEffect(() => {
    let ultimoDia = diaLocal(new Date());
    const quizasAvisar = () => {
      if (document.visibilityState !== "visible") return;
      const hoy = diaLocal(new Date());
      if (hoy === ultimoDia) return;
      ultimoDia = hoy;
      fetch("/api/visita", { method: "POST", redirect: "manual", keepalive: true }).catch(() => {});
    };
    const alRestaurar = (e: PageTransitionEvent) => {
      if (e.persisted) quizasAvisar();
    };
    document.addEventListener("visibilitychange", quizasAvisar);
    window.addEventListener("pageshow", alRestaurar);
    return () => {
      document.removeEventListener("visibilitychange", quizasAvisar);
      window.removeEventListener("pageshow", alRestaurar);
    };
  }, []);
  return null;
}
