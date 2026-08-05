// Qué tan claro y qué tan vivo es un color, en números.
//
// PARA QUÉ
// Un blueprint no guarda colores, guarda RELACIONES: "capa profunda sobre base
// muy clara, pierna de tono medio que hace de puente". Roberto: "aunque esa foto
// traiga polo azul, para ese polo podría ser perfectamente verde". Guardar
// "azul" empujaría azul contra la colorimetría de cada persona; guardar la
// relación deja que cada quien la cumpla con SUS colores.
//
// Pero una relación en prosa no se puede verificar leyéndola. Estas dos medidas
// la convierten en aritmética: "profunda" es luminancia baja, "un solo tono
// vivo" es contar cuántas prendas pasan un umbral de saturación. Con eso el
// check que revisa el look es CÓDIGO y no otro juicio de modelo — no puede
// alucinar, y falla siempre igual.
//
// Se separa de reglas-ejecucion.ts (que ya tiene rgb/distancia) porque aquello
// mide DISTANCIA entre dos colores —"¿son el mismo tono?"— y esto mide
// posiciones absolutas en dos ejes. Son preguntas distintas y las usan cosas
// distintas.

/** #rrggbb → [r,g,b] en 0-255. null si falta o viene mal escrito. */
export function rgbDe(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Qué tan CLARO es un color, 0 (negro) a 100 (blanco).
 *
 * Luminancia con pesos perceptuales (Rec. 709): el ojo ve el verde mucho más
 * brillante que el azul al mismo valor numérico. Sin los pesos, un marino
 * (#1F2A44) y un oliva medio saldrían parecidos, y son claro y oscuro para
 * cualquiera que los mire.
 */
export function claridad(hex?: string | null): number | null {
  const c = rgbDe(hex);
  if (!c) return null;
  const [r, g, b] = c.map((x) => x / 255);
  return Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 100);
}

/**
 * Qué tan VIVO es un color, 0 (gris/neutro) a 100 (saturado).
 *
 * Es la S de HSV: cuánto se separa el canal más alto del más bajo. Un beige y
 * un carbón salen bajos aunque uno sea claro y el otro oscuro — que es justo lo
 * que hace falta para contar "cuántos colores vivos conviven", donde crema y
 * negro cuentan igual: cero.
 */
export function viveza(hex?: string | null): number | null {
  const c = rgbDe(hex);
  if (!c) return null;
  const mx = Math.max(...c);
  const mn = Math.min(...c);
  return mx === 0 ? 0 : Math.round(((mx - mn) / mx) * 100);
}

/**
 * Las tres bandas de claridad y sus fronteras.
 *
 * Calibradas contra el clóset real de Roberto (127 prendas, todas con hex
 * medido), no inventadas:
 *   overshirt marino 16 · bomber negro 16 · chamarra de piel café 28  → profundo
 *   overshirt oliva 40 · chamarra de mezclilla 40                     → medio
 *   pantalón de vestir gris 43                                        → medio
 *   camiseta arena 73 · camiseta blanca 96                            → claro
 *
 * El corte en 35 deja al oliva y a la mezclilla FUERA de "profundo", que es
 * correcto: puestos como capa oscura sobre base clara no dan el contraste que
 * el blueprint pide. Y el corte en 70 deja arena adentro de "claro", también
 * correcto — arena funciona como base luminosa.
 */
export type Banda = "profundo" | "medio" | "claro";

export function banda(hex?: string | null): Banda | null {
  const l = claridad(hex);
  if (l == null) return null;
  if (l < 35) return "profundo";
  if (l <= 70) return "medio";
  return "claro";
}

/**
 * Umbral para considerar un color "vivo".
 *
 * 45 sobre 100. Debajo viven los neutros y los apagados (el carbón sale 0, el
 * beige ~15, el marino ~54 queda arriba porque el marino SÍ se lee como color).
 * Se usa para contar cuántos tonos vivos conviven, que es la otra mitad de la
 * relación que declara el blueprint.
 */
export const VIVO = 45;

export function esVivo(hex?: string | null): boolean {
  const v = viveza(hex);
  return v != null && v >= VIVO;
}
