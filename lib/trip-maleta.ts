import { capsuleRows, type CapsuleItem, type CapsuleMatch, type CapsuleOverrides, type CapsuleTarget } from "@/lib/capsule";

// QUÉ HAY DE VERDAD EN LA MALETA DE UN VIAJE: la fuente única.
//
// Un hueco de la maleta se cubre de dos formas. La app encuentra una prenda
// tuya que ya sirve (el match: "tienes" o "parecido"), o TÚ eliges una del
// clóset para un hueco que faltaba ("me quedo con la mía"), que se guarda en
// overrides como "sub:<i>". La página del viaje sumaba las dos; el armador de
// looks (/api/trip/[id]/outfits) sólo leía la primera.
//
// Lo que costó (reporte real, 2026-10-13): un viaje de 20 días a París con 23
// prendas en la maleta y 8 sustitutos elegidos a mano. Al armador le llegaban
// 9 prendas con dos pantalones, y salieron 15 looks con los mismos dos
// suéteres, dos jeans y dos pares de zapatos. "Solo me da 8 looks con las
// mismas 4 prendas, no usa ninguna otra de las que me aparecen."

/** El sustituto que la persona eligió para el hueco i, si lo hay. */
export function sustitutoDe(overrides: CapsuleOverrides | null, index: number): string | null {
  const v = (overrides as Record<string, unknown> | null)?.[`sub:${index}`];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export type PrendaEmpacable = {
  index: number;
  /** El nombre de la prenda del clóset que cubre el hueco (como la conoce el motor). */
  nombre: string;
  item: CapsuleItem;
};

/**
 * Las prendas del clóset que van en la maleta, una vez cada una.
 *
 * Entra un hueco si lo cubre la app ("tienes", o "parecido" sin rechazar —
 * ropa real tuya cercana: si está en tu maleta debe contar) o si elegiste un
 * sustituto, que gana sobre lo que haya encontrado la app. No entran las
 * candidatas que la app propuso y no aceptaste ("cand:"), ni lo que falta sin
 * sustituto. La misma prenda cubriendo dos huecos cuenta una vez: no se
 * empaca dos veces.
 */
export function empacablesDelViaje(
  target: CapsuleTarget,
  match: CapsuleMatch | null,
  overrides: CapsuleOverrides | null
): PrendaEmpacable[] {
  const vistas = new Set<string>();
  const salida: PrendaEmpacable[] = [];
  for (const r of capsuleRows(target, match, overrides)) {
    // Lo que sacó del viaje no se empaca aunque algo suyo lo cubriera.
    if (r.dismissed) continue;
    const sub = sustitutoDe(overrides, r.index);
    const cubre = sub ?? ((r.covered || r.effective === "parecido") ? r.by : null);
    if (!cubre || vistas.has(cubre)) continue;
    vistas.add(cubre);
    salida.push({ index: r.index, nombre: cubre, item: r.item });
  }
  return salida;
}
