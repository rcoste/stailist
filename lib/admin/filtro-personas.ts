import { esCampanaDePrueba } from "@/lib/embudo-marcas";

// LOS FILTROS DE "QUIÉN" DEL ADMIN: origen (campaña, anuncios, sin anuncio) y
// país. Nacieron en el embudo (2026-10-09) y se movieron aquí el mismo día
// cuando la tabla de retención necesitó los mismos: dos copias de "qué cuenta
// como anuncio" terminan contando distinto.

export type FiltroQuien = { origen: string; pais: string };

/** "—" es la campaña de quien no llegó por un anuncio (campanaDe en adquisicion.ts). */
export function pasaFiltro(p: { campana: string; pais: string | null }, f: FiltroQuien): boolean {
  if (esCampanaDePrueba(p.campana)) return false;
  if (f.origen === "anuncios" && p.campana === "—") return false;
  if (f.origen === "organico" && p.campana !== "—") return false;
  if (!["todas", "anuncios", "organico"].includes(f.origen) && p.campana !== f.origen) return false;
  if (f.pais === "sin" && p.pais) return false;
  if (f.pais !== "todos" && f.pais !== "sin" && p.pais !== f.pais) return false;
  return true;
}

/** Las campañas y países que existen en los datos, para pintar los chips. */
export function opcionesDe(personas: { campana: string; pais: string | null }[]) {
  return {
    campanas: [...new Set(personas.map((p) => p.campana))].filter((c) => c !== "—" && !esCampanaDePrueba(c)).sort(),
    paises: [...new Set(personas.map((p) => p.pais).filter((p): p is string => !!p))].sort(),
  };
}
