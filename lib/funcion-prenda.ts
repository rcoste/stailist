// PARA QUÉ SIRVE UNA PRENDA, cuando sirve para algo que otra no puede hacer
// (2026-10-14).
//
// EL CASO: para el "Trench negro impermeable" de una maleta a Kioto en
// temporada de lluvias, la app ofreció como sustituto un "Blazer estructurado
// negro". El prompt del buscador ya decía "NUNCA cruces clases" y la IA cruzó
// igual (trench = abrigo, blazer = saco); y nada hablaba de FUNCIÓN. Roberto:
// "un traje de baño no lo puedes cambiar por unos shorts porque es una función
// distinta".
//
// CON SOMBRERO DE STYLIST: casi toda la ropa se sustituye por otra de su clase
// (un pantalón negro por otro). Unas pocas piezas existen para una tarea que
// ninguna otra cumple: protegerte de la lluvia, meterte al agua, aguantar frío
// de verdad. Esas sólo se sustituyen por otra que haga lo mismo. La lista es
// corta a propósito y sale del NOMBRE, no de la IA: una etiqueta que inventa el
// modelo se equivoca igual que el modelo.
//
// CON SOMBRERO DE CÓDIGO: es la regla dura que el prompt no logró imponer. Se
// aplica ANTES de preguntarle a la IA (lo que no pasa el filtro ni lo ve), y de
// paso ahorra la llamada cuando nada sirve.

export type FuncionPrenda = "nadar" | "lluvia" | "frio-extremo";

export const NOMBRE_FUNCION: Record<FuncionPrenda, string> = {
  nadar: "para nadar",
  lluvia: "para lluvia",
  "frio-extremo": "para frío extremo",
};

const sinAcentos = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// El orden importa: una "parka impermeable" es primero de lluvia.
const REGLAS: [FuncionPrenda, RegExp][] = [
  ["nadar", /\b(traje de bano|banador|bikini|trikini|trusa|ropa de bano|short de bano|bermuda de bano|rashguard)\b/],
  ["lluvia", /\b(impermeable|lluvia|rompevientos|trench|gabardina|chubasquero|poncho)\b/],
  ["frio-extremo", /\b(plumon|plumas|parka|acolchad[oa]|termic[oa]|nieve|esqui)\b/],
];

/** La función de una prenda por su nombre (y tipo), o null si es intercambiable. */
export function funcionDe(texto: string | null | undefined): FuncionPrenda | null {
  const t = sinAcentos(texto ?? "");
  for (const [f, re] of REGLAS) if (re.test(t)) return f;
  return null;
}

/**
 * UN SUÉTER ES UN SUÉTER, LO HAYA GUARDADO LA FOTO COMO TOP O COMO ABRIGO
 * (2026-10-19). La lectura de fotos manda un "suéter grueso" a 'abrigo' (capa
 * por clima) y la maleta pide sus suéteres como 'top': de 165 suéteres en la
 * base, 40 son 'abrigo'. Así, para el "Suéter de punto esmeralda" de una maleta
 * real, "lo elijo de mi clóset" no enseñaba el "Suéter de punto verde" que la
 * persona acababa de subir. Entre top y abrigo el cruce se permite SÓLO si las
 * dos son de punto: una blusa sigue sin poder cubrirse con un abrigo.
 */
function esDePunto(p: { nombre: string; tipo?: string | null; category: string }): boolean {
  if (p.category !== "top" && p.category !== "abrigo") return false;
  return /\b(sueter|cardigan|jersey|pullover|cuello alto|cuello tortuga|tortuga|de punto|tejido)\b/.test(
    sinAcentos(`${p.tipo ?? ""} ${p.nombre}`)
  );
}

/**
 * ¿Esta prenda del clóset puede ocupar el lugar de la que falta? Misma
 * categoría siempre; y si la que falta tiene una función, la candidata tiene
 * que tener LA MISMA. Al revés no: un trench puede cubrir un abrigo de lana.
 */
export function sirveComoSustituto(
  falta: { nombre: string; tipo?: string | null; category: string },
  candidata: { nombre: string; category: string }
): boolean {
  if (candidata.category !== falta.category && !(esDePunto(falta) && esDePunto(candidata))) return false;
  const necesita = funcionDe(`${falta.tipo ?? ""} ${falta.nombre}`);
  return necesita === null || funcionDe(candidata.nombre) === necesita;
}
