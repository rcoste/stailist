// "TENGO UNO PARECIDO": editar la pieza sugerida para que diga cómo es la suya
// (2026-10-14).
//
// El caso: le sugirieron "Cinturón negro con hebilla dorada" y ella tiene uno
// negro con hebilla PLATEADA. "Ya lo tengo" guardaba la sugerida tal cual. Aquí
// viven los ajustes rápidos de la hoja "¿cómo es el tuyo?": cambian la palabra
// dentro del nombre (que es lo que leen el motor y la imagen), respetando el
// género de la palabra ("hebilla plateada", "herrajes plateados").
//
// Lógica pura: la pantalla sólo la llama. El nombre sigue siendo editable a
// mano; esto es el atajo, no la única puerta.

export type Metal = "dorado" | "plateado" | "sin";

const sinAcentos = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** ¿La pieza es de las que llevan herraje? (cinturón, bolsa, reloj…) */
export function tieneHerraje(nombre: string): boolean {
  return /\b(cinturon|bolsa|bolso|cartera|clutch|mochila|reloj|hebilla|herraje|cadena|pulsera|aretes?|collar|anillo)\b/.test(
    sinAcentos(nombre)
  );
}

const METAL_RE = /\b(dorad|platead)(o|a|os|as)\b/i;
const FRASE_METAL_RE = /\s+con\s+(hebillas?|herrajes?|detalles?|cadena)\s+(dorad|platead)(o|a|os|as)\b/i;

export function metalDeNombre(nombre: string): Metal | null {
  const m = nombre.match(METAL_RE);
  if (!m) return null;
  return m[1].toLowerCase() === "dorad" ? "dorado" : "plateado";
}

/** Cambia el metal del nombre; si no lo menciona, lo agrega en la forma natural. */
export function cambiarMetal(nombre: string, metal: Metal): string {
  if (metal === "sin") return nombre.replace(FRASE_METAL_RE, "").replace(METAL_RE, "").replace(/\s{2,}/g, " ").trim();
  const raiz = metal === "dorado" ? "dorad" : "platead";
  if (METAL_RE.test(nombre)) {
    return nombre.replace(METAL_RE, (_, __, fin: string) => `${raiz}${fin}`);
  }
  const frase = /\bcintur/.test(sinAcentos(nombre)) ? `con hebilla ${raiz}a` : `con herrajes ${raiz}os`;
  return `${nombre.trim()} ${frase}`;
}

/** Los colores que ofrece la hoja. Los que no cambian con el género van tal cual. */
export const COLORES_VARIANTE = ["negro", "blanco", "gris", "café", "beige", "azul marino"] as const;
export type ColorVariante = (typeof COLORES_VARIANTE)[number];

// Las palabras de color que se reconocen en un nombre, para reemplazarlas. Las
// de género (negro/negra) llevan su raíz; el resto, la palabra entera.
// Límites con \p{L} y no \b: \b no ve la "é" de "café" como letra y la palabra
// no se encontraba ("Botas de lluvia café" no cambiaba de color).
const COLORES_EN_NOMBRE =
  /(?<!\p{L})(?:(negr|blanc|roj|amarill|morad|dorad)(o|a|os|as)|(gris(?:es)?|caf[eé]|beige|azul marino|azul|marino|camel|chocolate|vino|burdeos|verde|rosa|crema|marr[oó]n|tinto))(?!\p{L})/iu;
const GENERO: Partial<Record<ColorVariante, string>> = { negro: "negr", blanco: "blanc" };

export function colorDeNombre(nombre: string): string | null {
  const m = nombre.match(COLORES_EN_NOMBRE);
  return m ? m[0].toLowerCase() : null;
}

/**
 * La terminación que pide el sustantivo (la primera palabra): "camisa" → a,
 * "jeans" → os, "botas" → as, "cinturón" → o. Hace falta cuando el color de
 * la sugerida no lleva género ("Camisa chocolate"): sin esto salía "Camisa
 * negro". Regla de la casa, no de la RAE: femenino si el singular acaba en -a.
 */
export function terminacionDe(nombre: string): "o" | "a" | "os" | "as" {
  const palabra = sinAcentos(nombre.trim().split(/\s+/)[0] ?? "");
  const plural = palabra.length > 3 && palabra.endsWith("s");
  const singular = plural ? palabra.replace(/(es|s)$/, "") : palabra;
  const fem = /a$/.test(singular) || /a$/.test(palabra.replace(/s$/, ""));
  return fem ? (plural ? "as" : "a") : plural ? "os" : "o";
}

/** Cambia la primera palabra de color del nombre por la elegida, con su género. */
export function cambiarColor(nombre: string, color: ColorVariante): string {
  const m = nombre.match(COLORES_EN_NOMBRE);
  if (!m || m.index === undefined) return nombre;
  // La terminación la manda el sustantivo; si el color viejo ya la traía
  // (negra, blancos), coincide.
  const fin = m[2] ?? terminacionDe(nombre);
  const raiz = GENERO[color];
  const nuevo = raiz ? `${raiz}${fin}` : color;
  return nombre.slice(0, m.index) + nuevo + nombre.slice(m.index + m[0].length);
}
