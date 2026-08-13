// LAS CANDIDATAS DEL DUELO DEL VIAJE — la parte pura.
//
// Una "candidata" es la prenda de TU clóset que la app propone para cubrir una
// falta del plan, calculada sola al abrir (antes vivía detrás de la lupa "en mi
// clóset" y casi nadie la descubría — pieza C de la consistencia con la
// cápsula, 2026-08-13). Se persiste en `trips.overrides` con llaves
// namespaced, el mismo patrón que los sustitutos elegidos ("sub:i"):
//
//   "cand:3"   → "Camisa negra"   la propuesta calculada para el hueco 3
//   "candNo:3" → true             "prefiero la sugerida": no volver a proponer
//
// SEGURO por construcción: capsuleRows solo lee llaves numéricas ("3"), así
// que estas llaves con prefijo son invisibles para el match — igual que "sub:".

export const candKey = (index: number) => `cand:${index}`;
export const candNoKey = (index: number) => `candNo:${index}`;

export type Candidata = { nombre: string; image: string | null };

/**
 * Lee de overrides las candidatas ya calculadas y los duelos ya descartados.
 *
 * Una candidata cuyo nombre ya no resuelve imagen NO se tira: la imagen es
 * cosmética y el nombre es el dato. Pero una candidata que ya es EL sustituto
 * elegido ("sub:i" igual) sí se omite — ese duelo ya se ganó.
 */
export function candidatasDeOverrides(
  overrides: Record<string, unknown> | null | undefined,
  imageDe: (nombre: string) => string | null
): { candidatas: Record<number, Candidata>; descartados: number[] } {
  const candidatas: Record<number, Candidata> = {};
  const descartados: number[] = [];
  for (const [k, v] of Object.entries(overrides ?? {})) {
    const mCand = k.match(/^cand:(\d+)$/);
    if (mCand && typeof v === "string" && v.trim()) {
      const i = Number(mCand[1]);
      const elegido = overrides?.[`sub:${i}`];
      if (typeof elegido === "string" && elegido === v) continue; // ya ganó
      candidatas[i] = { nombre: v, image: imageDe(v) };
      continue;
    }
    const mNo = k.match(/^candNo:(\d+)$/);
    if (mNo && v === true) descartados.push(Number(mNo[1]));
  }
  return { candidatas, descartados };
}
