// QUÉ ERROR ES CADA COSA (2026-10-14). Lógica pura, sin base ni navegador: la
// usan el vigía del navegador (para armar la clave), el servidor (frenos) y
// /admin/errores (para agruparlos y bautizarlos).
//
// La CLAVE es lo que agrupa: dos personas a las que se les cortó la maleta son
// el mismo error, y el estado (sin revisar / visto / arreglado) se le pone a la
// clave, no a cada vez que pasó.

/** Una ruta con ids → la ruta con `[id]`, para que cada viaje no sea su propio error. */
export function rutaSinIds(ruta: string): string {
  return ruta
    .split("?")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\/\d+(?=\/|$)/g, "/[n]")
    .slice(0, 80);
}

/** Lo que hace cada ruta, en palabras de la persona. */
const QUE_HACE: Record<string, string> = {
  "/api/trip": "Crear un viaje",
  "/api/trip/[id]/outfits": "Armar los looks del viaje",
  "/api/trip/[id]/ruta": "Editar la ruta del viaje",
  "/api/trip/itinerario": "Leer el itinerario del viaje",
  "/api/generate": "Generar looks",
  "/api/look-of-day": "El look del día",
  "/api/semana": "Armar la semana",
  "/api/espejo": "El fit check",
  "/api/espejo/prendas": "Leer las prendas del espejo",
  "/api/analizar-prenda": "Leer la foto de una prenda",
  "/api/analizar-prendas": "Leer las fotos de prendas",
  "/api/contar-personas": "Revisar la foto",
  "/api/analizar-cuerpo": "Leer su silueta",
  "/api/estilo-referencia": "Leer su estilo de referencia",
  "/api/destino-imagen": "La foto del destino",
};

export function queHace(ruta: string): string {
  return QUE_HACE[ruta] ?? (ruta.startsWith("/api/") ? `La llamada ${ruta}` : `La pantalla ${ruta}`);
}

/** Las tareas de ai_calls (lib/recibos.ts), en palabras. */
const TAREA: Record<string, string> = {
  motor: "armar looks",
  juez: "revisar un look",
  "vision-prendas": "leer fotos de prendas",
  "vision-personas": "revisar una foto",
  "render-prenda": "dibujar una prenda",
  "render-prenda-fallback": "dibujar una prenda (respaldo)",
  "render-prenda-remate": "dibujar una prenda (remate)",
  avatar: "crear su avatar",
  "avatar-juez": "revisar su avatar",
  tryon: "probar un look en su avatar",
  "tryon-wishlist": "probar una prenda de su wishlist",
  espejo: "el fit check",
  silueta: "leer su silueta",
  "capsula-ideal": "armar su cápsula",
  "capsula-match": "cruzar su cápsula con su clóset",
  "capsula-cambio": "cambiar una pieza de su cápsula",
  "viaje-capsula": "armar la maleta",
  "capsula-reparar": "corregir su cápsula",
  "viaje-reparar": "corregir la maleta",
  "viaje-outfits": "armar los looks del viaje",
  "viaje-sustitutos": "buscar sustitutos para la maleta",
  "viaje-juez": "revisar los looks del viaje",
  "viaje-revision": "revisar su maleta",
  "destino-imagen": "la foto del destino",
  "destino-motivo": "el motivo del destino",
  arquetipo: "dibujar una prenda del catálogo",
  "preguntas-estilo": "las preguntas de estilo",
  "ancla-encaje": "revisar la prenda que pidió llevar",
};

const RECURSO: Record<string, string> = {
  looks: "looks",
  fotos: "lectura de fotos",
  renders: "dibujos de prendas",
  tryon: "pruebas en su avatar",
};

/**
 * Tres clases, porque no pesan igual:
 *  · "error": la persona vio que algo falló. Es lo que hay que revisar.
 *  · "freno": la app le dijo "por hoy ya no" a propósito (cuota, tope de
 *    gasto, interruptor). No es una falla, pero si pasa mucho el tope está bajo.
 *  · "tecnico": algo tronó por dentro sin que ella lo viera (una llamada a la
 *    IA que falló y se reintentó, una conexión que se cayó de su lado).
 */
export type ClaseError = "error" | "freno" | "tecnico";

export function claseDe(clave: string): ClaseError {
  if (clave.startsWith("freno:")) return "freno";
  // La versión vieja se recarga sola: la persona no ve el error.
  if (clave.startsWith("ia:") || clave.startsWith("red:") || clave === "version-vieja") return "tecnico";
  return "error";
}

/** El título de un grupo: qué le pasó, sin jerga. */
export function tituloDe(clave: string): string {
  const [tipo, ...resto] = clave.split(":");
  const r = resto.join(":");
  switch (tipo) {
    case "generation_failed":
      return r === "TOO_FEW_OUTFITS" ? "Su look no salió: muy pocas prendas" : "Su look no salió";
    case "avatar_fallo":
      return "Su avatar no salió";
    case "viaje":
      if (r === "cortado") return "Crear un viaje se cortó a medias";
      if (r === "generacion") return "La IA no pudo armar la maleta";
      if (r === "guardar") return "La maleta se armó pero no se guardó";
      return "No se pudo armar la maleta";
    case "pantalla-de-error":
      return 'Le salió la pantalla de "algo se me atoró"';
    case "version-vieja":
      return "Tenía abierta una versión vieja y se recargó sola";
    case "http": {
      const i = r.lastIndexOf(":");
      const ruta = r.slice(0, i);
      const status = Number(r.slice(i + 1));
      const que = queHace(ruta);
      if (status === 504) return `${que} se cortó por tiempo`;
      return `${que} falló (${status})`;
    }
    case "red":
      return `${queHace(r)}: se perdió la conexión`;
    case "freno":
      if (r === "gasto") return "Llegó al tope de gasto del día";
      if (r === "pausa") return "La IA estaba pausada (interruptor)";
      return `Llegó a su cuota de ${RECURSO[r] ?? r}`;
    case "ia":
      return `La IA falló: ${TAREA[r] ?? r}`;
    default:
      return clave;
  }
}
