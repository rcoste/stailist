// EL NOMBRE DEL LOOK, LIMPIO.
//
// POR QUÉ EXISTE
// El 3 de septiembre de 2026 un look de producción se tituló
// "商务 Fluida y moderna". El modelo se fue a otro idioma en la primera palabra
// y nada lo detuvo: el juez mira las prendas, no el título, y el schema sólo
// exige que sea un string. Es un fallo visible en la pantalla más importante
// —el look recién armado— que ningún test iba a ver.
//
// Esto NO es un cambio del motor (regla 4 del improvement loop: lo comprobable
// va en código, no en el prompt). No cambia qué look sale; sólo garantiza que
// el nombre esté en el alfabeto de la app.
//
// Se conserva: letras latinas con acentos, dígitos, espacios y la puntuación
// que un título en español usa (coma, punto, guiones, comillas, signos de
// exclamación e interrogación, dos puntos, ampersand, paréntesis). Todo lo
// demás —ideogramas, emojis, símbolos— se quita.

const PERMITIDO = /[^\p{Script=Latin}\p{N}\s.,;:!¡?¿'"“”‘’&()\-–—/+·]/gu;

export const TITULO_MAX = 60;
export const TITULO_FALLBACK = "tu look";

export function tituloLimpio(nombre: string | null | undefined): string {
  if (!nombre) return TITULO_FALLBACK;
  const limpio = nombre
    .replace(PERMITIDO, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:\-–—/+·]+|[\s,;:\-–—/+·]+$/g, "")
    .trim();
  if (!limpio || !/\p{L}/u.test(limpio)) return TITULO_FALLBACK;
  return limpio.length > TITULO_MAX ? limpio.slice(0, TITULO_MAX).trimEnd() : limpio;
}
