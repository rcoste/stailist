// DESDE QUÉ APARATO ENTRÓ (2026-10-01).
//
// Las campañas de Google incluyen computadoras a propósito: Roberto las dejó
// prendidas para SABER qué parte del tráfico llega por escritorio y si esa
// gente termina el onboarding. Google dice de dónde vino el clic, pero no qué
// pasó después; para eso el dato tiene que quedar del lado nuestro.
//
// Se guarda una sola vez, en el evento `onboarding_started` (la primera
// pantalla tras teclear el código), como una palabra. NO se guarda el
// user-agent: no hace falta para la pregunta y es un dato de más.
//
// Límite conocido: un iPad con Safari se anuncia como Mac, así que cuenta como
// computadora. Para la pregunta ("¿pantalla ancha o teléfono?") es la
// respuesta correcta de todos modos.
export type Dispositivo = "celular" | "tablet" | "computadora";

export function dispositivoDesdeUA(ua: string | null | undefined): Dispositivo | null {
  if (!ua) return null;
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "celular";
  return "computadora";
}

export function esDispositivo(v: unknown): v is Dispositivo {
  return v === "celular" || v === "tablet" || v === "computadora";
}
