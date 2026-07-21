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

// Firma del ESTILO completo con el que se generó una cápsula: referencia +
// "sus palabras". Si cualquiera de las dos cambia, la cápsula quedó vieja y
// se ofrece regenerar (antes solo la referencia contaba — editar tus palabras
// jamás invalidaba la cápsula, en silencio). null si no hay ninguna señal.
export function styleSignature(sr: unknown, styleWords: string | null): string | null {
  const ref = styleReferenceForEngine(sr);
  const words = styleWords?.trim() || null;
  if (!ref && !words) return null;
  return `${ref ?? ""}|${words ?? ""}`;
}

export function styleReferenceForEngine(sr: unknown): string | null {
  const ref = (sr ?? null) as StyleReferenceStored;
  const summary = ref?.summary?.trim();
  if (!summary) return null;
  // Los tags que la visión extrajo de las fotos (4-6 claves del estilo) se
  // guardaban pero jamás llegaban al motor — señal tirada. Van pegados al
  // summary como claves concretas.
  const tags = (ref?.tags ?? []).map((t) => t?.trim()).filter(Boolean).slice(0, 6);
  const base = tags.length ? `${summary} (claves: ${tags.join(", ")})` : summary;
  const note = ref?.fit?.note?.trim();
  const verdict = ref?.fit?.verdict;
  // Solo cuando la evaluación pide adaptar ("ajustes"/"ojo"): con "va" la nota
  // es un elogio y no cambia cómo generar.
  if (note && (verdict === "ajustes" || verdict === "ojo")) {
    return `${base} (OJO — evaluación honesta de ese estilo para esta persona, adáptalo así: ${note})`;
  }
  return base;
}
