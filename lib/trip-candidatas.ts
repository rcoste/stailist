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
 * Lee de overrides las candidatas y en qué quedó cada duelo.
 *
 * Una candidata cuyo nombre ya no resuelve imagen NO se tira: la imagen es
 * cosmética y el nombre es el dato.
 *
 * LAS GANADAS SIGUEN EN `candidatas`, y eso cambió el 2026-08-13: antes se
 * omitían ("ese duelo ya se ganó") y por eso un duelo resuelto desaparecía sin
 * dejar rastro — no había cómo pintarle el "deshacer" que Roberto pidió. Ahora
 * el mapa trae TODAS y los dos arreglos dicen en qué quedó cada una.
 */
export function candidatasDeOverrides(
  overrides: Record<string, unknown> | null | undefined,
  imageDe: (nombre: string) => string | null
): {
  candidatas: Record<number, Candidata>;
  /** "prefiero la sugerida" (candNo:i): el duelo se cerró a favor de la ideal. */
  descartados: number[];
  /** "me quedo con la mía" (cand:i === sub:i): ganó tu prenda. */
  ganados: number[];
} {
  const candidatas: Record<number, Candidata> = {};
  const descartados: number[] = [];
  const ganados: number[] = [];
  for (const [k, v] of Object.entries(overrides ?? {})) {
    const mCand = k.match(/^cand:(\d+)$/);
    if (mCand && typeof v === "string" && v.trim()) {
      const i = Number(mCand[1]);
      candidatas[i] = { nombre: v, image: imageDe(v) };
      const elegido = overrides?.[`sub:${i}`];
      if (typeof elegido === "string" && elegido === v) ganados.push(i);
      continue;
    }
    const mNo = k.match(/^candNo:(\d+)$/);
    if (mNo && v === true) descartados.push(Number(mNo[1]));
  }
  return { candidatas, descartados, ganados };
}
