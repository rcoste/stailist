import { tipoCanonico } from "@/lib/capsule-images";

// LA VITRINA DE UNIQLO EN LA MALETA (2026-10-20).
//
// Diseño y revisión: docs/designs/vitrina-de-tienda.md. La idea que llegó fue
// "scrapear el catálogo de seis tiendas"; lo que sobrevivió a la evidencia fue
// esto: la API interna de productos de Uniqlo responde JSON limpio a una
// petición simple (medido desde Vercel el 2026-10-20: US/JP/KR en 250-550 ms),
// Uniqlo NO vende en México, y la maleta ya sabe a qué país vas. Entonces, por
// cada pieza que te FALTA para un viaje a EE. UU., Japón o Corea, se buscan en
// el mercado de destino hasta dos prendas reales en tu color, y la card te las
// enseña con precio y enlace. Nada de IA, nada de tablas: un diccionario a mano
// y la caché de datos de Next (7 días).
//
// Es una PRUEBA de 6 semanas, con lectura escrita antes de construir (7 y 24 de
// noviembre). Pasada VITRINA_HASTA el módulo devuelve vacío y las cards vuelven
// a ser las de siempre; el PR de limpieza borra todo esto el 30 de noviembre.
//
// Lo que está aquí es PURO (mapa de país, término de búsqueda, elección por
// color) salvo `consultarUniqlo`, que es el único fetch. Así los tests corren
// sobre una fixture grabada de la API (lib/__fixtures__) sin tocar la red.

export const VITRINA_HASTA = "2026-11-30";

export type Mercado = "us" | "jp" | "kr";
export type Segmento = "hombre" | "mujer";

type DatosMercado = {
  idioma: string;
  moneda: string;
  simbolo: string;
  nombre: string;
  decimales: number;
};

export const MERCADOS: Record<Mercado, DatosMercado> = {
  us: { idioma: "en", moneda: "USD", simbolo: "US$", nombre: "Uniqlo EE. UU.", decimales: 2 },
  jp: { idioma: "ja", moneda: "JPY", simbolo: "¥", nombre: "Uniqlo Japón", decimales: 0 },
  kr: { idioma: "ko", moneda: "KRW", simbolo: "₩", nombre: "Uniqlo Corea", decimales: 0 },
};

// El `lugar` de una parada es la etiqueta de Open-Meteo "ciudad, estado, país"
// en español (lib/place-suggestions.ts). Se mira sólo el último trozo. Lo que
// no esté aquí no tiene vitrina: Uniqlo no vende en México, y Europa usa otra
// API (medido: `nok` en fr/es/uk). TODO (TODOS.md): guardar country_code en la
// parada y preferirlo a este sufijo.
const PAIS_A_MERCADO: Record<string, Mercado> = {
  "estados unidos": "us",
  "estados unidos de america": "us",
  "united states": "us",
  usa: "us",
  japon: "jp",
  japan: "jp",
  "corea del sur": "kr",
  "republica de corea": "kr",
  "south korea": "kr",
  corea: "kr",
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** ¿La vitrina sigue viva? Pasada la fecha, todo devuelve vacío. */
export function vitrinaViva(hoy: Date = new Date()): boolean {
  return hoy.toISOString().slice(0, 10) <= VITRINA_HASTA;
}

/** El mercado de Uniqlo de una parada, o null si no hay (o la prueba ya terminó). */
export function mercadoDeParada(lugar: string | null | undefined, hoy: Date = new Date()): Mercado | null {
  if (!vitrinaViva(hoy) || !lugar) return null;
  const partes = lugar.split(",").map((p) => slug(p)).filter(Boolean);
  const pais = partes.at(-1);
  if (!pais) return null;
  return PAIS_A_MERCADO[pais] ?? null;
}

/** Los mercados de un viaje, sin repetir y en el orden de las paradas. */
export function mercadosDeParadas(
  paradas: { lugar?: string | null }[] | null | undefined,
  hoy: Date = new Date()
): Mercado[] {
  const vistos = new Set<Mercado>();
  for (const p of paradas ?? []) {
    const m = mercadoDeParada(p.lugar, hoy);
    if (m) vistos.add(m);
  }
  return [...vistos];
}

// --- Término de búsqueda ----------------------------------------------------
//
// Japón y Corea aceptan `q` en inglés (medido: jp q=sweater → 122, kr → 69), y
// los nombres de color también vienen en inglés en los tres mercados. Un solo
// diccionario. La cabeza del tipo pasa por `tipoCanonico` igual que al guardar
// (faltaKey NO canoniza: si alguien recalcula la maleta y el modelo escribe
// "jean" en vez de "jeans", la clave sigue siendo la misma aquí).
//
// Vocabulario medido en la base el 2026-10-20 sobre las piezas que faltan en
// los 13 viajes vivos (cabezas más frecuentes primero).
const TERMINOS: Record<string, string> = {
  sueter: "sweater",
  camisa: "shirt",
  bufanda: "scarf",
  chamarra: "jacket",
  vestido: "dress",
  polo: "polo shirt",
  playera: "t-shirt",
  camiseta: "t-shirt",
  jean: "jeans",
  short: "shorts",
  pantalon: "pants",
  sudadera: "sweatshirt",
  trench: "trench coat",
  gabardina: "trench coat",
  gorro: "beanie",
  blazer: "blazer",
  saco: "blazer",
  blusa: "blouse",
  bota: "boots",
  botin: "ankle boots", // un botín no es una bota alta (2026-10-21: salió "Long Boots")
  cardigan: "cardigan",
  chino: "chinos",
  cinturon: "belt",
  abrigo: "coat",
  jogger: "joggers",
  medias: "tights",
  impermeable: "rain jacket",
  rompevientos: "windbreaker",
  sandalia: "sandals",
  falda: "skirt",
  sobrecamisa: "overshirt",
  tenis: "sneakers",
  top: "top",
  bolsa: "bag",
  boina: "beret",
  cuello: "turtleneck", // "cuello-alto" / "cuello-tortuga"
  parka: "parka",
  chaleco: "vest",
  leggings: "leggings",
  pijama: "pajamas",
  calcetin: "socks",
  guante: "gloves",
};

// Modificadores que cambian la prenda que buscas; lo que no esté aquí se ignora
// ("sueter-grueso" busca "sweater"). "de", "con"… ya los quita tipoCanonico.
const MODIFICADORES: Record<string, string> = {
  punto: "knit",
  tejido: "knit",
  mezclilla: "denim",
  denim: "denim",
  lino: "linen",
  lana: "wool",
  cashmere: "cashmere",
  piel: "leather",
  cuero: "leather",
  algodon: "cotton",
  acolchado: "puffer",
  acolchada: "puffer",
  polar: "fleece",
  "wide-leg": "wide",
  wide: "wide",
  cierre: "zip",
  capucha: "hoodie",
  largo: "long",
  larga: "long",
  cargo: "cargo",
  plisada: "pleated",
  midi: "midi",
  // Vistos en los 50 huecos reales del 2026-10-21 y que no llegaban a la búsqueda:
  impermeable: "rain",
  camisero: "shirt",
  hombro: "shoulder",
  cruzada: "crossbody",
  cruzado: "crossbody",
  pequeno: "mini",
  pequena: "mini",
  recto: "straight",
  recta: "straight",
  rectos: "straight",
  vestir: "smart",
  altas: "long",
  oversize: "oversized",
  chino: "chino",
};

/**
 * El término en inglés con el que se busca un tipo de prenda; null si no
 * sabemos buscarlo. Los modificadores salen del `tipo` Y del `nombre` de la
 * pieza: "Short de lino negro" trae tipo "short" a secas, y buscar "shorts"
 * sin "linen" le devolvió a Roberto bóxers y shorts de sudadera (2026-10-21).
 */
/**
 * Los atributos que un FILTRO exige que la ficha diga y que por eso tienen que
 * ir en la búsqueda: si no van, los primeros 20 resultados casi nunca los traen
 * y el hueco se queda vacío aunque Uniqlo sí tenga la prenda. Caso que lo
 * destapó (2026-10-21, al votar): "Suéter de cuello alto negro" buscaba
 * "sweater"; entre los 20 primeros de EE. UU. no había ningún cuello de
 * tortuga y el filtro de cuello los tiró todos, cuando "turtleneck sweater"
 * trae un Cashmere Turtleneck Sweater de hombre en negro.
 * Se leen del tipo, del nombre Y de la descripción visual: "Suéter de punto
 * vino" guarda el cuello en la descripción ("cuello alto suelto"). De la
 * descripción entran SÓLO estos (lo que filtra), no "punto" ni "lana" (que
 * sólo ordenan): sumar todo a la búsqueda fue lo que vació Japón y Corea.
 */
const CUELLO_ALTO_PEDIDO = /cuello (alto|tortuga|de tortuga|vuelto|mock)|turtleneck|mock neck/;
const CUELLO_V_PEDIDO = /cuello (en )?v\b|escote (en )?v\b|v-neck/;
const DE_LA_DESCRIPCION: Record<string, string> = { piel: "leather", cuero: "leather", impermeable: "rain" };

export function terminoDe(tipo: string | null | undefined, nombre?: string | null, visual?: string | null): string | null {
  if (!tipo) return null;
  const canon = tipoCanonico(tipo);
  const [cabeza, ...restoCrudo] = canon.split("-");
  const base = TERMINOS[cabeza];
  if (!base) return null;
  // "cuello-alto" / "cuello-tortuga": la cabeza ya dice turtleneck.
  if (cabeza === "cuello") return base;
  // El tipo también puede traer la manga ("playera-manga-larga"): no es largo de prenda.
  const resto = restoCrudo.filter((w, i, arr) => w !== "manga" && arr[i - 1] !== "manga");
  // "manga corta/larga" habla de la manga, no del largo de la prenda: esas
  // palabras no entran como modificador ("larga" → "long" es para un abrigo).
  const palabrasNombre = (nombre ? tipoCanonico(nombre).split("-") : []).filter(
    (w, i, arr) => w !== "manga" && arr[i - 1] !== "manga"
  );
  const mods: string[] = [];
  for (const m of [...resto, ...palabrasNombre]) {
    const t = MODIFICADORES[m];
    if (t && !mods.includes(t) && !base.includes(t)) mods.push(t);
  }
  // De la descripción, sólo lo que un filtro exige (piel, impermeable).
  for (const w of visual ? tipoCanonico(visual).split("-") : []) {
    const t = DE_LA_DESCRIPCION[w];
    if (t && !mods.includes(t) && !base.includes(t)) mods.push(t);
  }
  // "De vestir" es "Smart" sólo en pantalones (Smart Ankle Pants…); en una camisa estorba la búsqueda.
  if (base !== "pants" && mods.includes("smart")) mods.splice(mods.indexOf("smart"), 1);
  // La manga va en la búsqueda sólo cuando contradice la convención de Uniqlo
  // para esa prenda (una camisa sin etiqueta es de manga larga; una playera o
  // un polo sin etiqueta, de manga corta): "short sleeve shirt" trae camisas
  // de manga corta; "shirt" a secas trae puras de manga larga.
  const pieza = `${tipo} ${nombre ?? ""} ${visual ?? ""}`;
  const manga = mangaDe(pieza);
  if (manga && MANGA_POR_DEFECTO[base] && MANGA_POR_DEFECTO[base] !== manga && manga !== "sin") {
    mods.unshift(manga === "corta" ? "short sleeve" : "long sleeve");
  }
  // El cuello que el filtro exige, primero: "turtleneck sweater", "v-neck knit sweater".
  const texto = slug(pieza.replace(/-/g, " "));
  const cuello = CUELLO_ALTO_PEDIDO.test(texto) ? "turtleneck" : CUELLO_V_PEDIDO.test(texto) ? "v-neck" : null;
  if (cuello && !base.includes(cuello)) mods.unshift(cuello);
  return [...mods, base].join(" ");
}

// --- Manga ---------------------------------------------------------------------
//
// Caso real (2026-10-21): a "Camisa de manga corta negra" la vitrina le ofrecía
// "Waffle T-Shirt" y "Waffle Henley Neck T-Shirt | Long Sleeve". Uniqlo escribe
// la manga en el nombre SÓLO cuando no es la de siempre para esa prenda.
export type Manga = "corta" | "larga" | "sin";

const MANGA_POR_DEFECTO: Record<string, Manga> = {
  shirt: "larga",
  overshirt: "larga",
  "t-shirt": "corta",
  "polo shirt": "corta",
};

/** La manga que pide la pieza ("Camisa de manga corta negra" → "corta"), o null si no dice. */
export function mangaDe(texto: string | null | undefined): Manga | null {
  const t = slug(texto ?? "");
  if (/sin mangas?|tirantes|sleeveless/.test(t)) return "sin";
  if (/manga corta|media manga|short sleeve/.test(t)) return "corta";
  if (/manga larga|long sleeve/.test(t)) return "larga";
  return null;
}

const DICE_CORTA = /short[- ]sleeve|half[- ]sleeve|半袖|반팔|반소매/i;
const DICE_LARGA = /long[- ]sleeve|長袖|긴팔|긴소매/i;
const DICE_SIN = /sleeveless|tank|camisole|ノースリーブ|タンク|민소매|나시/i;

/**
 * ¿La ficha respeta la manga pedida? Lo que la ficha DICE en contra siempre
 * descarta. Y cuando la manga pedida no es la de siempre para esa prenda, el
 * nombre (en inglés) tiene que decirla: una "Shirt" a secas es de manga larga.
 */
export function mangaCompatible(nombreFicha: string, manga: Manga | null, termino: string): boolean {
  if (!manga) return true;
  const contra =
    manga === "corta" ? DICE_LARGA.test(nombreFicha) || DICE_SIN.test(nombreFicha)
    : manga === "larga" ? DICE_CORTA.test(nombreFicha) || DICE_SIN.test(nombreFicha)
    : DICE_CORTA.test(nombreFicha) || DICE_LARGA.test(nombreFicha);
  if (contra) return false;
  // Sin exención para japonés y coreano (2026-10-21): Uniqlo también ahí
  // escribe la manga cuando no es la de siempre (半袖, 반팔). La exención no
  // dañaba mientras "short sleeve shirt" devolvía cero en JP/KR; con los
  // escalones de búsqueda, dejaba pasar camisas de manga larga.
  // La más larga primero: "t-shirt" y "polo shirt" también terminan en "shirt".
  const base = Object.keys(MANGA_POR_DEFECTO).sort((a, b) => b.length - a.length).find((b) => termino.endsWith(b)) ?? null;
  const porDefecto = base ? MANGA_POR_DEFECTO[base] : null;
  if (!porDefecto || porDefecto === manga) return true;
  return manga === "corta" ? DICE_CORTA.test(nombreFicha) : manga === "larga" ? DICE_LARGA.test(nombreFicha) : DICE_SIN.test(nombreFicha);
}

// --- Liso contra estampado -------------------------------------------------------
//
// El color de Uniqlo "BLACK" de una camisa estampada es el fondo del estampado.
// Si la pieza pedida no dice ningún patrón, una prenda a rayas, cuadros o
// estampada NO es esa pieza ("Open Collar Shirt | Short Sleeve | Printed" para
// una camisa negra sobria; "Linen Cotton Shorts | Striped" para un short negro).
const PATRON_PEDIDO = /raya|estampad|cuadro|cuadri|floral|flor|print|animal|lunar|tartan|jacquard|bord|leopard|pata de gallo|gingham|houndstooth|patron/;
const PATRON_FICHA = [
  /\b(printed|print|striped|stripes?|checks?|checked|plaid|tartan|gingham|graphic|floral|patterned|pattern|dots?|dotted|leopard|camo|camouflage|houndstooth|jacquard|ut)\b/i,
  /ボーダー|ストライプ|チェック|プリント|柄|ドット|グラフィック/,
  /스트라이프|체크|프린트|패턴|도트|그래픽/,
];

/**
 * ¿La ficha contradice el patrón de la pieza? Liso pedido → fuera rayas y
 * estampados. Patrón pedido ("a rayas") → la ficha tiene que decir un patrón:
 * una playera lisa no es "la de rayas" (2026-10-21).
 */
export function estampadoNoPedido(nombreFicha: string, nombrePieza: string | null | undefined): boolean {
  const tieneP = PATRON_FICHA.some((re) => re.test(nombreFicha));
  if (PATRON_PEDIDO.test(slug(nombrePieza ?? ""))) return !tieneP;
  return tieneP;
}

// --- Cuello -----------------------------------------------------------------
//
// "Suéter de cuello alto negro" recibía suéteres de cuello redondo (クルーネック).
// Si la pieza pide un cuello, la ficha tiene que decirlo.
const DICE_ALTO = /turtle ?neck|mock neck|high neck|タートル|ハイネック|モックネック|터틀넥|하이넥|모크넥/i;
const DICE_V = /v-?neck|Vネック|브이넥|V넥/i;

/**
 * ¿La ficha respeta el cuello que pide la pieza? Sin cuello pedido, siempre.
 *
 * Alto o en V: la ficha tiene que DECIRLO (Uniqlo lo escribe cuando no es el
 * de siempre). Redondo: es el cuello por defecto de suéteres y playeras, así
 * que basta con que la ficha no diga otro —exigir "Crew Neck" en el nombre
 * dejó sin prenda a tres huecos en EE. UU. el 2026-10-21 ("Merino Sweater" es
 * de cuello redondo y no lo dice).
 */
export function cuelloCompatible(nombreFicha: string, nombrePieza: string | null | undefined): boolean {
  const pieza = slug(nombrePieza ?? "");
  if (/cuello (alto|tortuga|de tortuga|vuelto|mock)|turtleneck|mock neck/.test(pieza)) return DICE_ALTO.test(nombreFicha);
  if (/cuello (en )?v\b|escote (en )?v\b|v-neck/.test(pieza)) return DICE_V.test(nombreFicha);
  if (/cuello redondo|crew neck/.test(pieza)) return !DICE_ALTO.test(nombreFicha) && !DICE_V.test(nombreFicha);
  return true;
}

// --- Función: impermeable ------------------------------------------------------
//
// "Impermeable" no es un gusto, es para qué existe la pieza (la lluvia de Kioto).
// Si la pieza lo pide, la ficha tiene que decir lluvia o repelente al agua.
const DICE_LLUVIA = /\b(rain|blocktech|waterproof|water[- ]repellent)\b|ブロックテック|BLOCKTECH|レイン|撥水|防水|블록테크|레인|발수|방수/i;

export function funcionCompatible(nombreFicha: string, nombrePieza: string | null | undefined): boolean {
  if (/impermeable|para lluvia|waterproof/.test(slug(nombrePieza ?? ""))) return DICE_LLUVIA.test(nombreFicha);
  return true;
}

// --- Temporada ---------------------------------------------------------------
//
// Un vestido de lino para un cumpleaños en noviembre (5-17 °C) no es la pieza.
// Pieza de frío (`temporada: "frio"`) que no pide lino → fuera lino, seersucker
// y lo que Uniqlo marca de verano (AIRism, DRY-EX).
const DE_VERANO = /\b(linen|seersucker|airism|dry-ex)\b|リネン|麻|エアリズム|ドライEX|린넨|리넨|에어리즘/i;

// El espejo: una pieza de CALOR no recibe lo térmico (2026-10-21). A "Camiseta
// esmeralda" (temporada calor) la vitrina le enseñaba una "HEATTECH Cashmere
// Blend T-Shirt | Extra Warm | Turtleneck". Roberto: "las HEATTECH son para
// dar calor; no sé en qué momento la puse que sí". HEATTECH, forro polar,
// borrego y plumas son para frío.
const DE_INVIERNO = /heattech|extra warm|ultra warm|\bwarm\b|fleece|\bboa\b|\bdown\b|puffer|ヒートテック|極暖|ウォーム|フリース|ボア|ダウン|히트텍|웜|후리스|보아|다운/i;

export function temporadaCompatible(
  nombreFicha: string,
  pieza: { nombre?: string | null; temporada?: string | null; viajeFrio?: boolean | null }
): boolean {
  // Frío si la pieza lo es O si el viaje lo es: un vestido "todo el año" para
  // un viaje de 5-17 °C tampoco va de lino (2026-10-21).
  const temporada = slug(pieza.temporada ?? "");
  // Calor: nada térmico, aunque el viaje no tenga clima.
  if (temporada === "calor") return !DE_INVIERNO.test(nombreFicha);
  // Frío si la pieza lo es O si el viaje lo es: un vestido "todo el año" para
  // un viaje de 5-17 °C tampoco va de lino (2026-10-21).
  const frio = temporada === "frio" || pieza.viajeFrio === true;
  if (!frio) return true;
  if (/lino|linen/.test(slug(pieza.nombre ?? ""))) return true;
  return !DE_VERANO.test(nombreFicha);
}

/** ¿El viaje es de frío? Ninguna parada pasa de 20 °C de máxima. Sin clima, no se sabe: null. */
export function viajeEsFrio(paradas: { temp_max?: number | null; temp_c?: number | null }[] | null | undefined): boolean | null {
  const maxs = (paradas ?? []).map((p) => p.temp_max ?? p.temp_c).filter((t): t is number => typeof t === "number");
  if (maxs.length === 0) return null;
  return Math.max(...maxs) <= 20;
}

// --- Material: piel -------------------------------------------------------------
//
// "Bolsa cruzada de piel negra" recibía una bolsa de algodón recubierto. La piel
// define la pieza (se ve y se toca distinto); si la pide, la ficha tiene que
// decir piel o piel sintética.
const DICE_PIEL = /\b(leather|vegan leather|faux leather|suede)\b|レザー|スエード|가죽|레더|스웨이드/i;

export function materialCompatible(nombreFicha: string, nombrePieza: string | null | undefined): boolean {
  if (/\b(piel|cuero|leather|gamuza|ante)\b/.test(slug(nombrePieza ?? ""))) return DICE_PIEL.test(nombreFicha);
  return true;
}

// --- Lo que NO es la prenda, aunque la búsqueda lo devuelva ---------------------
//
// "shorts" devuelve bóxers; "sweater" devuelve ropa de dormir. Primero se saca
// lo que nunca puede cubrir un hueco de la maleta (ropa interior, calcetines,
// pijama), en los tres idiomas. OJO en japonés: "ボクサー" también nombra el
// corte de un short de calle ("コットンボクサーイージーショートパンツ"), así que
// ahí sólo se excluye "ブリーフ" (brief) y no la palabra bóxer.
const ROPA_INTERIOR = [
  /\b(boxers?|briefs?|underwear|innerwear|bras?|bralettes?|panties|thongs?|socks?|pajamas?|pyjamas?|sleepwear|loungewear|undershirts?)\b/i,
  /ブリーフ|ブラジャー|ブラトップ|靴下|ソックス|パジャマ|ルームウェア|インナー/,
  /브리프|드로즈|팬티|브라|양말|파자마|이너웨어/,
];

/** ¿Es ropa interior, calcetines o pijama? Nunca entra, salvo que eso sea lo que se busca. */
export function esRopaInterior(nombre: string, termino = ""): boolean {
  if (/\b(socks?|tights?|pajamas?)\b/i.test(termino)) return false;
  return ROPA_INTERIOR.some((re) => re.test(nombre));
}

// Para cada cabeza del término, las palabras que la nombran en una ficha de
// Uniqlo (EE. UU.). "shorts" tiene que estar como palabra entera: "Short
// Sleeve" no es un short.
const NOMBRES_EN: Record<string, RegExp> = {
  sweater: /\b(sweater|pullover|knit|cardigan)\b/i,
  // Una playera no es una camisa: "T-Shirt", "Sweatshirt" y "Overshirt" no cuentan (2026-10-21).
  shirt: /(?<![-\w])shirt\b/i,
  scarf: /\b(scarf|stole|muffler)\b/i,
  jacket: /\b(jacket|blouson|parka|anorak|coat)\b/i,
  dress: /\bdress\b/i,
  "polo shirt": /\bpolo\b/i,
  "t-shirt": /\b(t-shirt|tee|t shirt)\b/i,
  jeans: /\b(jeans|denim)\b/i,
  shorts: /\bshorts\b/i,
  pants: /\b(pants|trousers|slacks|chinos)\b/i,
  sweatshirt: /\b(sweatshirt|sweat|hoodie)\b/i,
  "trench coat": /\b(trench|coat)\b/i,
  beanie: /\b(beanie|hat|cap)\b/i,
  blazer: /\b(blazer|jacket)\b/i,
  blouse: /\b(blouse|shirt|top)\b/i,
  boots: /\bboots?\b/i,
  "ankle boots": /\b(boots?|booties)\b/i,
  cardigan: /\bcardigan\b/i,
  chinos: /\b(chino|chinos|pants|trousers)\b/i,
  belt: /\bbelt\b/i,
  coat: /\b(coat|parka|jacket)\b/i,
  joggers: /\b(joggers?|sweatpants|track pants)\b/i,
  tights: /\b(tights|leggings)\b/i,
  "rain jacket": /\b(jacket|parka|coat)\b/i,
  windbreaker: /\b(windbreaker|jacket|parka)\b/i,
  sandals: /\bsandals?\b/i,
  skirt: /\bskirt\b/i,
  overshirt: /\b(overshirt|shirt jacket|shirt)\b/i,
  sneakers: /\b(sneakers?|shoes)\b/i,
  top: /\b(top|tank|camisole|blouse)\b/i,
  bag: /\b(bag|tote|backpack|pouch)\b/i,
  beret: /\b(beret|hat)\b/i,
  turtleneck: /\b(turtleneck|turtle neck|mock neck|high neck)\b/i,
  parka: /\b(parka|jacket|coat)\b/i,
  vest: /\bvest\b/i,
  leggings: /\bleggings\b/i,
  pajamas: /\b(pajamas?|pyjamas?)\b/i,
  socks: /\bsocks?\b/i,
  gloves: /\bgloves?\b/i,
};

/**
 * ¿El nombre de la ficha dice la prenda que se busca? Sólo se puede exigir
 * cuando el nombre viene en letras latinas (EE. UU.); en Japón y Corea los
 * nombres vienen en su idioma y aquí no se juzgan (la exclusión sí aplica).
 */
export function nombreCoincide(nombre: string, termino: string): boolean {
  const partes = termino.trim().split(" ");
  const cabeza = partes.length > 1 && NOMBRES_EN[partes.slice(-2).join(" ")] ? partes.slice(-2).join(" ") : partes.at(-1) ?? "";
  const asiatico = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(nombre);
  if (asiatico) {
    // Japón y Corea escriben el nombre en su idioma. Antes no se juzgaba y a una
    // "boina de lana negra" le salió un cinturón coreano (2026-10-21). Sin
    // entrada en el diccionario, NO pasa: mejor nada que cualquier cosa.
    const re = NOMBRES_ASIA[cabeza];
    if (!re) return false;
    const fuera = EXCLUYE_ASIA[cabeza];
    return re.test(nombre) && !(fuera && fuera.test(nombre));
  }
  if (!/[a-z]/i.test(nombre)) return true;
  const re = NOMBRES_EN[cabeza];
  const fuera = EXCLUYE_EN[cabeza];
  return (re ? re.test(nombre) : true) && !(fuera && fuera.test(nombre));
}

// Lo que el nombre NO puede decir aunque diga la prenda: un botín no es "Long
// Boots"; una camisa no es una "Shirt Jacket".
const EXCLUYE_EN: Record<string, RegExp> = {
  "ankle boots": /\b(long|knee|tall)\b/i,
  // Una sudadera no es un pantalón ni un short de sudadera (2026-10-21).
  sweatshirt: /\b(pants|sweatpants|shorts|joggers)\b/i,
  // Un polo no es un suéter tejido tipo polo (2026-10-21, Corea).
  "polo shirt": /\b(sweater|cardigan|knit polo)\b/i,
};
const EXCLUYE_ASIA: Record<string, RegExp> = {
  shirt: /Tシャツ|T シャツ|スウェットシャツ|티셔츠|T셔츠|맨투맨/,
  // スウェット / 스웨트 también nombra el pantalón: "スウェットワイドパンツ", "스웨트팬츠".
  sweatshirt: /パンツ|ショーツ|팬츠|쇼츠|반바지/,
  "ankle boots": /ロング|ニーハイ|롱|니하이/,
  "polo shirt": /セーター|ニットポロ|カーディガン|스웨터|니트폴로|가디건/,
};

// Cómo nombra Uniqlo Japón (katakana) y Corea (hangul) cada prenda que
// buscamos. Lista corta a propósito: lo que no está aquí no se ofrece en esos
// mercados.
const NOMBRES_ASIA: Record<string, RegExp> = {
  sweater: /セーター|ニット|カーディガン|스웨터|니트|가디건/,
  shirt: /シャツ|셔츠/,
  scarf: /マフラー|ストール|スカーフ|머플러|스톨|스카프/,
  jacket: /ジャケット|ブルゾン|パーカ|コート|재킷|자켓|블루종|파카|코트/,
  dress: /ワンピース|ドレス|원피스|드레스/,
  "polo shirt": /ポロ|폴로/,
  "t-shirt": /Tシャツ|T シャツ|티셔츠|T셔츠/,
  jeans: /ジーンズ|デニム|진|데님/,
  shorts: /ショートパンツ|ハーフパンツ|ショーツ|쇼츠|반바지|쇼트팬츠|하프팬츠/,
  pants: /パンツ|スラックス|チノ|팬츠|바지|슬랙스|치노/,
  sweatshirt: /スウェット|パーカ|스웨트|후디|맨투맨/,
  "trench coat": /トレンチ|コート|트렌치|코트/,
  beanie: /ニット帽|ビーニー|キャップ|ハット|비니|캡|햇|모자/,
  blazer: /ジャケット|ブレザー|재킷|자켓|블레이저/,
  blouse: /ブラウス|シャツ|トップ|블라우스|셔츠|탑/,
  boots: /ブーツ|부츠/,
  "ankle boots": /ブーツ|ブーティ|부츠|부티/,
  cardigan: /カーディガン|가디건/,
  chinos: /チノ|パンツ|치노|팬츠/,
  belt: /ベルト|벨트/,
  coat: /コート|パーカ|ジャケット|코트|파카|재킷/,
  joggers: /ジョガー|スウェットパンツ|조거|스웨트팬츠/,
  tights: /タイツ|レギンス|타이츠|레깅스/,
  "rain jacket": /ジャケット|パーカ|コート|재킷|파카|코트/,
  windbreaker: /ジャケット|パーカ|ウインドブレーカー|바람막이|재킷|파카/,
  sandals: /サンダル|샌들/,
  skirt: /スカート|스커트/,
  overshirt: /シャツ|셔츠/,
  sneakers: /スニーカー|シューズ|스니커즈|슈즈/,
  top: /トップ|タンク|キャミソール|ブラウス|탑|탱크|캐미솔|블라우스/,
  bag: /バッグ|ショルダー|トート|リュック|백|가방|숄더|토트/,
  beret: /ベレー|베레/,
  turtleneck: /タートルネック|ハイネック|モックネック|터틀넥|하이넥|모크넥/,
  parka: /パーカ|ジャケット|コート|파카|재킷|코트/,
  vest: /ベスト|베스트|조끼/,
  leggings: /レギンス|레깅스/,
  pajamas: /パジャマ|파자마/,
  socks: /ソックス|靴下|양말|삭스/,
  gloves: /手袋|グローブ|장갑|글러브/,
};

// --- El orden: parecido con la pieza, no estrellas ---------------------------------
//
// Medido el 2026-10-21 sobre tres corridas guardadas: entre las prendas que
// pasan TODOS los filtros, el juez aprueba ~50% en cualquier rango de
// calificación (< 4.3: 53%; ≥ 4.6: 50%; sin reseñas: 56%). Las estrellas dicen
// si a la gente le gustó la prenda, no si cubre el hueco. Y el orden de antes
// (adjetivos del término en inglés, luego estrellas) en Japón y Corea era puro
// estrellas: los nombres vienen en su idioma. Con las mismas prendas, elegir
// mejor las dos que se enseñan podía subir lo aprobado de 59% a 79%.
//
// Cada rasgo: qué palabra de la PIEZA lo pide (nombre, descripción, término,
// temporada, formalidad) y cómo lo dice la FICHA en inglés, japonés o coreano.
// Suma lo que coincide; resta lo que lo contradice. Las estrellas sólo
// desempatan, y "sin reseñas" cuenta como la mediana medida (4.7), no como 0:
// el "Double Face Relaxed Long Coat", nuevo y sin reseñas, perdía contra un
// trench de algodón de 4.9 para un abrigo largo de lana.
const RASGOS: { pieza: RegExp; ficha: RegExp }[] = [
  { pieza: /\blino\b|linen/, ficha: /linen|リネン|麻|린넨|리넨/i },
  { pieza: /\blana\b|wool/, ficha: /wool|merino|cashmere|lambswool|ウール|メリノ|カシミヤ|ラム|울|메리노|캐시미어|램스/i },
  { pieza: /cachemira|cashmere/, ficha: /cashmere|カシミヤ|캐시미어/i },
  { pieza: /merino/, ficha: /merino|メリノ|메리노/i },
  { pieza: /\bpunto\b|knit/, ficha: /knit|merino|cashmere|lambswool|ニット|メリノ|カシミヤ|니트|메리노|캐시미어/i },
  { pieza: /algodon|cotton/, ficha: /cotton|コットン|綿|코튼/i },
  { pieza: /popelina|poplin/, ficha: /poplin|broadcloth|non-iron|easy care|ブロード|ノンアイロン|イージーケア|브로드|논아이론|이지케어/i },
  { pieza: /oxford/, ficha: /oxford|オックスフォード|옥스포드/i },
  { pieza: /mezclilla|denim/, ficha: /denim|デニム|데님/i },
  { pieza: /\bpiel\b|cuero|leather/, ficha: /leather|レザー|가죽|레더/i },
  { pieza: /\blarg[oa]\b|\blong\b/, ficha: /\blong\b(?![- ]sleeve)|ロング|롱(?!슬리브)/i },
  { pieza: /\brect[oa]s?\b|straight/, ficha: /straight|ストレート|스트레이트/i },
  // La tortuga exacta por encima del mock cuando la pieza dice tortuga o cuello alto.
  { pieza: /cuello (alto|tortuga|de tortuga)|turtleneck/, ficha: /turtle ?neck|タートル|터틀/i },
  { pieza: /cuello (en )?v\b|v-neck/, ficha: /v-?neck|Vネック|브이넥|V넥/i },
  { pieza: /cargo/, ficha: /cargo|カーゴ|카고/i },
  { pieza: /\bchino\b/, ficha: /chino|チノ|치노/i },
  { pieza: /\bvestir\b|\bsmart\b/, ficha: /smart|slacks|スマート|スラックス|스마트|슬랙스/i },
];

const CONTRARIOS: { pieza: RegExp; ficha: RegExp }[] = [
  // Ligero o de calor: nada forrado ni térmico ("ウォームスマートパンツ" para un pantalón ligero).
  { pieza: /liger[oa]|\bcalor\b/, ficha: /warm|heattech|fleece|\bboa\b|pile|\bdown\b|puffer|ウォーム|暖|ヒートテック|フリース|ボア|ダウン|웜|히트텍|후리스|보아|다운/i },
  // De vestir o formal: nada de sudadera, borrego ni gráfico.
  { pieza: /\bformal\b|\bvestir\b|sastre|traje/, ficha: /sweat|fleece|\bboa\b|graphic|\bUT\b|スウェット|フリース|ボア|스웨트|후리스|보아/i },
  // De punto: el borrego y el polar no son punto (un cárdigan de borrego para "cárdigan de punto").
  { pieza: /\bpunto\b|knit/, ficha: /fleece|\bboa\b|pile|フリース|ボア|후리스|보아/i },
  // De lana: un abrigo de plumas no es un abrigo de lana, aunque sea largo.
  { pieza: /\blana\b|wool/, ficha: /\bdown\b|puffer|padded|ダウン|中綿|다운|패딩/i },
  // Popelina: el algodón cepillado es casi franela.
  { pieza: /popelina|poplin/, ficha: /brushed|flannel|ブラッシュド|フランネル|브러시드|플란넬/i },
];

/** Lo que pide la pieza, en un solo texto: término, nombre, descripción, temporada y formalidad (sin "manga larga/corta"). */
function textoParaParecido(h: { termino?: string | null; nombre?: string | null; visual?: string | null; temporada?: string | null; formalidad?: string | null }): string {
  return slug([h.termino, h.nombre, h.visual, h.temporada, h.formalidad].filter(Boolean).join(" ").replace(/-/g, " ")).replace(/manga (larga|corta)/g, " ");
}

/** Cuánto se parece la ficha a la pieza: +1 por rasgo que coincide, −2 por rasgo que la contradice. */
export function puntosDeParecido(
  nombreFicha: string,
  pieza: { termino?: string | null; nombre?: string | null; visual?: string | null; temporada?: string | null; formalidad?: string | null }
): number {
  const t = textoParaParecido(pieza);
  let puntos = 0;
  for (const r of RASGOS) if (r.pieza.test(t) && r.ficha.test(nombreFicha)) puntos += 1;
  for (const c of CONTRARIOS) if (c.pieza.test(t) && c.ficha.test(nombreFicha)) puntos -= 2;
  return puntos;
}

/** La calificación para desempatar: sin reseñas cuenta como la mediana medida (4.7), no como cero. */
export const RATING_SIN_RESENAS = 4.7;


// --- Categoría de Uniqlo: filtrar en origen ------------------------------------
//
// La búsqueda por texto de Uniqlo es semántica y generosa: "t-shirt" en Corea
// devuelve pantalones de sudadera, "sweater" trae ropa de dormir. Pero la
// respuesta trae el árbol de categorías en que caen los resultados, y
// `categoryId` SÍ filtra en origen (medido el 2026-10-21: q=t-shirt en EE. UU.
// pasa de 498 resultados a 33 playeras de verdad; acepta varias separadas por
// coma; `genderId`, `classId` y `subcategoryId` NO filtran, probadas las cuatro
// grafías). Los ids cambian por mercado y por sección, así que no se guardan:
// se leen del árbol de la primera respuesta y se eligen por NOMBRE, en los
// tres idiomas. Lo que no está aquí no se filtra (se queda como hasta hoy).
const CATEGORIAS: Record<string, RegExp> = {
  "t-shirt": /^T-Shirts( and Tank Tops)?$|^Tシャツ・カットソー$|^티셔츠 \(긴팔 & 반팔\)$/,
  "polo shirt": /^Polo Shirts$|^ポロシャツ$|^폴로셔츠 \(카라티\)$/,
  shirt: /^(Casual |Dress )?Shirts( & Blouses)?$|^カジュアルシャツ$|^シャツ・ブラウス$|^ドレスシャツ・ワイシャツ$|^셔츠$|^캐주얼셔츠$|^정장셔츠 \(와이셔츠\)$|^셔츠 & 블라우스$/,
  overshirt: /^Casual Shirts$|^Shirts( & Blouses)?$|^カジュアルシャツ$|^シャツ・ブラウス$|^셔츠$|^캐주얼셔츠$/,
  blouse: /^Shirts & Blouses$|^Casual Shirts$|^シャツ・ブラウス$|^셔츠 & 블라우스$/,
  sweater: /^Sweaters$|^Sweaters (&|And) Cardigans$|^Knitwear$|^ニット・セーター$|^セーター・カーディガン$|^니트$|^니트 & 가디건$/,
  turtleneck: /^Sweaters$|^Sweaters (&|And) Cardigans$|^Knitwear$|^ニット・セーター$|^セーター・カーディガン$|^니트$|^니트 & 가디건$/,
  cardigan: /^Cardigans$|^Sweaters (&|And) Cardigans$|^カーディガン$|^セーター・カーディガン$|^가디건$|^니트 & 가디건$/,
  sweatshirt: /^Sweatshirts & Hoodies$|^スウェット$|^スウェット・パーカ$|^스웨트셔츠 & 후드(집업|티)$/,
  pants: /^Pants$|^Dress Pants$|^Chinos$|^Ankle Pants( & Cropped Pants)?$|^Wide Leg Pants$|^Easy Pants$|^Barrel Pants$|^Warm Pants$|^パンツ・ズボン$|^ワイドパンツ$|^イージーパンツ$|^トラウザー$|^チノ・ワークパンツ$|^感動パンツ$|^ロングパンツ・アンクルパンツ$|^팬츠$|^캐주얼 팬츠$|^와이드 팬츠$|^웜 팬츠$|^청바지 & 팬츠$/,
  chinos: /^Chinos$|^Pants$|^Ankle Pants( & Cropped Pants)?$|^チノ・ワークパンツ$|^パンツ・ズボン$|^팬츠$|^캐주얼 팬츠$/,
  joggers: /^Sweatpants$|^Easy Pants$|^スウェット$|^イージーパンツ$|^스웨트 팬츠 & 조거 팬츠$/,
  jeans: /^Jeans$|^ジーンズ$|^청바지 & 팬츠$/,
  shorts: /^Shorts( & Culottes)?$|^ショートパンツ$|^キュロット・ショートパンツ$|^쇼트 팬츠\(반바지\)$|^반바지$/,
  jacket: /^Jackets & Parkas$|^Lightweight Puffers$|^Down Jackets & Coats$|^Outerwear$|^ブルゾン・パーカ$|^ジャケット$|^感動ジャケット$|^アウター$|^재킷( & 파카| & 블레이저)?$|^파카 & 블루종$|^아우터$/,
  "rain jacket": /^Jackets & Parkas$|^Outerwear$|^ブルゾン・パーカ$|^アウター$|^재킷( & 파카)?$|^파카 & 블루종$|^아우터$/,
  windbreaker: /^Jackets & Parkas$|^Outerwear$|^ブルゾン・パーカ$|^アウター$|^재킷( & 파카)?$|^파카 & 블루종$|^아우터$/,
  parka: /^Jackets & Parkas$|^Down Jackets & Coats$|^Outerwear$|^ブルゾン・パーカ$|^アウター$|^재킷( & 파카)?$|^파카 & 블루종$|^아우터$/,
  coat: /^Coats$|^Down Jackets & Coats$|^コート$|^코트$/,
  "trench coat": /^Coats$|^コート$|^코트$/,
  blazer: /^Blazers$|^ジャケット$|^感動ジャケット$|^재킷 & 블레이저$/,
  dress: /^Dresses( & Skirts)?$|^ワンピース$|^スコート・ワンピース$|^원피스( & 스커트)?$|^스커트 & 원피스$/,
  skirt: /^Skirts$|^Dresses & Skirts$|^スカート$|^스커트( & 원피스)?$|^원피스 & 스커트$/,
  boots: /^Shoes( & Sandals)?$|^靴・ルームシューズ$|^신발$/,
  "ankle boots": /^Shoes( & Sandals)?$|^靴・ルームシューズ$|^신발$/,
  sneakers: /^Shoes( & Sandals)?$|^靴・ルームシューズ$|^신발$/,
  sandals: /^Shoes( & Sandals)?$|^靴・ルームシューズ$|^신발$/,
  bag: /^Bags$|^バッグ$|^가방$/,
  belt: /^Belts$|^벨트$/,
  scarf: /^Scarves$|^マフラー(・ストール)?$/,
  beanie: /^Hats & Caps$|^帽子・キャップ・ハット$|^모자$/,
  beret: /^Hats & Caps$|^帽子・キャップ・ハット$|^모자$/,
  tights: /^Leggings( & Tights)?$|^レギンス・タイツ$|^레깅스/,
  leggings: /^Leggings( & Tights)?$|^レギンス・タイツ$|^레깅스/,
};

/** La cabeza de un término de búsqueda: "linen shorts" → "shorts", "short sleeve polo shirt" → "polo shirt". */
export function cabezaDeTermino(termino: string): string {
  const partes = termino.trim().split(" ");
  const dos = partes.slice(-2).join(" ");
  return partes.length > 1 && (NOMBRES_EN[dos] || CATEGORIAS[dos]) ? dos : (partes.at(-1) ?? "");
}

export type CategoriaUniqlo = { id: number | string; name: string };

/** Los ids de categoría del árbol de la respuesta que nombran la prenda buscada; vacío = no filtrar. */
export function categoriasQueEmpatan(categorias: CategoriaUniqlo[] | null | undefined, termino: string): string[] {
  const re = CATEGORIAS[cabezaDeTermino(termino)];
  if (!re) return [];
  const ids = new Set<string>();
  for (const c of categorias ?? []) if (c?.name && re.test(c.name.trim())) ids.add(String(c.id));
  return [...ids];
}

/**
 * El texto de la pieza con el que se juzgan manga, cuello, patrón, función y
 * material: el nombre Y la descripción visual de la cápsula. La cápsula guarda
 * "Suéter de punto vino" y aparte "punto medio, cuello alto suelto, manga globo
 * discreta"; hasta v0.2.406 sólo se leía el nombre y el cuello alto se perdía.
 * NO alimenta la búsqueda (sumar modificadores a `q` vacía Japón y Corea).
 */
export function textoDePieza(pieza: { nombre?: string | null; visual?: string | null }): string {
  return [pieza.nombre, pieza.visual].filter((t): t is string => Boolean(t && t.trim())).join(". ");
}

// --- Color ------------------------------------------------------------------
//
// Familia de color de la cápsula (texto en español, p. ej. "vino", "gris
// carbón", "neutro claro") → nombres de color de Uniqlo (inglés, mayúsculas,
// iguales en US/JP/KR). Sin empate, NADA: nunca una prenda fuera de paleta por
// llenar el hueco. Las 14 familias que de verdad faltan en los viajes vivos
// están todas aquí.
export const COLORES: Record<string, string[]> = {
  negro: ["BLACK"],
  blanco: ["WHITE", "OFF WHITE"],
  hueso: ["OFF WHITE", "NATURAL"],
  crema: ["OFF WHITE", "NATURAL", "BEIGE"],
  crudo: ["OFF WHITE", "NATURAL"],
  "neutro claro": ["OFF WHITE", "NATURAL", "BEIGE", "LIGHT GRAY"],
  beige: ["BEIGE", "NATURAL"],
  camel: ["BEIGE", "BROWN"],
  gris: ["GRAY", "LIGHT GRAY"],
  "gris claro": ["LIGHT GRAY"],
  "gris carbon": ["DARK GRAY"],
  "gris oscuro": ["DARK GRAY"],
  "gris perla": ["LIGHT GRAY", "GRAY"],
  azul: ["BLUE", "NAVY"],
  marino: ["NAVY"],
  "azul marino": ["NAVY"],
  "azul rey": ["BLUE"],
  cobalto: ["BLUE"],
  // Los celestes 61-63 se llaman "BLUE" en Uniqlo; el tono (TONOS) los acota.
  "azul claro": ["LIGHT BLUE", "BLUE"],
  celeste: ["LIGHT BLUE", "BLUE"],
  verde: ["GREEN", "DARK GREEN"],
  esmeralda: ["GREEN", "DARK GREEN"],
  botella: ["GREEN", "DARK GREEN"],
  menta: ["GREEN", "LIGHT GREEN"],
  salvia: ["GREEN"],
  oliva: ["OLIVE", "KHAKI"],
  chocolate: ["DARK BROWN", "BROWN"],
  cafe: ["DARK BROWN", "BROWN"],
  marron: ["DARK BROWN", "BROWN"],
  vino: ["WINE", "DARK RED"],
  rubi: ["WINE", "RED", "DARK RED"],
  burdeos: ["WINE", "DARK RED"],
  rojo: ["RED"],
  coral: ["RED"],
  morado: ["PURPLE"],
  lavanda: ["PURPLE", "LIGHT PURPLE"],
  mostaza: ["YELLOW"],
  amarillo: ["YELLOW"],
  rosa: ["PINK"],
  naranja: ["ORANGE"],
};

/** Los nombres de color de Uniqlo que valen para una familia; vacío si no la conocemos. */
export function coloresDe(colorFamilia: string | null | undefined): string[] {
  if (!colorFamilia) return [];
  const s = slug(colorFamilia);
  return COLORES[s] ?? COLORES[s.split(" ")[0]] ?? [];
}

// --- Tono: el código de color de Uniqlo ----------------------------------------
//
// El NOMBRE de color de Uniqlo es la familia ("GREEN"), no el tono: bajo "GREEN"
// conviven el lima, la menta, la salvia y el verde botella. Roberto, votando
// (2026-10-21): "acepta las t-shirts que sean verdes independientemente del
// tono… verde deslavado, fosforescente, bosque; por relevancia cae en verde,
// pero no es verde esmeralda". El CÓDIGO sí va por tono: Uniqlo numera cada
// familia de claro a oscuro (verdes 50-59, azules 60-69, rojos 13-19…) y el
// mismo número es el mismo tinte en EE. UU., Japón y Corea.
//
// Medido el 2026-10-21 mirando hasta tres prendas por código de las corridas
// guardadas de la medición (docs/designs/vitrina-de-tienda.md, "Medición en
// seco"): 51-53 verdes pálidos, 55 botella/esmeralda, 56-57 oliva, 58-59
// verde petróleo y oliva oscuro; 13-15 rojo vivo y coral, 16-17 rojo profundo,
// 18-19 vino; 60-63 celestes (aunque 61-63 se llamen "BLUE"), 65-66 azul medio,
// 67 azul rey, 68 azul tinta, 69 marino. El 54 es MIXTO (un bóxer gris, una
// camisa menta, un suéter esmeralda, y en la corrida con tono un cachemir 54
// que el juez con foto leyó "menta claro y deslavado"): no entra en esmeralda.
//
// Sólo las familias donde el nombre se queda corto llevan tonos; las demás
// siguen por nombre. Y el tono FINO se lee del nombre de la pieza igual que el
// tipo lee ahí sus modificadores: la cápsula guarda `colorFamilia: "verde"` y
// `nombre: "Camiseta esmeralda"`, y lo que pide es esmeralda.
export const TONOS: Record<string, string[]> = {
  esmeralda: ["55"],
  botella: ["55", "58"],
  verde: ["53", "54", "55", "58"],
  menta: ["51", "53"],
  salvia: ["53"],
  rubi: ["17", "18", "19"],
  rojo: ["13", "14", "15", "16", "17"],
  coral: ["14"],
  "azul claro": ["60", "61", "62", "63"],
  celeste: ["60", "61", "62", "63"],
  "azul rey": ["67"],
  cobalto: ["67"],
  azul: ["64", "65", "66", "67", "68", "69"],
};

/** Todas las familias, de la más larga a la más corta: "azul marino" antes que "azul". */
const FAMILIAS_POR_LARGO = Object.keys(COLORES).sort((a, b) => b.length - a.length);

/**
 * La familia que de verdad pide la pieza: la del nombre si nombra una familia
 * MÁS ESTRECHA que la de la cápsula ("Camiseta esmeralda" con `verde` →
 * esmeralda; "Jogger azul marino" con `azul` → marino); si no, la de la
 * cápsula. El nombre sólo puede estrechar, nunca ensanchar: con `marino`, la
 * palabra "azul" de "azul marino" no asciende a `azul` (64-69), que fue el bug
 * cazado el 2026-10-21 al revisar los casos límite. Y nunca salta de familia:
 * "Bufanda negra con rojo" sigue siendo negra.
 */
export function familiaDePieza(colorFamilia: string | null | undefined, nombre?: string | null): string | null {
  const base = colorFamilia ? slug(colorFamilia) : null;
  const texto = slug(nombre ?? "");
  const nombresBase = coloresDe(base);
  for (const f of FAMILIAS_POR_LARGO) {
    if (!new RegExp(`(^|[^a-z])${f}([^a-z]|$)`).test(texto)) continue;
    const nombresF = COLORES[f];
    // Cabe dentro de la familia de la cápsula: todos sus nombres están en ella.
    if (nombresBase.length === 0 || nombresF.every((n) => nombresBase.includes(n))) return f;
  }
  return base;
}

/** Cuántas familias de color distintas nombra un texto ("rayas blanco y negro" → 2). */
export function familiasEnTexto(texto: string | null | undefined): number {
  const t = slug(texto ?? "");
  const vistas = new Set<string>();
  for (const f of FAMILIAS_POR_LARGO) {
    if (!new RegExp(`(^|[^a-z])${f}([^a-z]|$)`).test(t)) continue;
    // "azul marino" ya contó; que "azul" y "marino" no cuenten otra vez.
    if ([...vistas].some((v) => v.includes(f) || f.includes(v))) continue;
    vistas.add(f);
  }
  return vistas.size;
}

/** Los códigos de tono que valen para una familia; null si esa familia va sólo por nombre. */
export function tonosDe(familia: string | null | undefined): string[] | null {
  if (!familia) return null;
  const s = slug(familia);
  return TONOS[s] ?? null;
}

// --- La más cercana: UNA concesión, dicha en voz alta ---------------------------
//
// Cuando con todos los filtros un país se queda en cero, se puede enseñar UNA
// prenda que ceda sólo el TONO hacia un vecino que una stylist firmaría, con
// etiqueta ("la más cercana a azul rey: azul intenso"). Diseño del 2026-10-21
// con Roberto, a partir de su "Polo azul rey": Uniqlo no tiene un polo 67, pero
// sí un DRY-EX 64 "azul intenso" que hace el papel; el 68 tinta, a medias; el
// marino, no. Todo lo demás (tipo, sección, manga, cuello, patrón, función,
// temporada, material, familia de color por nombre) sigue filtrando igual: la
// cercana nunca es dos concesiones.
//
// Los vecinos se escriben a mano por familia, en orden de cercanía; no por
// aritmética de códigos (el 64 fue celeste en tres camisas y "azul intenso"
// en un polo: los códigos no son perfectos y la lista se afina con lo que
// Roberto vea). Las familias por nombre (vino, marino, negro…) no tienen
// vecino: si no hay, no hay.
export const VECINOS: Record<string, string[]> = {
  "azul rey": ["66", "65", "64"],
  cobalto: ["66", "65", "64"],
  esmeralda: ["58"],
  rubi: ["16"],
};

/** `azul` a secas cede al celeste 63 sólo en camisas, blusas y playeras (un oxford celeste sí; un pantalón, no). */
const VECINOS_SOLO_ARRIBA: Record<string, string[]> = { azul: ["63"] };
const CABEZAS_DE_ARRIBA = new Set(["shirt", "overshirt", "blouse", "t-shirt"]);

/** La palabra de persona para el tono cedido; sin ella la etiqueta no informa. */
export const NOMBRE_TONO: Record<string, string> = {
  "63": "azul claro",
  "64": "azul intenso",
  "65": "azul medio",
  "66": "azul medio",
  "68": "azul tinta",
  "58": "verde petróleo",
  "16": "rojo profundo",
};

/**
 * EL INTERRUPTOR (regla escrita antes de prender, 2026-10-21): si al 7 de
 * noviembre las cercanas reciben menos de la mitad de clics por vista que las
 * exactas, o Roberto aprueba menos de la mitad de las que se enseñaron, esto
 * pasa a false y los huecos vuelven a quedar vacíos. Es un interruptor, no una
 * reconstrucción. La lectura separa cercanas de exactas por `data.cercana`.
 */
export const CERCANAS_ACTIVAS = true;

/** Los códigos vecinos que valen como cercana para una familia y una prenda; vacío = no hay cercana. */
export function vecinosDe(familia: string | null | undefined, termino?: string | null): string[] {
  if (!familia) return [];
  const s = slug(familia);
  if (VECINOS[s]) return VECINOS[s];
  if (VECINOS_SOLO_ARRIBA[s] && termino && CABEZAS_DE_ARRIBA.has(cabezaDeTermino(termino))) return VECINOS_SOLO_ARRIBA[s];
  return [];
}

/**
 * El color del producto que empata con lo que pide la pieza: por NOMBRE de
 * familia y, si la familia tiene tonos, también por CÓDIGO. Es la única
 * puerta: la vitrina elige por aquí y la medición explica por aquí.
 */
export function colorQueEmpata(
  colors: UniqloColor[] | null | undefined,
  pieza: { colorFamilia: string; nombre?: string | null }
): { color: UniqloColor | null; porNombre: boolean } {
  const familia = familiaDePieza(pieza.colorFamilia, pieza.nombre);
  const nombres = coloresDe(familia);
  const tonos = tonosDe(familia);
  const porNombre = (colors ?? []).filter((c) => nombres.includes((c.name ?? "").toUpperCase()));
  const color = porNombre.find((c) => !tonos || tonos.includes(c.displayCode ?? "")) ?? null;
  return { color, porNombre: porNombre.length > 0 };
}

// --- La respuesta de la API (sólo lo que se usa) -------------------------------

export type UniqloColor = { code?: string; displayCode?: string; name?: string };
export type UniqloItem = {
  productId?: string;
  name?: string;
  genderCategory?: string;
  colors?: UniqloColor[];
  prices?: { base?: { currency?: { code?: string }; value?: number } | null };
  rating?: { average?: number | null } | null;
  images?: { main?: Record<string, { image?: string }> };
};

export type PrendaVitrina = {
  /** Lo que identifica la entrada en los eventos: `<mercado>:<productId>:<displayCode>`. */
  id: string;
  /** "E488243-000": lo que va en la URL de la ficha. */
  productId: string;
  /** "14": el código de color de Uniqlo (sale en la etiqueta y en la ficha). */
  colorCode: string;
  mercado: Mercado;
  tienda: string;
  nombre: string;
  color: string;
  precio: number;
  moneda: string;
  precioTexto: string;
  url: string;
  foto: string;
  /** ISO de cuando la API contestó (header `date` de la respuesta, cacheada o no). */
  vistoEl: string | null;
  /** Si es "la más cercana": el tono que cede, en palabras ("azul intenso"). null = exacta. */
  cercana?: string | null;
};

const HOST_FOTO = "https://image.uniqlo.com/UQ/";

/** Sólo fotos del host de Uniqlo: next/image lanza con un host no listado (D2). */
export function fotoSegura(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(HOST_FOTO)) return null;
  return url;
}

/**
 * La ficha del producto, abierta en EL color que se enseñó. Sin
 * `colorDisplayCode` la ficha abre en el color por defecto (gris, en el
 * vestido de prueba) y el eslabón se rompe justo donde importa: te enseñamos
 * vino y aterrizas en gris. Verificado en el navegador el 2026-10-21.
 */
export function urlDeFicha(mercado: Mercado, productId: string, colorDisplayCode?: string | null): string {
  const base = `https://www.uniqlo.com/${mercado}/${MERCADOS[mercado].idioma}/products/${productId}/00`;
  return colorDisplayCode ? `${base}?colorDisplayCode=${encodeURIComponent(colorDisplayCode)}` : base;
}

export function precioTexto(mercado: Mercado, valor: number): string {
  const m = MERCADOS[mercado];
  return `${m.simbolo}${new Intl.NumberFormat("en-US", { maximumFractionDigits: m.decimales, minimumFractionDigits: m.decimales }).format(valor)}`;
}

/**
 * Hasta dos prendas del mercado para un hueco: del segmento (o UNISEX; nunca
 * KIDS), en un color de la familia, con foto de ese color, ordenadas por
 * calificación. El filtro de género va AQUÍ porque el parámetro
 * `genderCategory=` de la URL no filtra nada (medido: misma mezcla con y sin).
 */
type HuecoVitrina = {
  segmento: Segmento;
  colorFamilia: string;
  termino?: string | null;
  nombre?: string | null;
  /** La descripción visual de la cápsula: de ahí salen cuello, manga y material que el nombre calla. */
  visual?: string | null;
  temporada?: string | null;
  /** "casual" | "formal-casual" | "formal": ordena (resta lo de sudadera en una pieza de vestir). */
  formalidad?: string | null;
  viajeFrio?: boolean | null;
  /** La palabra con que se buscó en este país (escalones): lo que se perdió al bajar pasa a filtrar. */
  consulta?: string | null;
};

type Candidata = PrendaVitrina & { rating: number; puntos: number; vecino: number };

/**
 * El embudo completo menos el color: sección, ropa interior, nombre, manga,
 * patrón, cuello, función, temporada, material, precio y foto. El color lo
 * decide `elegirColor` (exacto o vecino) para que la exacta y la cercana
 * pasen por LOS MISMOS filtros y sólo difieran en el tono.
 */
function candidatasDe(
  items: UniqloItem[] | null | undefined,
  hueco: HuecoVitrina,
  mercado: Mercado,
  vistoEl: string | null,
  elegirColor: (colors: UniqloColor[] | null | undefined) => { color: UniqloColor | null; vecino: number }
): Candidata[] {
  const generos = new Set([hueco.segmento === "hombre" ? "MEN" : "WOMEN", "UNISEX"]);
  const termino = hueco.termino ?? "";
  const pieza = textoDePieza(hueco);
  const manga = mangaDe(pieza);
  const candidatas: Candidata[] = [];
  for (const it of items ?? []) {
    if (!it?.productId || !it.name || !generos.has(it.genderCategory ?? "")) continue;
    // Ni ropa interior ni algo que no diga la prenda pedida (2026-10-21: a un
    // "short de lino negro" le salió un bóxer a rayas y un short de sudadera).
    if (esRopaInterior(it.name, termino)) continue;
    if (termino && !nombreCoincide(it.name, termino)) continue;
    // Lo que se dejó fuera de la búsqueda al bajar de escalón, se exige aquí.
    if (termino && !respetaModificadores(it.name, termino, hueco.consulta)) continue;
    // La manga pedida y lo liso se respetan (2026-10-21: a una camisa negra de
    // manga corta le salían playeras, una de manga larga, y la única camisa de
    // manga corta disponible era estampada).
    if (!mangaCompatible(it.name, manga, termino)) continue;
    if (estampadoNoPedido(it.name, pieza)) continue;
    if (!cuelloCompatible(it.name, pieza)) continue;
    if (!funcionCompatible(it.name, pieza)) continue;
    if (!temporadaCompatible(it.name, { ...hueco, nombre: pieza })) continue;
    if (!materialCompatible(it.name, pieza)) continue;
    const precio = it.prices?.base?.value;
    if (typeof precio !== "number") continue;
    const { color, vecino } = elegirColor(it.colors);
    if (!color?.displayCode) continue;
    const foto = fotoSegura(it.images?.main?.[color.displayCode]?.image);
    if (!foto) continue;
    candidatas.push({
      id: `${mercado}:${it.productId}:${color.displayCode}`,
      productId: it.productId,
      colorCode: color.displayCode,
      mercado,
      tienda: MERCADOS[mercado].nombre,
      nombre: it.name,
      color: (color.name ?? "").toUpperCase(),
      precio,
      moneda: MERCADOS[mercado].moneda,
      precioTexto: precioTexto(mercado, precio),
      url: urlDeFicha(mercado, it.productId, color.displayCode),
      foto,
      vistoEl,
      rating: it.rating?.average && it.rating.average > 0 ? it.rating.average : RATING_SIN_RESENAS,
      puntos: puntosDeParecido(it.name, hueco),
      vecino,
    });
  }
  return candidatas;
}

const sinExtras = ({ rating: _r, puntos: _p, vecino: _v, ...p }: Candidata): PrendaVitrina => p;

/**
 * Hasta dos prendas del mercado para un hueco: del segmento (o UNISEX; nunca
 * KIDS), en un color de la familia Y en el tono (código), con foto de ese
 * color, ordenadas por parecido y luego por calificación. El filtro de género
 * va AQUÍ porque el parámetro `genderCategory=` de la URL no filtra nada.
 */
export function elegirPrendas(
  items: UniqloItem[] | null | undefined,
  hueco: HuecoVitrina,
  mercado: Mercado,
  vistoEl: string | null = null,
  maximo = 2
): PrendaVitrina[] {
  if (coloresDe(familiaDePieza(hueco.colorFamilia, hueco.nombre)).length === 0) return [];
  // En la familia Y en el tono (código): un verde pálido no cubre "esmeralda".
  const candidatas = candidatasDe(items, hueco, mercado, vistoEl, (colors) => ({ color: colorQueEmpata(colors, hueco).color, vecino: 0 }));
  // Primero la que más se parece a la pieza (en los tres idiomas); las estrellas sólo desempatan.
  candidatas.sort((a, b) => b.puntos - a.puntos || b.rating - a.rating);
  return candidatas.slice(0, maximo).map(sinExtras);
}

/**
 * LA MÁS CERCANA: una sola prenda que cede únicamente el tono hacia un vecino
 * de la lista, con el tono cedido en palabras. Sólo tiene sentido llamarla
 * cuando `elegirPrendas` devolvió vacío en TODOS los países (eso lo decide
 * quien pinta). Vacío si la familia no tiene vecinos, si la pieza nombra dos
 * colores (no sabemos cuál ceder) o si nada pasa el resto de los filtros.
 */
export function elegirCercana(items: UniqloItem[] | null | undefined, hueco: HuecoVitrina, mercado: Mercado, vistoEl: string | null = null): PrendaVitrina[] {
  const familia = familiaDePieza(hueco.colorFamilia, hueco.nombre);
  const nombres = coloresDe(familia);
  const vecinos = vecinosDe(familia, hueco.termino);
  if (nombres.length === 0 || vecinos.length === 0) return [];
  if (familiasEnTexto(hueco.nombre) > 1) return [];
  const candidatas = candidatasDe(items, hueco, mercado, vistoEl, (colors) => {
    const enFamilia = (colors ?? []).filter((c) => nombres.includes((c.name ?? "").toUpperCase()));
    for (let i = 0; i < vecinos.length; i++) {
      const c = enFamilia.find((x) => x.displayCode === vecinos[i]);
      if (c) return { color: c, vecino: i };
    }
    return { color: null, vecino: 0 };
  });
  // Primero el vecino más cercano, luego el parecido, luego la calificación.
  candidatas.sort((a, b) => a.vecino - b.vecino || b.puntos - a.puntos || b.rating - a.rating);
  const mejor = candidatas[0];
  if (!mejor) return [];
  return [{ ...sinExtras(mejor), cercana: NOMBRE_TONO[mejor.colorCode] ?? mejor.color.toLowerCase() }];
}

/** La clave con la que se cuentan vistas y clics: segmento|tipo canónico|color. */
export function claveVitrina(segmento: Segmento, tipo: string, colorFamilia: string): string {
  return `${segmento}|${tipoCanonico(tipo)}|${slug(colorFamilia)}`;
}

// --- El único fetch -----------------------------------------------------------

export const LIMITE_RESPUESTA = 20; // limit=40 pesa 216 KB; se eligen 2
const CACHE_SEGUNDOS = 7 * 24 * 60 * 60;
const TIMEOUT_MS = 3000;

export type Consulta = {
  items: UniqloItem[];
  vistoEl: string | null;
  /** true si la API falló (http, status, timeout): no se baja de escalón, para no multiplicar esperas. */
  fallo?: boolean;
  /** El árbol de categorías en que caen los resultados (aggregations.tree.categories). */
  categorias: CategoriaUniqlo[];
  /** true si estos ítems vienen ya filtrados por categoría de Uniqlo. */
  filtradaPorCategoria?: boolean;
};

/**
 * Una consulta al mercado, cacheada 7 días por URL en la Data Cache de Next
 * (D1): persiste entre peticiones y despliegues en Vercel, sin tabla. Cualquier
 * fallo devuelve vacío y avisa por `onError` (la card calla; el admin se
 * entera en /admin/errores, D4).
 */
export async function consultarUniqlo(
  mercado: Mercado,
  q: string,
  opts: {
    onError?: (mercado: Mercado, mensaje: string) => Promise<void> | void;
    fetchImpl?: typeof fetch;
    /** Ids de categoría de Uniqlo separados por coma: filtra en origen. */
    categoryId?: string;
  } = {}
): Promise<Consulta> {
  const vacia: Consulta = { items: [], vistoEl: null, categorias: [] };
  if (!q.trim()) return vacia;
  const params = new URLSearchParams({
    q,
    offset: "0",
    limit: String(LIMITE_RESPUESTA),
    httpFailure: "true",
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
  });
  const url = `https://www.uniqlo.com/${mercado}/api/commerce/v5/${MERCADOS[mercado].idioma}/products?${params}`;
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(url, {
      cache: "force-cache",
      next: { revalidate: CACHE_SEGUNDOS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    } as RequestInit);
    if (!res.ok) {
      await opts.onError?.(mercado, `http ${res.status}`);
      return { ...vacia, fallo: true };
    }
    const json = (await res.json()) as {
      status?: string;
      result?: { items?: UniqloItem[]; aggregations?: { tree?: { categories?: CategoriaUniqlo[] } } };
    };
    if (json.status !== "ok") {
      await opts.onError?.(mercado, `status ${json.status ?? "sin status"}`);
      return { ...vacia, fallo: true };
    }
    return {
      items: json.result?.items ?? [],
      vistoEl: res.headers?.get?.("date") ?? null,
      categorias: json.result?.aggregations?.tree?.categories ?? [],
    };
  } catch (e) {
    const mensaje = e instanceof Error && e.name === "TimeoutError" ? "timeout" : e instanceof Error ? e.message : String(e);
    await opts.onError?.(mercado, mensaje);
    return { ...vacia, fallo: true };
  }
}

/**
 * LA CONSULTA DE LA VITRINA: dos pasos. Primero la búsqueda de texto (como
 * siempre), que además devuelve en qué categorías de Uniqlo caen los
 * resultados; si alguna NOMBRA la prenda buscada (CATEGORIAS), se repite la
 * misma búsqueda filtrada por esas categorías y se usan esos ítems. Si el
 * filtro deja vacío (o la cabeza no está en el diccionario), se queda la
 * primera: nunca menos que hoy. Las dos van a la caché de 7 días.
 */
export async function consultarUniqloEnCategoria(
  mercado: Mercado,
  q: string,
  opts: {
    onError?: (mercado: Mercado, mensaje: string) => Promise<void> | void;
    fetchImpl?: typeof fetch;
    /** La prenda que se busca, para elegir la categoría cuando `q` es otra palabra (base o en japonés/coreano). */
    termino?: string;
  } = {}
): Promise<Consulta> {
  const { termino, ...base } = opts;
  const primera = await consultarUniqlo(mercado, q, base);
  if (primera.fallo) return primera;
  const ids = categoriasQueEmpatan(primera.categorias, termino ?? q);
  if (ids.length === 0) return primera;
  const segunda = await consultarUniqlo(mercado, q, { ...base, categoryId: ids.join(",") });
  return segunda.items.length > 0 ? { ...segunda, filtradaPorCategoria: true } : primera;
}

// --- Escalones de búsqueda: nunca menos que hoy ---------------------------------
//
// La consulta con modificadores ("leather ankle boots", "wool blazer") afina en
// EE. UU. pero en Japón y Corea devuelve CERO: sus buscadores no entienden el
// modificador en inglés. Medido el 2026-10-21 sobre los 58 huecos vivos: 56 de
// 135 consultas en cero (JP 22, KR 28, US 6). Se recuperan bajando escalones
// SÓLO cuando el anterior devolvió cero (nunca cuando falló):
//   1. el término completo (lo de siempre),
//   2. la prenda sin modificadores ("ankle boots"),
//   3. la palabra base ("boots"),
//   4. en JP/KR, el nombre local de la prenda, sólo donde se midió que recupera.
// Los modificadores NO se pierden al bajar: siguen filtrando desde el texto de
// la pieza (piel, impermeable, manga, cuello) y ordenando por parecido.
// Sigue en cero en los tres países: la boina (Uniqlo no la vende hoy).
// "windbreaker" NO baja a "jacket": medido el 2026-10-21, en JP/KR trajo
// chamarras de punto, de borrego y plumíferos. Es otra prenda; si no hay
// rompevientos, no hay. "rain jacket" sí baja: `funcionCompatible` exige que
// la ficha diga lluvia o repelente al agua.
const BASE_DE: Record<string, string> = {
  "ankle boots": "boots",
  "rain jacket": "jacket",
};

/** Nombre local de la prenda; sólo los que se midió que devuelven resultados (2026-10-21). */
const NOMBRE_LOCAL: Record<string, Partial<Record<Mercado, string>>> = {
  belt: { jp: "ベルト" }, // 0 → 19
  sweatshirt: { jp: "スウェット" }, // 0 → 101
  sneakers: { jp: "スニーカー" }, // 0 → 1
  blazer: { kr: "블레이저" }, // 0 → 9
  joggers: { kr: "조거팬츠" }, // 0 → 15
  beanie: { kr: "비니" }, // 0 → 6
  scarf: { kr: "머플러" }, // 0 → 7
};

/**
 * Lo que un modificador exige de la ficha cuando la búsqueda se hizo SIN él
 * (se bajó de escalón). Dos clases, porque Uniqlo no escribe lo normal:
 *   · `requiere`: la ficha tiene que decirlo (una chamarra de mezclilla dice
 *     デニム; una sudadera con capucha dice パーカ).
 *   · `excluye`: basta con que no lo contradiga ("EZY Jeans" es recta y no lo
 *     dice; exigirle "straight" la tiraría, que es justo lo que el juez aprobó).
 * Lo que no está aquí (wool, knit, linen, cashmere, mini…) sólo ordena.
 * Medido el 2026-10-21 sobre las 61 prendas que entraron con los escalones:
 * "abrigo largo" recibía abrigos cortos, "jeans rectos" skinny y barrel,
 * "chamarra de mezclilla" una Harrington, "botines" botas altas.
 */
const MODIFICADOR_PERDIDO: Record<string, { requiere?: RegExp; excluye?: RegExp }> = {
  denim: { requiere: /denim|デニム|데님/i },
  // El lino define una pieza de calor (2026-10-21: al bajar de "linen shorts" a
  // "shorts", Japón enseñaba shorts de sudadera; Corea, camisas de algodón).
  linen: { requiere: /linen|リネン|麻|린넨|리넨/i },
  hoodie: { requiere: /hood|parka|パーカ|フーディ|후드|후디|파카/i },
  zip: { requiere: /zip|ジップ|집업|지퍼|지업/i },
  cargo: { requiere: /cargo|カーゴ|카고/i },
  wide: { requiere: /wide|ワイド|와이드/i },
  chino: { requiere: /chino|チノ|치노/i },
  smart: { requiere: /smart|slacks|trousers|dress pants|スマート|スラックス|トラウザー|センタープレス|스마트|슬랙스|트라우저/i },
  ankle: { requiere: /ankle|bootie|chelsea|side gore|\bshort\b|ショート|サイドゴア|チェルシー|앵클|첼시|숏|쇼트/i },
  crossbody: { requiere: /shoulder|crossbody|cross body|ショルダー|숄더|크로스/i },
  straight: {
    excluye: /skinny|wide|barrel|baggy|flare|tapered|bootcut|スキニー|ワイド|バレル|バギー|フレア|テーパード|스키니|와이드|배럴|배기|플레어|테이퍼드/i,
  },
  long: { excluye: /\bshort\b|cropped|ショート|クロップド|쇼트|숏|크롭/i },
};

/** Las palabras de un término, sin la frase de manga ("long sleeve" habla de la manga, no del largo). */
const palabras = (t: string) =>
  t
    .toLowerCase()
    .replace(/\b(short|long) sleeve\b/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * ¿La ficha respeta los modificadores que se perdieron al bajar de escalón?
 * Sin escalón (la consulta es el término completo) no se exige nada nuevo:
 * así queda EE. UU., donde el término completo ya afina.
 */
export function respetaModificadores(nombreFicha: string, termino: string, consulta: string | null | undefined): boolean {
  if (!consulta || consulta.trim() === termino.trim()) return true;
  const usadas = new Set(palabras(consulta));
  for (const m of palabras(termino)) {
    if (usadas.has(m)) continue;
    const regla = MODIFICADOR_PERDIDO[m];
    if (!regla) continue;
    if (regla.requiere && !regla.requiere.test(nombreFicha)) return false;
    if (regla.excluye && regla.excluye.test(nombreFicha)) return false;
  }
  return true;
}

/**
 * Los atributos que un filtro exige, en el orden en que se buscan. Al bajar de
 * escalón NO se sueltan de golpe: primero se prueba "atributo + prenda" en
 * inglés y, en Japón y Corea, la frase local que lleva el atributo pegado a la
 * prenda. Medido el 2026-10-21: "turtleneck sweater" 3 en EE. UU. y 0 en JP/KR;
 * "タートルネックセーター" 8; "터틀넥 스웨터" 6. "タートルネック" a secas trae
 * HEATTECH y playeras térmicas: por eso la frase lleva la prenda.
 */
const ATRIBUTOS_EXIGIDOS = ["short sleeve", "long sleeve", "turtleneck", "v-neck", "leather", "rain", "smart"];

/** Frase local "atributo + prenda"; sólo las medidas que traen la prenda (2026-10-21). */
const FRASE_LOCAL: Record<string, Partial<Record<Mercado, string>>> = {
  "turtleneck sweater": { jp: "タートルネックセーター", kr: "터틀넥 스웨터" }, // 0 → 8 / 6
  "v-neck sweater": { jp: "Vネックセーター", kr: "브이넥 스웨터" }, // → 18 / 7
  "short sleeve shirt": { jp: "半袖シャツ", kr: "반팔셔츠" }, // → 61 / 23
  "leather jacket": { kr: "레더 재킷" }, // 0 → 3 (GU, piel sintética)
  "rain jacket": { jp: "ブロックテック" }, // → 2 (BLOCKTECH)
  "smart pants": { jp: "スラックス", kr: "슬랙스" }, // → 21 / 1
};

/** Los escalones de búsqueda de un término en un mercado, sin repetir, del más fino al más general. */
export function consultasPara(termino: string, mercado: Mercado): string[] {
  const t = termino.trim();
  if (!t) return [];
  const cabeza = cabezaDeTermino(t);
  const base = BASE_DE[cabeza] ?? cabeza;
  const local = NOMBRE_LOCAL[base]?.[mercado];
  const atributo = ATRIBUTOS_EXIGIDOS.find((a) => new RegExp(`(^|\\s)${a}(\\s|$)`).test(t)) ?? null;
  const conAtributo = atributo ? (cabeza.includes(atributo) ? cabeza : `${atributo} ${cabeza}`) : null;
  const atributoLocal = conAtributo ? FRASE_LOCAL[conAtributo]?.[mercado] : undefined;
  return [
    ...new Set(
      [t, ...(conAtributo ? [conAtributo] : []), ...(atributoLocal ? [atributoLocal] : []), cabeza, base, ...(local ? [local] : [])].filter(Boolean)
    ),
  ];
}

/**
 * LA CONSULTA DE LA VITRINA, con escalones. Se baja de escalón cuando lo que
 * vino no SIRVE (nada pasa los filtros de la pieza: `sirve`), no sólo cuando
 * vino vacío. Medido el 2026-10-21: "turtleneck knit sweater" devolvía 1 suéter
 * gris en EE. UU. y nunca llegaba a "turtleneck sweater"; "v-neck knit
 * sweater" devolvía 1 rosa en Japón y nunca llegaba a "Vネックセーター" (18).
 * Si ningún escalón sirve, se devuelve el más específico que trajo algo (de
 * ahí sale "la más cercana", como antes). Si uno falla, se detiene ahí.
 * Devuelve también qué palabra se usó: la medición la enseña.
 */
export async function consultarVitrina(
  mercado: Mercado,
  termino: string,
  opts: {
    onError?: (mercado: Mercado, mensaje: string) => Promise<void> | void;
    fetchImpl?: typeof fetch;
    /** ¿Estos ítems dejan algo que enseñar con esta palabra? Sin él, basta con que vengan ítems. */
    sirve?: (items: UniqloItem[], q: string) => boolean;
  } = {}
): Promise<Consulta & { q: string }> {
  const { sirve, ...resto } = opts;
  let primeraConItems: (Consulta & { q: string }) | null = null;
  let ultima: Consulta & { q: string } = { items: [], vistoEl: null, categorias: [], q: termino };
  for (const q of consultasPara(termino, mercado)) {
    const r = await consultarUniqloEnCategoria(mercado, q, { ...resto, termino });
    ultima = { ...r, q };
    if (r.fallo) return primeraConItems ?? ultima;
    if (r.items.length === 0) continue;
    primeraConItems ??= ultima;
    if (!sirve || sirve(r.items, q)) return ultima;
  }
  return primeraConItems ?? ultima;
}

/** Fecha corta para la card: "20 oct". */
export function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }).format(d);
}

// --- Modo tienda -------------------------------------------------------------
//
// En Japón y Corea hay tienda Uniqlo en cada esquina: lo útil ahí no es el
// enlace sino lo que le enseñas al personal o tecleas en la app de Uniqlo. La
// etiqueta trae el número de producto de seis dígitos ("No. 488243") y el
// código de color ("14"); la API los da como "E488243-000" y "14".

/** "E488243-000" → "488243". Lo que no tenga esa forma, tal cual sin prefijo. */
export function numeroDeProducto(productId: string): string {
  const m = /^[A-Z]?(\d{6})(?:-\d+)?$/.exec(productId.trim());
  return m ? m[1] : productId.replace(/^[A-Z]/, "").replace(/-\d+$/, "");
}

// --- Precio en pesos -----------------------------------------------------------
//
// Tipo de cambio del Banco Central Europeo vía Frankfurter (sin llave), una
// consulta al día en la Data Cache de Next. Si falla, no se enseñan pesos: nunca
// un tipo de cambio inventado.
export type TasasMxn = Partial<Record<"USD" | "JPY" | "KRW", number>>;

/** Pesos por una unidad de cada moneda, o null si la consulta falla. */
export async function tasasAMxn(fetchImpl: typeof fetch = fetch): Promise<TasasMxn | null> {
  try {
    const res = await fetchImpl("https://api.frankfurter.dev/v1/latest?base=MXN&symbols=USD,JPY,KRW", {
      cache: "force-cache",
      next: { revalidate: 24 * 60 * 60 },
      signal: AbortSignal.timeout(3000),
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const out: TasasMxn = {};
    for (const k of ["USD", "JPY", "KRW"] as const) {
      const porPeso = json.rates?.[k];
      if (typeof porPeso === "number" && porPeso > 0) out[k] = 1 / porPeso;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** "≈ $550 MXN" redondeado a decenas; null si no hay tasa para esa moneda. */
export function pesosAprox(moneda: string, valor: number, tasas: TasasMxn | null | undefined): string | null {
  const tasa = tasas?.[moneda as keyof TasasMxn];
  if (!tasa || !Number.isFinite(valor)) return null;
  const pesos = Math.round((valor * tasa) / 10) * 10;
  return `≈ $${new Intl.NumberFormat("en-US").format(pesos)} MXN`;
}

/** ¿Se enseñan pesos? México, o país sin dato (cuentas anteriores a que se guardara). */
export function mostrarPesos(pais: string | null | undefined): boolean {
  return !pais || pais.toUpperCase() === "MX";
}

// --- "La compré" ----------------------------------------------------------------
//
// La compra era lo único que la prueba no podía ver sin preguntar por WhatsApp.
// Un toque mete ESA prenda a tu clóset (con su foto de Uniqlo) y cubre la pieza
// en la maleta. Lo que manda el navegador se valida aquí: la foto sólo de
// image.uniqlo.com y la ficha sólo de uniqlo.com.
export type CompraDeTienda = {
  entrada: string;
  tienda: string;
  producto: string;
  url: string;
  foto: string;
  precio: number;
  moneda: string;
  /** true si se compró "la más cercana" (cedió el tono): la lectura las separa. */
  cercana?: boolean;
};

export function validarCompra(c: Partial<CompraDeTienda> | null | undefined): CompraDeTienda | null {
  if (!c) return null;
  const foto = fotoSegura(c.foto);
  const url = typeof c.url === "string" && /^https:\/\/www\.uniqlo\.com\/(us|jp|kr)\//.test(c.url) ? c.url : null;
  const entrada = typeof c.entrada === "string" && /^(us|jp|kr):[A-Z]?\d+-\d+:\w+$/.test(c.entrada) ? c.entrada : null;
  if (!foto || !url || !entrada) return null;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    entrada,
    tienda: texto(c.tienda, 40) || "Uniqlo",
    producto: texto(c.producto, 120),
    url,
    foto,
    precio: typeof c.precio === "number" && Number.isFinite(c.precio) ? c.precio : 0,
    moneda: texto(c.moneda, 3).toUpperCase(),
    cercana: c.cercana === true,
  };
}
