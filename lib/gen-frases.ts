import type { LookInput } from "@/components/weather-picker";

// Frases del "generando" (StylistGenerating): en vez de repetir una sola línea
// genérica, se rotan varias que narran los pasos REALES del motor con datos
// reales de esta usuaria (cuántas prendas tiene, el clima del día del look, la
// ocasión). Así la espera cuenta qué está pasando y se siente más corta.
//
// `ocasionFrase` es la línea de personalidad por ocasión (la elige cada flujo,
// porque el wow y Hoy la frasean distinto). `closetCount` es el nº real de
// prendas del clóset; si es 0 esa frase se omite (no mentir).
//
// `fechaLabel` es el día del look en palabras ("mañana", "el sábado 16"), tal
// como lo dice fechaLegible() en el picker; null = hoy. Sin él la frase decía
// "el clima de hoy" AUNQUE el look fuera para mañana con el pronóstico de
// mañana ya en la mano: Val reportó un bug de clima que en realidad era esta
// línea contradiciendo al dato correcto (2026-09-07).
export function buildGenFrases(
  li: LookInput | null,
  closetCount: number,
  ocasionFrase: string | null,
  fechaLabel: string | null = null
): string[] {
  const f: string[] = [];
  if (closetCount > 0) {
    f.push(`revisando tus ${closetCount} prendas…`);
  }
  if (li && "weather" in li && li.weather) {
    const t = Math.round(li.weather.temp_c);
    const cond = li.weather.condition === "lluvia" ? ", con lluvia" : "";
    f.push(`checando el clima ${cuando(li, fechaLabel)}: ${t}°${cond}…`);
  }
  if (ocasionFrase) f.push(ocasionFrase);
  f.push("descartando lo que no combina contigo…");
  f.push("afinando los últimos detalles…");
  return f;
}

// "de hoy" / "de mañana" / "del sábado 16": la preposición se contrae sola
// porque fechaLegible() ya devuelve el artículo ("el sábado 16").
//
// El caso feo es a propósito: si el look ES para otro día (plannedFor) pero
// quien llama olvidó pasar la etiqueta, NO se dice "de hoy" — se dice "de ese
// día". Vago, pero cierto. El bug original nació justo de ese olvido, así que
// el default silencioso ya no puede volver a mentir.
function cuando(li: LookInput, fechaLabel: string | null): string {
  if (!fechaLabel) return li.plannedFor ? "de ese día" : "de hoy";
  return fechaLabel.startsWith("el ") ? `del ${fechaLabel.slice(3)}` : `de ${fechaLabel}`;
}
