import { esPrendaBase } from "@/lib/engine/piezas-tipo";

// LA MALETA AGRUPADA Y CONTADA (2026-10-21). Roberto, empacando: "ver un
// resumen de lo que estás empacando: cuántas camisas, cuántos pantalones,
// abrigos… agrupado en vez de todo revuelto; es más fácil identificar si hay
// mucho o poco de algo, o si falta". La cuadrícula mezclaba playeras, botines y
// abrigos en el orden de la cápsula.
//
// Los grupos van de lo pegado a la piel (lo que menos se repite) hacia afuera,
// y al final zapatos y accesorios. "Pide" es el piso del viaje (lib/trip.ts
// capsuleFloor): sólo en los grupos donde hay un mínimo que cumplir.

export type GrupoMaleta = "base" | "capas" | "abajo" | "vestidos" | "abrigos" | "calzado" | "accesorios";

export const GRUPOS: { id: GrupoMaleta; label: string }[] = [
  { id: "base", label: "camisas, playeras y blusas" },
  { id: "capas", label: "suéteres y capas" },
  { id: "abajo", label: "pantalones y faldas" },
  { id: "vestidos", label: "vestidos" },
  { id: "abrigos", label: "abrigos y sacos" },
  { id: "calzado", label: "zapatos" },
  { id: "accesorios", label: "accesorios" },
];

export function grupoDePieza(p: { category: string; nombre: string; tipo?: string | null }): GrupoMaleta {
  switch (p.category) {
    case "top":
      return esPrendaBase(p) ? "base" : "capas";
    case "vestido":
      return "vestidos";
    case "bottom":
      return "abajo";
    case "abrigo":
    case "saco":
      return "abrigos";
    case "calzado":
      return "calzado";
    default:
      return "accesorios";
  }
}

/** Las piezas por grupo, en el orden de GRUPOS, sin grupos vacíos. */
export function agruparPiezas<T>(items: T[], pieza: (t: T) => { category: string; nombre: string; tipo?: string | null }) {
  return GRUPOS.map((g) => ({ ...g, items: items.filter((t) => grupoDePieza(pieza(t)) === g.id) })).filter((g) => g.items.length > 0);
}

export type PisoMaleta = { base: number; bottoms: number; calzado: number };

/** El resumen: cuántas por grupo y, donde el viaje pide un mínimo, cuántas pide. */
export function resumenDeMaleta<T>(
  items: T[],
  pieza: (t: T) => { category: string; nombre: string; tipo?: string | null },
  piso: PisoMaleta | null
): { id: GrupoMaleta; label: string; n: number; pide: number | null }[] {
  const pide: Partial<Record<GrupoMaleta, number>> = piso ? { base: piso.base, abajo: piso.bottoms, calzado: piso.calzado } : {};
  return GRUPOS.map((g) => ({
    id: g.id,
    label: g.label,
    n: items.filter((t) => grupoDePieza(pieza(t)) === g.id).length,
    pide: pide[g.id] ?? null,
  })).filter((g) => g.n > 0 || (g.pide ?? 0) > 0);
}
