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
  /** Ganó tu prenda: "me quedo con la mía" (cand:i === sub:i) o una que
   *  elegiste a mano de tu clóset (sub:i, 2026-10-21 "elegir otra de mi clóset"). */
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
  // Una prenda elegida a mano (sub:i distinta de la candidata, o sin candidata)
  // también cierra el duelo a favor de lo tuyo: sin esto, al recargar le volvía
  // a preguntar por la pieza que ya resolvió.
  for (const [k, v] of Object.entries(overrides ?? {})) {
    const mSub = k.match(/^sub:(\d+)$/);
    if (mSub && typeof v === "string" && v.trim() && !ganados.includes(Number(mSub[1]))) ganados.push(Number(mSub[1]));
  }
  return { candidatas, descartados, ganados };
}

// UNA PRENDA, UN LUGAR EN LA MALETA (2026-10-15).
//
// Las candidatas del duelo ("¿llevas tu suéter en vez del sugerido?") se
// buscan para todos los huecos A LA VEZ, y ninguna búsqueda sabía lo que
// eligieron las otras. Con un clóset chico, la misma prenda salía como la
// mejor opción de dos huecos: en una maleta real, el mismo "Suéter de cuello
// alto negro" se propuso y se aceptó para dos piezas distintas, y la maleta lo
// contó dos veces. En los LOOKS repetir una prenda es la gracia de una
// cápsula; en la LISTA de lo que se empaca, una prenda física ocupa un lugar.
//
// Reparto: hueco por hueco, en el orden de la lista, cada uno se queda con su
// mejor opción que nadie haya tomado; si sus tres opciones ya están tomadas,
// se queda sin candidata (y la persona puede elegir de su clóset a mano).

export type ResultadoHueco<T extends { nombre: string }> = { i: number; matches: T[] };

export function repartirCandidatas<T extends { nombre: string }>(
  resultados: ResultadoHueco<T>[],
  /** Prendas que ya ocupan un lugar o ya están propuestas para otro hueco. */
  tomadas: Set<string>
): Map<number, T | null> {
  const ocupadas = new Set(tomadas);
  const out = new Map<number, T | null>();
  for (const r of [...resultados].sort((a, b) => a.i - b.i)) {
    const elegida = r.matches.find((m) => !ocupadas.has(m.nombre)) ?? null;
    if (elegida) ocupadas.add(elegida.nombre);
    out.set(r.i, elegida);
  }
  return out;
}
