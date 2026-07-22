import type { LookInput } from "@/components/weather-picker";

// Frases del "generando" (StylistGenerating): en vez de repetir una sola línea
// genérica, se rotan varias que narran los pasos REALES del motor con datos
// reales de esta usuaria (cuántas prendas tiene, el clima de hoy, la ocasión).
// Así la espera cuenta qué está pasando y se siente más corta.
//
// `ocasionFrase` es la línea de personalidad por ocasión (la elige cada flujo,
// porque el wow y Hoy la frasean distinto). `closetCount` es el nº real de
// prendas del clóset; si es 0 esa frase se omite (no mentir).
export function buildGenFrases(
  li: LookInput | null,
  closetCount: number,
  ocasionFrase: string | null
): string[] {
  const f: string[] = [];
  if (closetCount > 0) {
    f.push(`revisando tus ${closetCount} prendas…`);
  }
  if (li && "weather" in li && li.weather) {
    const t = Math.round(li.weather.temp_c);
    const cond = li.weather.condition === "lluvia" ? ", con lluvia" : "";
    f.push(`checando el clima de hoy: ${t}°${cond}…`);
  }
  if (ocasionFrase) f.push(ocasionFrase);
  f.push("descartando lo que no combina contigo…");
  f.push("afinando los últimos detalles…");
  return f;
}
