import type { CapsuleItem, ClosetItemLite } from "@/lib/capsule";
import { deClase, deClaseReal, familiaDeColor, familiaDePrenda } from "@/lib/engine/capsule-match-reglas";
import { candidatasPosibles } from "@/lib/engine/trip-substitutes";

// "YA LO TENGO" PREGUNTA ANTES DE CREAR (2026-10-20).
//
// En la maleta, "ya lo tengo" sobre una pieza que falta CREABA una prenda nueva.
// Caso real: lo marcó en un "Pantalón wide leg negro" y en un "Pantalón de
// vestir gris recto", y quedaron dos prendas sin foto al lado de sus
// "Pantalones de vestir negros" (corte ancho, con foto) y su "Pantalón de
// vestir gris carbón" — el mismo pantalón dos veces cada uno.
//
// Antes de crear, se le enseñan las prendas suyas que podrían ser ESA: de la
// misma clase (candidatasPosibles: categoría, función, contexto; un suéter
// cruza top/abrigo), de la misma familia de color, y que no estén ya en la
// maleta. Las de más palabras en común primero; máximo 4 — es una pregunta,
// no un catálogo. Si no hay ninguna, se crea como siempre.

export function posiblesDelCloset<T extends ClosetItemLite>(item: CapsuleItem, closet: T[], usadas: Set<string>): T[] {
  const fam = familiaDeColor(item.colorFamilia);
  if (!fam) return [];
  // Las palabras de clase de la prenda real incluyen su corte: para un
  // "Pantalón wide leg negro", sus "Pantalones de vestir negros" de corte
  // holgado van antes que un pantalón sastre recto.
  const clase = deClase(item.nombre);
  const enComun = (c: T) => [...deClaseReal(c)].filter((w) => clase.has(w)).length;
  const vistos = new Set<string>();
  return candidatasPosibles(item, closet.filter((c) => !usadas.has(c.nombre)))
    .filter((c) => familiaDePrenda(c) === fam)
    .filter((c) => (vistos.has(c.nombre) ? false : (vistos.add(c.nombre), true)))
    .sort((a, b) => enComun(b) - enComun(a) || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, 4);
}
