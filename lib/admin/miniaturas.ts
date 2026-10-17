// QUÉ MINIATURAS LLEVA CADA LÍNEA DEL FEED (2026-10-17, boceto aprobado por
// Roberto: "cuando armó un look o añadió prendas, thumbnails de lo que hizo;
// se ve muy flat"). Lógica pura: decide QUÉ se enseña; lib/admin/miniaturas-datos.ts
// trae las imágenes.
//
// No es adorno. "añadió 23 prendas" no dice si fueron 23 fotos propias o 23
// básicos del catálogo, y esa diferencia es la señal de activación que
// encontramos el 2026-10-16 (10 fotos propias el día 0 separa a quien vuelve de
// quien no). Y "generó un look" no dice si salió decente sin abrir la ficha.

import { prendasAlMomento, type Momento } from "@/lib/admin/actividad";

/** Cuántas cuadritos caben en una línea antes del "+N". */
export const MAX_MINIATURAS = 6;

export type PlanMiniaturas =
  /** Prendas añadidas o borradas: las primeras MAX y cuántas eran. */
  | { clase: "prendas"; ids: string[]; total: number; conFoto: number; deCatalogo: number }
  /** Un look (generado, votado, guardado, puesto, probado, espejo): su foto y sus piezas. */
  | { clase: "look"; outfitId: string; masLooks: number }
  /** El clóset con el que llegó a ese momento (una generación que falló por pocas prendas). */
  | { clase: "closet"; ids: string[]; total: number };

export type ItemCrudo = { id: string; user_id: string | null; source?: string | null; created_at: string | null; deleted_at: string | null };

/** Qué enseñar en esta línea, o null si no lleva nada (abrió la app, onboarding, alta…). */
export function planDe(m: Momento, items: ItemCrudo[]): PlanMiniaturas | null {
  if (m.tipo === "prenda_add" || m.tipo === "prenda_del") {
    const sourceDe = new Map(items.map((i) => [i.id, i.source ?? null]));
    const conFoto = m.refIds.filter((id) => sourceDe.get(id) === "photo").length;
    return {
      clase: "prendas",
      ids: m.refIds.slice(0, MAX_MINIATURAS),
      total: m.refIds.length,
      conFoto,
      deCatalogo: m.refIds.length - conFoto,
    };
  }
  if (m.tipo === "ev:generation_failed") {
    const ids = prendasAlMomento(items, m.userId, m.at);
    return { clase: "closet", ids: ids.slice(0, MAX_MINIATURAS), total: ids.length };
  }
  // Un look propio (tabla outfits) o un evento colgado de uno (events.outfit_id
  // es siempre un look). Una ráfaga de looks enseña el primero y cuenta el resto.
  const esLook = m.tipo === "look" || m.tipo === "look_viaje" || m.tipo === "look_del" || m.tipo.startsWith("ev:");
  if (esLook && m.refIds.length > 0) {
    return { clase: "look", outfitId: m.refIds[0], masLooks: m.refIds.length - 1 };
  }
  return null;
}

/** "19 con foto, 4 del catálogo" — o "con foto" cuando fue una sola. */
export function detalleDePrendas(p: { total: number; conFoto: number; deCatalogo: number }): string | null {
  if (p.total === 0) return null;
  if (p.total === 1) return p.conFoto === 1 ? "con foto" : "del catálogo";
  const partes: string[] = [];
  if (p.conFoto > 0) partes.push(`${p.conFoto} con foto`);
  if (p.deCatalogo > 0) partes.push(`${p.deCatalogo} del catálogo`);
  return partes.join(", ");
}
