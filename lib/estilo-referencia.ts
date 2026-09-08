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

/**
 * EL "AFINA TU ESTILO" ESTÁ APAGADO PARA EL RELEASE (2026-09-08).
 *
 * Roberto: "es algo que he probado muy poco, o sea, casi nada. Eventualmente
 * sí nos va a funcionar, pero ahorita no sé ni cómo afecta la parte de los
 * estilos — nos puede afectar más de lo que ayudar".
 *
 * Los números al apagarlo: 3 perfiles de 26 tenían referencia (alberto,
 * ricardomc888, tatiana) y NINGUNO estaba activo — el más reciente llevaba 10
 * días sin abrir la app y Tatiana 39. Así que apagar el efecto no le cambia
 * los looks a nadie que la esté usando.
 *
 * Y lo que NO se puede alegar: el A/B ciego que perdió (2026-08-04, "fotos de
 * inspiración") era de `elegirInspiracion` —la biblioteca curada que usa el
 * motor— no de esta función. Esta feature nunca se midió. Ése es justamente el
 * motivo de apagarla: mete una línea al prompt del generador que empuja el vibe
 * de los looks, y nadie sabe hacia dónde.
 *
 * QUÉ HACE `false`: el dato guardado se CONSERVA (no se borra ninguna foto ni
 * ningún resumen), pero deja de llegar al motor y las tres puertas de entrada
 * se esconden (checklist del home, tarjeta de Perfil, y /perfil/referencia
 * redirige). Volver a encenderlo es cambiar esta constante a `true`.
 */
export const REFERENCIA_DE_ESTILO_ACTIVA = false;

export function styleReferenceForEngine(
  sr: unknown,
  /** Igual que en buildHomeChecklist: el default es la constante real y el
   *  parámetro deja probado el camino de vuelta. */
  activa: boolean = REFERENCIA_DE_ESTILO_ACTIVA
): string | null {
  // Apagada: el motor no la ve, aunque la persona la tenga guardada.
  if (!activa) return null;
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
