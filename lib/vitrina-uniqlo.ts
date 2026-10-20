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
  botin: "boots",
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
};

/**
 * El término en inglés con el que se busca un tipo de prenda; null si no
 * sabemos buscarlo. Los modificadores salen del `tipo` Y del `nombre` de la
 * pieza: "Short de lino negro" trae tipo "short" a secas, y buscar "shorts"
 * sin "linen" le devolvió a Roberto bóxers y shorts de sudadera (2026-10-21).
 */
export function terminoDe(tipo: string | null | undefined, nombre?: string | null): string | null {
  if (!tipo) return null;
  const canon = tipoCanonico(tipo);
  const [cabeza, ...resto] = canon.split("-");
  const base = TERMINOS[cabeza];
  if (!base) return null;
  // "cuello-alto" / "cuello-tortuga": la cabeza ya dice turtleneck.
  if (cabeza === "cuello") return base;
  const palabrasNombre = nombre ? tipoCanonico(nombre).split("-") : [];
  const mods: string[] = [];
  for (const m of [...resto, ...palabrasNombre]) {
    const t = MODIFICADORES[m];
    if (t && !mods.includes(t) && !base.includes(t)) mods.push(t);
  }
  return [...mods, base].join(" ");
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
  shirt: /\bshirt\b/i,
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
  if (!/[a-z]/i.test(nombre) || /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(nombre)) return true;
  const partes = termino.trim().split(" ");
  const cabeza = partes.length > 1 && NOMBRES_EN[partes.slice(-2).join(" ")] ? partes.slice(-2).join(" ") : partes.at(-1) ?? "";
  const re = NOMBRES_EN[cabeza];
  return re ? re.test(nombre) : true;
}

/** Cuántos modificadores del término ("linen", "knit") dice el nombre: desempata hacia la prenda más parecida. */
export function puntosDeModificador(nombre: string, termino: string): number {
  const mods = termino.trim().split(" ").slice(0, -1);
  return mods.filter((m) => nombre.toLowerCase().includes(m.toLowerCase())).length;
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
  "azul claro": ["LIGHT BLUE"],
  verde: ["GREEN", "DARK GREEN"],
  esmeralda: ["GREEN", "DARK GREEN"],
  oliva: ["OLIVE", "KHAKI"],
  chocolate: ["DARK BROWN", "BROWN"],
  cafe: ["DARK BROWN", "BROWN"],
  marron: ["DARK BROWN", "BROWN"],
  vino: ["WINE", "DARK RED"],
  rubi: ["WINE", "RED", "DARK RED"],
  burdeos: ["WINE", "DARK RED"],
  rojo: ["RED"],
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
export function elegirPrendas(
  items: UniqloItem[] | null | undefined,
  hueco: { segmento: Segmento; colorFamilia: string; termino?: string | null },
  mercado: Mercado,
  vistoEl: string | null = null,
  maximo = 2
): PrendaVitrina[] {
  const generos = new Set([hueco.segmento === "hombre" ? "MEN" : "WOMEN", "UNISEX"]);
  const colores = coloresDe(hueco.colorFamilia);
  if (colores.length === 0) return [];
  const termino = hueco.termino ?? "";
  const candidatas: (PrendaVitrina & { rating: number; puntos: number })[] = [];
  for (const it of items ?? []) {
    if (!it?.productId || !it.name || !generos.has(it.genderCategory ?? "")) continue;
    // Ni ropa interior ni algo que no diga la prenda pedida (2026-10-21: a un
    // "short de lino negro" le salió un bóxer a rayas y un short de sudadera).
    if (esRopaInterior(it.name, termino)) continue;
    if (termino && !nombreCoincide(it.name, termino)) continue;
    const precio = it.prices?.base?.value;
    if (typeof precio !== "number") continue;
    const color = (it.colors ?? []).find((c) => colores.includes((c.name ?? "").toUpperCase()));
    if (!color?.displayCode) continue;
    const foto = fotoSegura(it.images?.main?.[color.displayCode]?.image);
    if (!foto) continue;
    candidatas.push({
      id: `${mercado}:${it.productId}:${color.displayCode}`,
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
      rating: it.rating?.average ?? 0,
      puntos: termino ? puntosDeModificador(it.name, termino) : 0,
    });
  }
  // Primero la que más se parece a lo pedido (dice "linen", "knit"…), luego la mejor calificada.
  candidatas.sort((a, b) => b.puntos - a.puntos || b.rating - a.rating);
  return candidatas.slice(0, maximo).map((c) => {
    const { rating: _r, puntos: _p, ...p } = c;
    return p;
  });
}

/** La clave con la que se cuentan vistas y clics: segmento|tipo canónico|color. */
export function claveVitrina(segmento: Segmento, tipo: string, colorFamilia: string): string {
  return `${segmento}|${tipoCanonico(tipo)}|${slug(colorFamilia)}`;
}

// --- El único fetch -----------------------------------------------------------

export const LIMITE_RESPUESTA = 20; // limit=40 pesa 216 KB; se eligen 2
const CACHE_SEGUNDOS = 7 * 24 * 60 * 60;
const TIMEOUT_MS = 3000;

export type Consulta = { items: UniqloItem[]; vistoEl: string | null };

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
  } = {}
): Promise<Consulta> {
  const vacia: Consulta = { items: [], vistoEl: null };
  if (!q.trim()) return vacia;
  const params = new URLSearchParams({
    q,
    offset: "0",
    limit: String(LIMITE_RESPUESTA),
    httpFailure: "true",
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
      return vacia;
    }
    const json = (await res.json()) as { status?: string; result?: { items?: UniqloItem[] } };
    if (json.status !== "ok") {
      await opts.onError?.(mercado, `status ${json.status ?? "sin status"}`);
      return vacia;
    }
    return { items: json.result?.items ?? [], vistoEl: res.headers?.get?.("date") ?? null };
  } catch (e) {
    const mensaje = e instanceof Error && e.name === "TimeoutError" ? "timeout" : e instanceof Error ? e.message : String(e);
    await opts.onError?.(mercado, mensaje);
    return vacia;
  }
}

/** Fecha corta para la card: "20 oct". */
export function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }).format(d);
}
