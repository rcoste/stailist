// El día natural de la Ciudad de México, "YYYY-MM-DD". Sin dependencias: lo usa
// el servidor (lib/visitas.ts) y el navegador (components/visita-al-volver.tsx).

export const ZONA_VISITA = "America/Mexico_City";

/** El día natural en CDMX, "YYYY-MM-DD" (en-CA da justo ese formato). */
export function diaLocal(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_VISITA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}
