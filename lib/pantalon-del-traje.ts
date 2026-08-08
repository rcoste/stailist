// EL PANTALÓN QUE FALTA, DERIVADO DEL SACO.
//
// De dónde sale: Roberto, sobre los cuatro "Traje …" que el lector de una
// prenda dejó a medias — "si tengo el traje, tengo el pantalón y tengo el saco…
// está raro si no hay imagen del pantalón". Tiene razón, y cambia lo que se
// puede hacer: en la migración no lo creé porque no sabía si existía, y crear
// ropa que nadie tiene es el problema que llevamos días persiguiendo. Que él lo
// declare es otra cosa — deja de ser invención y pasa a ser un dato suyo.
//
// SE DERIVA, NO SE INVENTA: el color, el material y la temporada salen del saco
// que sí está fotografiado. Lo único que se afirma de más es que un pantalón de
// traje es formal, que es la definición de la prenda. Por eso la certeza es
// 'generica' y no 'exacta': la prenda es suya a propósito, pero nadie la ha
// fotografiado y los detalles finos son heredados.

/** Lo que se le hereda al pantalón, tal como viene del saco. */
export type SacoParaDerivar = {
  nombre: string;
  color?: string | null;
  colorHex?: string | null;
  material?: string | null;
  temporada?: string | null;
};

/**
 * El nombre del pantalón a partir del nombre del saco.
 *
 * "Saco de traje marino de lana" → "Pantalón de traje marino de lana".
 *
 * Se quita el prefijo que nombra la prenda de arriba y se pone el de abajo,
 * conservando lo que describe la TELA (color, material), que es lo que las dos
 * piezas comparten de verdad.
 */
export function nombrePantalon(nombreSaco: string): string {
  // UN ESMOQUIN NO LLEVA "PANTALÓN DE TRAJE". Roberto, viendo el resultado:
  // "Pantalón de traje Esmoquin negro" — dos prendas distintas pegadas y con
  // mayúscula a media frase. El pantalón de un esmoquin se llama pantalón de
  // esmoquin, y su prefijo es otro.
  const esEsmoquin = /\b(esmoquin|smoking|tuxedo)\b/i.test(nombreSaco);
  // \b y \s* (no \s+): con "\s+" un nombre que es SÓLO "Saco" no coincidía y
  // salía "Pantalón de traje Saco". El límite de palabra evita comerse un
  // "Sacos" o un "Trajeado" que empiece igual.
  const limpio = nombreSaco
    .trim()
    .replace(/^saco(\s+de\s+(traje|vestir|esmoquin|smoking))?\b\s*/i, "")
    .replace(/^(blazer|traje|esmoquin|smoking|tuxedo)\b\s*/i, "")
    .replace(/\b(esmoquin|smoking|tuxedo)\b\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const prefijo = esEsmoquin ? "Pantalón de esmoquin" : "Pantalón de traje";
  // En minúscula lo que sigue al prefijo: el nombre del saco puede venir
  // capitalizado y "Pantalón de esmoquin Negro" se lee a descuido.
  const resto = limpio ? limpio[0].toLowerCase() + limpio.slice(1) : "";
  return resto ? `${prefijo} ${resto}` : prefijo;
}

/** Los attrs completos del pantalón derivado. */
export function attrsDelPantalon(saco: SacoParaDerivar): Record<string, unknown> {
  return {
    nombre: nombrePantalon(saco.nombre),
    categoria: "bottom",
    ...(saco.color ? { color: saco.color } : {}),
    ...(saco.colorHex ? { color_hex: saco.colorHex } : {}),
    ...(saco.material ? { material: saco.material } : {}),
    temporada: saco.temporada ?? "todo-el-año",
    // Lo único que se afirma de más, y es la definición de la prenda.
    formalidad: "formal",
    subtipo: "de traje",
  };
}
