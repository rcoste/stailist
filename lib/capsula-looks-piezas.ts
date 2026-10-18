// CON QUÉ SE ARMAN LOS LOOKS DE ESENCIALES (2026-10-18, pedido de Roberto).
//
// Hasta hoy, sólo con lo que YA tienes de tu cápsula. Ahora también con lo que
// guardaste en tu wishlist: si ya decidiste que quieres esa pieza, ver qué looks
// te arma es justo lo que ayuda a decidir si comprarla. El viaje ya lo hacía con
// lo que te falta (lib/trip-maleta.ts piezasParaLooks); aquí se acota a la
// wishlist, porque una cápsula trae ~30 faltantes y llenar los looks de cosas
// que ni pediste los volvería un catálogo.
//
// Lo que NO entra (Roberto): una pieza que sigue en comparación ("¿la tuya o la
// sugerida?"). Esa no es una falta todavía; es una decisión pendiente.
//
// Lógica pura: el server action la llama y el test la blinda.

import type { CapsuleRow } from "@/lib/capsule";
import { faltaKey } from "@/lib/capsule-images";
import type { PackableItem } from "@/lib/engine/trip-outfits";

export function piezasDeCapsulaParaLooks(rows: CapsuleRow[], wishKeys: Set<string>): PackableItem[] {
  const out: PackableItem[] = [];
  const nombres = new Set<string>();
  const sumar = (p: Omit<PackableItem, "n">) => {
    if (nombres.has(p.nombre)) return;
    nombres.add(p.nombre);
    out.push({ n: out.length, ...p });
  };
  // Lo que tienes: la prenda de TU clóset que cubre cada pieza (la misma regla
  // de siempre: cubierta y con prenda que la cubre).
  for (const r of rows) {
    if (!r.covered || !r.by) continue;
    sumar({ nombre: r.by, category: r.item.category, color: r.item.colorFamilia, formalidad: r.item.formalidad });
  }
  // Lo que te falta y ya está en tu wishlist: la pieza sugerida, marcada.
  for (const r of rows) {
    if (r.dismissed || r.effective !== "falta") continue;
    if (!wishKeys.has(faltaKey(r.item))) continue;
    sumar({
      nombre: r.item.nombre,
      category: r.item.category,
      color: r.item.colorFamilia,
      formalidad: r.item.formalidad,
      falta: true,
    });
  }
  return out;
}

/** Cuántas son tuyas: con menos de 2 no hay looks que armar (la wishlist sola no basta). */
export function propiasEn(piezas: PackableItem[]): number {
  return piezas.filter((p) => !p.falta).length;
}
