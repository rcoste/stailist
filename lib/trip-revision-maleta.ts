// LA REVISIÓN DE STYLIST DE LA MALETA (2026-10-21): el dato que guarda
// trips.revision y su validación. Pura y sin IA (la llamada vive en
// lib/trip-flexible-actions.ts): segura para cliente y con pruebas.

export type RevisionMaleta = {
  veredicto: string;
  /** Looks distintos y usables que salen, según la stylist (aproximado). */
  looks: number;
  bien: string[];
  /** Prendas de SU maleta que sobran, con nombre exacto. */
  sobra: { prenda: string; porque: string }[];
  /** Huecos reales, dichos como tipo de prenda. */
  falta: { que: string; porque: string }[];
  /** Qué maleta se revisó: si cambia lo que lleva, la revisión es vieja. */
  firma: string;
  fecha: string;
  version: string;
};

/** La firma de lo que lleva: los nombres, ordenados. */
export function firmaDeMaleta(nombres: string[]): string {
  return [...new Set(nombres)].sort((a, b) => a.localeCompare(b, "es")).join("|");
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Lo que devolvió el modelo, validado: textos no vacíos, máximo 3 por lista, y
 * en "sobra" sólo prendas que de verdad lleva (el modelo a veces parafrasea el
 * nombre y entonces no se puede señalar cuál es). null si no trae veredicto.
 */
export function leerRevision(crudo: unknown, lleva: Set<string>, firma: string, ahora: Date = new Date()): RevisionMaleta | null {
  const r = (crudo ?? {}) as Record<string, unknown>;
  const veredicto = texto(r.veredicto);
  if (!veredicto) return null;
  const lista = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    veredicto,
    looks: Number.isFinite(Number(r.looks)) ? Math.max(0, Math.round(Number(r.looks))) : 0,
    bien: lista(r.bien).map(texto).filter(Boolean).slice(0, 3),
    sobra: lista(r.sobra)
      .map((x) => ({ prenda: texto((x as Record<string, unknown>)?.prenda), porque: texto((x as Record<string, unknown>)?.porque) }))
      .filter((x) => x.prenda && lleva.has(x.prenda))
      .slice(0, 3),
    falta: lista(r.falta)
      .map((x) => ({ que: texto((x as Record<string, unknown>)?.que), porque: texto((x as Record<string, unknown>)?.porque) }))
      .filter((x) => x.que)
      .slice(0, 3),
    firma,
    fecha: ahora.toISOString(),
    version: "revision-v1",
  };
}

/** Lo guardado en trips.revision, si tiene forma de revisión. */
export function revisionGuardada(v: unknown): RevisionMaleta | null {
  const r = v as RevisionMaleta | null;
  return r && typeof r.veredicto === "string" && typeof r.firma === "string" ? r : null;
}
