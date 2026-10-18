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
const deClase = (s: string) => new Set([...palabras(s)].filter((w) => !MATERIALES.has(w)));

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
        [...deClase(c.nombre)].filter((w) => clase.has(w)).length >= 2
    );
    if (!libre) return;
    usadas.add(norm(libre.nombre));
    cambiar(i, 3, { status: "parecido", by: libre.nombre, difiere: "confirma si es la misma" });
  });

  return { entries: out, cambios };
}
