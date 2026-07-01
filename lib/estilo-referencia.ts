// Estilo de referencia → línea para el motor (pura, sin IA ni DB).
//
// Al guardar las fotos de referencia, la IA emite un summary (el vibe) y una
// evaluación honesta de fit contra la colorimetría/silueta/vetos de la persona
// (verdict: "va" | "ajustes" | "ojo" + note). Antes el motor solo veía el
// summary y la advertencia se tiraba tras mostrarse una vez en el modal — el
// caso clásico: "este estilo es muy cálido para ti, llévalo a tus tonos" y el
// motor generando igual de cálido. Este helper arma la línea COMPLETA que
// consumen el motor de Hoy, el look del día y la cápsula.

export type StyleReferenceStored = {
  summary?: string;
  tags?: string[];
  fit?: { verdict?: string; note?: string };
  image_paths?: string[];
} | null;

export function styleReferenceForEngine(sr: unknown): string | null {
  const ref = (sr ?? null) as StyleReferenceStored;
  const summary = ref?.summary?.trim();
  if (!summary) return null;
  const note = ref?.fit?.note?.trim();
  const verdict = ref?.fit?.verdict;
  // Solo cuando la evaluación pide adaptar ("ajustes"/"ojo"): con "va" la nota
  // es un elogio y no cambia cómo generar.
  if (note && (verdict === "ajustes" || verdict === "ojo")) {
    return `${summary} (OJO — evaluación honesta de ese estilo para esta persona, adáptalo así: ${note})`;
  }
  return summary;
}
