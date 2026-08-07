// COLOR EN UN ESPACIO PERCEPTUAL (OKLCH), no en RGB.
//
// POR QUÉ, con el caso que lo forzó: el juez visual cazó "cinturón café
// chocolate #5C4433 + mocasines burdeos #5C2A2E" y la regla de cueros NO
// disparó. La causa está medida: la distancia euclidiana RGB entre esos dos
// colores es 26.5, muy por debajo del umbral de 60, así que la regla los leía
// como el mismo café. Pero el MATIZ difiere 30° — uno es café y el otro es
// vino. RGB no separa matiz de luminosidad, así que dos colores oscuros y
// desaturados siempre "se parecen" aunque el ojo los distinga sin esfuerzo.
//
// El research que trajo Roberto (ChatGPT, 2026-08-07) llega a lo mismo desde la
// literatura: "conviene trabajar con CIELAB/CIELCH u OKLCH, donde están
// separadas perceptualmente la luminosidad, el croma y el matiz". Dos fuentes
// independientes apuntando al mismo sitio, que es cuando este proyecto actúa.
//
// SE ELIGIÓ OKLab sobre CIELAB por una razón práctica: se calcula desde sRGB con
// aritmética directa —sin matrices de adaptación ni blanco de referencia— y
// corrige el defecto conocido de CIELAB con los azules, que en este catálogo son
// media paleta (marino, denim, azul rey).

/** #rrggbb → [r,g,b] 0-255. null si falta o viene mal escrito. */
export function rgbDeHex(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB con gamma → lineal. */
const aLineal = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

/**
 * OKLCH: luminosidad (0-1), croma (0-~0.4) y matiz (0-360°).
 *
 * Las tres dimensiones que importan para juzgar ropa, y separadas: si dos
 * prendas comparten luminosidad pero no matiz, son colores distintos aunque
 * "midan" parecido en RGB. Ese es exactamente el caso café/burdeos.
 */
export function oklch(hex?: string | null): { L: number; C: number; h: number } | null {
  const rgb = rgbDeHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(aLineal);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const C = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

/** La diferencia de matiz en grados, por el arco corto (0-180). */
export function distanciaMatiz(a: string | null | undefined, b: string | null | undefined): number | null {
  const x = oklch(a);
  const y = oklch(b);
  if (!x || !y) return null;
  // Un color casi acromático NO tiene matiz significativo: el ángulo de un gris
  // es ruido numérico, y compararlo produciría diferencias enormes entre dos
  // grises idénticos. Por debajo de este croma, se declara "sin matiz".
  const CROMA_MINIMO = 0.02;
  if (x.C < CROMA_MINIMO || y.C < CROMA_MINIMO) return 0;
  const d = Math.abs(x.h - y.h) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * ¿Son el MISMO color a ojo? Dos condiciones a la vez, y las dos hacen falta:
 * parecerse en luminosidad+croma Y compartir matiz.
 *
 * El umbral de matiz (20°) sale del caso que originó todo esto: café (25°) y
 * burdeos (355°) están a 30° y son colores distintos; dos cafés reales del
 * catálogo caen dentro de 10°.
 */
export function mismoColorAOjo(
  a: string | null | undefined,
  b: string | null | undefined,
  opciones: { distanciaMax?: number; matizMax?: number } = {}
): boolean | null {
  const x = oklch(a);
  const y = oklch(b);
  if (!x || !y) return null;
  const dist = Math.hypot(x.L - y.L, x.C - y.C);
  const matiz = distanciaMatiz(a, b) ?? 0;
  return dist <= (opciones.distanciaMax ?? 0.09) && matiz <= (opciones.matizMax ?? 20);
}
