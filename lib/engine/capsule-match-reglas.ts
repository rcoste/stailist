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
import { esPrendaBase, vaEncima } from "@/lib/engine/piezas-tipo";

const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// CLASE FINA dentro de "accesorio": la zona no alcanza. Un reloj y unos lentes son
// ambos 'accesorio', así que el guard de zona los daba por intercambiables — le
// pasó a Roberto: "Reloj de acero con detalles en oro" emparejado con "Lentes
// redondos". El prompt YA pide distinguirlos y el modelo se lo saltó; esto lo
// blinda en código, que es donde no se olvida.
const CLASES_ACCESORIO: [string, RegExp][] = [
  ["reloj", /reloj/],
  ["lentes", /lentes|gafas|anteojos/],
  ["cinturon", /cinturon/],
  ["bufanda", /bufanda|pashmina|mascada|panuelo/],
  // El gorro de punto abriga; la gorra y el sombrero tapan el sol. A 8 °C una
  // gorra no cubre un gorro (su maleta de Mineápolis, 2026-10-21: "Gorro de
  // punto negro" salió "tienes" con su "Gorra negra"). Va ANTES: "gorro" no
  // debe caer en la clase de la gorra.
  ["gorro", /gorro|beanie/],
  ["sombrero", /gorra|sombrero|boina/],
  ["bolsa", /bolsa|bolso|cartera|mochila|morral|maletin|bandolera|tote/],
  ["joyeria", /collar|arete|anillo|pulsera|brazalete|joyer|cadena/],
  ["corbata", /corbata|pajarita/],
  ["calcetin", /calcet|medias/],
  ["guantes", /guante/],
];
/** null = clase desconocida → no bloquea (mejor dejar pasar que falsear un hueco). */
export function claseAccesorio(texto: string): string | null {
  const n = sinTildes(texto);
  for (const [clase, re] of CLASES_ACCESORIO) if (re.test(n)) return clase;
  return null;
}

// LA TEMPORADA TAMBIÉN MANDA (2026-10-21): para "Camisa blanca de franela
// ligera" en un viaje con mañanas de 8 °C, el cruce le dio su "Camisa de lino
// blanca" como "parecido" ("lino ligero vs franela"): el prompt dice que la
// temporada sólo afina entre "tienes" y "parecido", y una camisa de verano no
// es una versión de una de invierno — es otra prenda para otro clima. Una pieza de frío no la cubre
// una de calor ni una de lino (salvo que la pieza misma sea de lino), y una de
// calor no la cubre una de frío. Sin temporada en alguno de los dos, no bloquea.
export function temporadaCompatible(
  falta: { nombre: string; tipo?: string | null; temporada?: string | null },
  c: { nombre: string; temporada?: string | null; material?: string | null }
): boolean {
  const pideLino = /\blino\b|linen/i.test(`${falta.nombre} ${falta.tipo ?? ""}`);
  const esLino = /\blino\b|linen/i.test(`${c.nombre} ${c.material ?? ""}`);
  if (falta.temporada === "frio") return c.temporada !== "calor" && (pideLino || !esLino);
  if (falta.temporada === "calor") return c.temporada !== "frio";
  return true;
}

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

// La familia de una pieza IDEAL: la que escribió la cápsula, salvo que el
// nombre la estreche. La cápsula escribe "azul" en la familia y "marino" en el
// nombre (6 de 24 piezas "azul" de los viajes vivos al 2026-10-21), y la
// persona lee el nombre. Sin esto su "Chamarra acolchada azul marino" (marino)
// no cubría la "Chamarra acolchada marino" (azul) y el duelo le ofrecía la
// misma chamarra dos veces. SÓLO estrecha, nunca cambia de familia: el orden de
// FAMILIAS no es el orden del texto, y "Camisa blanca de rayas marino" no es
// marino. Marino es la única familia que vive dentro de otra (azul).
const ESTRECHA: Record<string, string> = { azul: "marino" };
export function familiaDePieza(p: Pick<CapsuleItem, "colorFamilia" | "nombre">): string | null {
  const deFamilia = familiaDeColor(p.colorFamilia);
  const delNombre = familiaDeColor(p.nombre);
  if (!deFamilia) return delNombre;
  return delNombre && ESTRECHA[deFamilia] === delNombre ? delNombre : deFamilia;
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
// Detalles que comparten prendas distintas: el cuello, la manga, el cierre. Un
// "Suéter de cuello redondo gris oscuro" y una "Playera cuello redondo gris"
// tenían "cuello" y "redondo" en común y el rescate ofreció la playera como el
// suéter (2026-10-21). Dicen cómo es, no qué es.
// ("largo" no entra: en "abrigo largo" sí dice qué prenda es.)
const DETALLES = new Set(["cuello", "redondo", "redonda", "manga", "boton", "botone", "cierre", "capucha", "ligero", "ligera", "basico", "basica", "clasico", "clasica"]);
/** Las palabras que dicen QUÉ es una prenda: sin colores, sin materiales, sin detalles, en singular. */
export const deClase = (s: string) =>
  new Set([...palabras(s)].filter((w) => !MATERIALES.has(w)).map(singular).filter((w) => !DETALLES.has(w)));
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

/** Lo que dice el rescate: no sabe en qué difiere, sólo que puede ser la misma. */
export const ES_LA_MISMA = "¿es la misma?";

// Entre tops, el rescate sólo empareja la misma capa: una playera (base) no es
// un suéter (capa media) ni un cárdigan (va encima), por más palabras que
// compartan.
const mismaCapa = (a: { category: string; nombre: string; tipo?: string | null }, b: { category: string; nombre: string }) =>
  a.category !== "top" || (esPrendaBase(a) === esPrendaBase(b) && vaEncima(a) === vaEncima(b));

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
    // Dos prendas suyas con el MISMO nombre y distinto color (le pasa: dos
    // "Pantalón técnico marino", uno marino y otro azul): el nombre no dice
    // cuál quiso la IA, así que cuenta la que sí empata en color.
    const homonimas = e.by ? closet.filter((c) => norm(c.nombre) === norm(e.by!)) : [];
    const real =
      homonimas.find((c) => techoPorColor(familiaDePieza(it), familiaDePrenda(c)) === null) ?? prendaDe(e.by);
    if (!real) return;
    const techo = techoPorColor(familiaDePieza(it), familiaDePrenda(real));
    if (techo === "falta") cambiar(i, 1, { status: "falta", by: null, difiere: null });
    else if (techo === "parecido" && e.status === "tienes")
      cambiar(i, 1, { status: "parecido", by: e.by, difiere: `${familiaDePrenda(real)} en vez de ${familiaDePieza(it)}` });
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

  // 1c · la clase fina del accesorio, también aquí: el cruce de la IA ya la
  // revisa, pero al recalcular una maleta lo ya cubierto se conserva sin pasar
  // por ese guard — su gorra seguía cubriendo al gorro de punto.
  items.forEach((it, i) => {
    const e = out[i];
    if (!e || e.status === "falta" || it.category !== "accesorio") return;
    const real = prendaDe(e.by);
    if (!real) return;
    const ideal = claseAccesorio(`${it.nombre} ${it.tipo}`);
    const suya = claseAccesorio(real.nombre);
    if (ideal && suya && ideal !== suya) cambiar(i, 1, { status: "falta", by: null, difiere: null });
  });

  // 1d · un saco de traje no va suelto. La pieza "Saco de lana marino" es un
  // blazer (la cápsula deja los blazers sueltos a propósito, lib/capsule.ts
  // `conjunto`), y la IA le daba el saco de su traje marino teniendo su "Blazer
  // marino" (su maleta de Mineápolis, 2026-10-21; una de dos corridas). El saco
  // de un traje solo, con jeans, se ve como el de un traje al que le falta el
  // pantalón. Si hay un saco suelto suyo del color, va ése; si no, el de traje
  // queda como "parecido" y el duelo le pregunta.
  const esDeTraje = (nombre: string, conjunto?: string | null) => !!conjunto || /\btraje\b|smoking|esmoquin/.test(norm(nombre));
  items.forEach((it, i) => {
    const e = out[i];
    if (!e || e.status === "falta" || it.category !== "saco" || esDeTraje(`${it.nombre} ${it.tipo}`, it.conjunto)) return;
    const real = prendaDe(e.by);
    if (!real || !esDeTraje(real.nombre, real.conjunto)) return;
    const ocupadas = new Set(out.filter((x, j) => j !== i && x.status !== "falta" && x.by).map((x) => norm(prendaDe(x.by)?.nombre ?? x.by!)));
    const sueltos = closet.filter((c) => c.category === "saco" && !esDeTraje(c.nombre, c.conjunto) && !ocupadas.has(norm(c.nombre)));
    const fam = familiaDePieza(it);
    const suelto =
      sueltos.find((c) => techoPorColor(fam, familiaDePrenda(c)) === null) ??
      sueltos.find((c) => techoPorColor(fam, familiaDePrenda(c)) === "parecido");
    if (suelto) {
      // La IA juzgó OTRA prenda: el "tienes" sólo se hereda si el suelto es del
      // mismo color y liso; un saco de cuadros por uno liso es "parecido".
      const mismoColor = techoPorColor(fam, familiaDePrenda(suelto)) === null;
      const estampado = !!suelto.patron && suelto.patron !== "liso";
      cambiar(
        i,
        1,
        !mismoColor
          ? { status: "parecido", by: suelto.nombre, difiere: `${familiaDePrenda(suelto)} en vez de ${fam}` }
          : estampado
            ? { status: "parecido", by: suelto.nombre, difiere: `con ${suelto.patron}` }
            : { status: e.status, by: suelto.nombre, difiere: e.difiere ?? null }
      );
    } else if (e.status === "tienes") {
      cambiar(i, 1, { status: "parecido", by: e.by, difiere: "es el saco de un traje" });
    }
  });

  // 1e · la temporada: una pieza de frío no la cubre una de calor ni una de lino
  items.forEach((it, i) => {
    const e = out[i];
    if (!e || e.status === "falta") return;
    const real = prendaDe(e.by);
    if (real && !temporadaCompatible(it, real)) cambiar(i, 1, { status: "falta", by: null, difiere: null });
  });

  // 1f · una playera no es un suéter: entre tops, la prenda base (lo pegado a
  // la piel) y la capa media no se cubren entre sí. El rescate le ofreció su
  // "Playera cuello redondo gris" por un "Suéter de cuello redondo gris oscuro".
  items.forEach((it, i) => {
    const e = out[i];
    if (!e || e.status === "falta" || it.category !== "top") return;
    const real = prendaDe(e.by);
    if (real && real.category === "top" && esPrendaBase(it) !== esPrendaBase(real)) cambiar(i, 1, { status: "falta", by: null, difiere: null });
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
    const famIdeal = familiaDePieza(it);
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
        temporadaCompatible(it, c) &&
        mismaCapa(it, c) &&
        [...deClaseReal(c)].filter((w) => clase.has(w)).length >= 2
    );
    if (!libre) return;
    usadas.add(norm(libre.nombre));
    cambiar(i, 3, { status: "parecido", by: libre.nombre, difiere: ES_LA_MISMA });
  });

  return { entries: out, cambios };
}
