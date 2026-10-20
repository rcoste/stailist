// REGLAS DEL CRUCE QUE NO DEPENDEN DE LA IA (2026-10-18).
//
// El cruce de esenciales contra el clóset lo decide la IA (lib/engine/
// capsule-match.ts) y ya tenía guardias de clase, contexto, largo y accesorio.
// Faltaban tres, que salieron de la cápsula real de una persona:
//
//  1. EL COLOR. El prompt ya dice que un color específico (camel, vino…) no se
//     sustituye, y aun así su abrigo largo NEGRO quedó como "parecido" del
//     abrigo CHOCOLATE. Y no decía nada de neutro oscuro contra neutro claro:
//     su camiseta NEGRA salió "parecido" de una camiseta BLANCA. Aquí: entre
//     familias de color distintas sólo hay "parecido" si las dos son neutros
//     oscuros (negro, gris, marino) o las dos neutros claros (blanco, crema);
//     lo demás es "falta". Y un "tienes" entre dos neutros distintos baja a
//     "parecido", que es lo que el prompt pedía.
//  2. UNA PRENDA NO CUBRE DOS PIEZAS. La misma camiseta negra era "la tienes"
//     de la playera negra y "parecido" de la blanca. Si ya es "tienes" en una,
//     no puede ser "parecido" en otra.
//  3. LA QUE QUEDÓ LIBRE SE OFRECE. Con su abrigo negro ocupado en el
//     chocolate, el "abrigo largo de lana negro" quedó como que le falta,
//     teniéndolo; y la IA le marcaba como faltantes unas "Medias opacas negras"
//     que tiene con ESE nombre. Si una pieza quedó en "falta" y hay una prenda
//     suya SIN USAR, de la misma categoría, del mismo color y con dos palabras
//     de clase en común (sin materiales), se ofrece como "parecido".
//     "Parecido" y no "tienes" a propósito: el nombre no ve el tipo fino
//     (henley vs camiseta) que la IA sí pudo haber visto.
//
// Y tres más del 2026-10-19, de la maleta de la misma persona (versión m9):
//  - "Botas altas negras" y "Botines negros de punta" quedaban las dos como
//    "tienes" con sus MISMAS botines (2 de 2 corridas): la regla 2 sólo veía
//    "tienes" contra "parecido". Ahora tampoco dos "tienes".
//  - Unos jeans son jeans: la IA le dio sus pantalones de vestir negros a unos
//    "jeans negros" — y así le quitó a la pieza que sí eran (wide leg).
//  - El rescate no la encontraba: "Pantalones de vestir negros" (corte
//    holgado) contra "Pantalón wide leg negro" no compartían NI una palabra
//    ("pantalones" ≠ "pantalón"; "wide leg" vive en el corte, no en el
//    nombre). La app le dijo que le faltaba y lo mandó a la wishlist. Ahora
//    las palabras van en singular y el corte cuenta como palabra de clase.
//
// Lógica pura y con pruebas; capsule-match.ts la aplica al final.

import type { CapsuleItem, ClosetItemLite, MatchEntry } from "@/lib/capsule";
import { coloresCercanos } from "@/lib/paleta-colores";
import { palabras } from "@/lib/ya-la-tienes";

const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Familia de color por palabra clave, en orden: lo más específico primero
// ("azul marino" antes que "azul", "gris oscuro" cae en gris).
const FAMILIAS: [string, RegExp][] = [
  // Marino es sólo marino: "azul oscuro", índigo y mezclilla son AZUL. Con
  // "azul oscuro" dentro de marino, los jeans índigo de 11 cápsulas quedaban
  // como "falta" contra unos "Jeans azul oscuro" (corrida en seco del 10-18).
  ["marino", /marino|navy|medianoche/],
  ["negro", /negr[oa]|\bblack\b/],
  ["gris", /gris|carbon|grafito|plomo|antracita/],
  ["blanco", /blanc[oa]|off.?white/],
  ["crema", /crema|hueso|marfil|ivory|ecru/],
  ["camel", /camel|cognac|caramelo|\btan\b/],
  ["cafe", /cafe|chocolate|marron|tabaco|moka|chocolat/],
  ["beige", /beige|arena|khaki|caqui|topo|taupe|nude/],
  ["vino", /vino|burdeos|borgo|guinda|berenjena/],
  ["rojo", /roj[oa]|rubi|cereza|carmin/],
  ["verde", /verde|esmeralda|oliva|militar|salvia|menta/],
  ["azul", /azul|celeste|cielo|cobalto|denim|indigo|mezclilla/],
  ["rosa", /rosa|fucsia|magenta/],
  ["morado", /morad[oa]|lila|lavanda|violeta|purpura/],
  ["amarillo", /amarill|mostaza|ocre/],
  ["naranja", /naranja|terracota|coral|oxido/],
  ["metal", /plata|plateado|dorado|oro|bronce/],
];

export function familiaDeColor(texto: string | null | undefined): string | null {
  const t = sinTildes(texto ?? "");
  if (!t) return null;
  for (const [f, re] of FAMILIAS) if (re.test(t)) return f;
  return null;
}

/** La familia de una prenda real: su color escrito, y si no, el más cercano de la paleta a su hex. */
export function familiaDePrenda(p: Pick<ClosetItemLite, "color" | "color_hex" | "nombre">): string | null {
  return (
    familiaDeColor(p.color) ??
    familiaDeColor(p.nombre) ??
    (p.color_hex ? familiaDeColor(coloresCercanos(p.color_hex, 1)[0]?.name) : null)
  );
}

const OSCUROS = new Set(["negro", "gris", "marino"]);
// Vecinos: colores distintos que un stylist sí ofrecería como "parecido" (el
// duelo le pregunta a ella). Salieron de la corrida en seco: camel contra café,
// rubí contra vino, khaki contra camel, blanco contra hueso.
const VECINOS = new Set(["cafe|camel", "beige|camel", "rojo|vino", "blanco|crema", "beige|crema"].map((p) => p.split("|").sort().join("|")));
const vecinos = (a: string, b: string) => VECINOS.has([a, b].sort().join("|"));

/** El máximo que permite el color: "parecido", "falta", o null si el color no decide. */
function techoPorColor(ideal: string | null, real: string | null): "parecido" | "falta" | null {
  if (!ideal || !real || ideal === real) return null;
  if ((OSCUROS.has(ideal) && OSCUROS.has(real)) || vecinos(ideal, real)) return "parecido";
  return "falta";
}

// Materiales: no cuentan como "la misma clase de prenda" (unos tenis de piel no
// son unas sandalias de piel).
const MATERIALES = new Set(["piel", "lino", "lana", "algodon", "punto", "seda", "saten", "gamuza", "ante", "mezclilla", "cuero", "sintetica", "sintetico", "merino", "cashmere", "pima", "popelina"]);
// En singular, igual de los dos lados: "pantalones" y "pantalón" son la misma
// clase (sin esto, su pantalón ancho negro no compartía ni una palabra).
export const singular = (w: string) =>
  /(on|in)es$/.test(w) ? w.slice(0, -2) : /[^s]s$/.test(w) && w.length > 4 ? w.slice(0, -1) : w;
/** Las palabras que dicen QUÉ es una prenda: sin colores, sin materiales, en singular. */
export const deClase = (s: string) => new Set([...palabras(s)].filter((w) => !MATERIALES.has(w)).map(singular));
// El corte que la visión le leyó a la prenda, como las palabras con que una
// pieza ideal lo nombra. Sólo en bottoms: es donde el nombre de la pieza lo
// trae ("wide leg", "pierna recta") y el de la prenda real casi nunca.
const PALABRAS_DE_CORTE: Record<string, string[]> = {
  holgado: ["holgado", "ancho", "ancha", "wide", "leg", "amplio", "palazzo"],
  recto: ["recto", "recta", "straight"],
  entallado: ["entallado", "slim", "skinny", "pitillo", "ajustado"],
};
/** Las de una prenda real, más las de su corte si es bottom ("holgado" → ancho, wide leg…). */
export const deClaseReal = (c: ClosetItemLite) => {
  const w = deClase(c.nombre);
  if (c.category === "bottom" && c.corte) for (const p of PALABRAS_DE_CORTE[norm(c.corte)] ?? []) w.add(p);
  return w;
};
// Unos jeans son jeans: la mezclilla no la sustituye un pantalón de vestir, ni al revés.
const esJeans = (s: string) => /\bjeans?\b|mezclilla|denim/.test(norm(s));

const zona = (cat: string) => (cat === "top" || cat === "abrigo" ? "torso" : cat);
const norm = sinTildes;

export type CambioDeRegla = { index: number; regla: 1 | 2 | 3; antes: MatchEntry; despues: MatchEntry };

export function aplicarReglasDelCruce(
  items: CapsuleItem[],
  entries: MatchEntry[],
  closet: ClosetItemLite[]
): { entries: MatchEntry[]; cambios: CambioDeRegla[] } {
  const porNombre = new Map(closet.map((c) => [norm(c.nombre), c]));
  const prendaDe = (by: string | null): ClosetItemLite | null => {
    if (!by) return null;
    const n = norm(by);
    if (porNombre.has(n)) return porNombre.get(n)!;
    for (const c of closet) {
      const cn = norm(c.nombre);
      if (cn && (cn.includes(n) || n.includes(cn))) return c;
    }
    return null;
  };
  const out = entries.map((e) => ({ ...e }));
  const cambios: CambioDeRegla[] = [];
  const cambiar = (i: number, regla: 1 | 2 | 3, despues: MatchEntry) => {
    cambios.push({ index: i, regla, antes: entries[i] ?? out[i], despues });
    out[i] = despues;
  };

  // 1 · el color
  items.forEach((it, i) => {
    const e = out[i];
    if (!e || e.status === "falta") return;
    const real = prendaDe(e.by);
    if (!real) return;
    const techo = techoPorColor(familiaDeColor(it.colorFamilia), familiaDePrenda(real));
    if (techo === "falta") cambiar(i, 1, { status: "falta", by: null, difiere: null });
    else if (techo === "parecido" && e.status === "tienes")
      cambiar(i, 1, { status: "parecido", by: e.by, difiere: `${familiaDePrenda(real)} en vez de ${familiaDeColor(it.colorFamilia)}` });
  });

  // 1b · unos jeans son jeans
  items.forEach((it, i) => {
    const e = out[i];
    if (!e || e.status === "falta" || it.category !== "bottom") return;
    const real = prendaDe(e.by);
    if (!real) return;
    const realEsJeans = esJeans(`${real.nombre} ${real.material ?? ""}`);
    if (esJeans(`${it.nombre} ${it.tipo}`) !== realEsJeans) cambiar(i, 1, { status: "falta", by: null, difiere: null });
  });

  // 2a · ni dos "tienes": la pieza que va primero (la de más prioridad) se la queda
  const yaTiene = new Set<string>();
  out.forEach((e, i) => {
    if (e.status !== "tienes" || !e.by) return;
    const k = norm(prendaDe(e.by)?.nombre ?? e.by);
    if (yaTiene.has(k)) cambiar(i, 2, { status: "falta", by: null, difiere: null });
    else yaTiene.add(k);
  });

  // 2 · una prenda no cubre dos piezas: si ya es "tienes" en una, no es "parecido" en otra
  const enTienes = new Set(out.filter((e) => e.status === "tienes" && e.by).map((e) => norm(e.by!)));
  out.forEach((e, i) => {
    if (e.status === "parecido" && e.by && enTienes.has(norm(e.by))) cambiar(i, 2, { status: "falta", by: null, difiere: null });
  });

  // 3 · la que quedó libre se ofrece como "parecido"
  const usadas = new Set(out.filter((e) => e.status !== "falta" && e.by).map((e) => norm(prendaDe(e.by)?.nombre ?? e.by!)));
  items.forEach((it, i) => {
    if (out[i]?.status !== "falta") return;
    const famIdeal = familiaDeColor(it.colorFamilia);
    if (!famIdeal) return;
    // DOS palabras de clase en común, sin contar materiales ni colores: "abrigo
    // largo", "bolsa cruzada", "medias opacas". Con una sola, la corrida en seco
    // ofrecía un pantalón de traje para cubrir un traje de baño.
    const clase = deClase(it.nombre);
    const libre = closet.find(
      (c) =>
        !usadas.has(norm(c.nombre)) &&
        c.category === it.category &&
        familiaDePrenda(c) === famIdeal &&
        [...deClaseReal(c)].filter((w) => clase.has(w)).length >= 2
    );
    if (!libre) return;
    usadas.add(norm(libre.nombre));
    cambiar(i, 3, { status: "parecido", by: libre.nombre, difiere: "confirma si es la misma" });
  });

  return { entries: out, cambios };
}
