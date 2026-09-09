// Imágenes curadas para prendas que te FALTAN en la cápsula. Una prenda "falta"
// no está en tu clóset, así que no tiene foto — esto te deja VISUALIZAR lo que te
// falta. Es un mapa sembrado a mano (NO se genera por usuaria: auto-generar
// imágenes de cosas-a-comprar sería la zona de "compras" cortada del MVP). Lo que
// no esté aquí cae al indicador de siempre (un aro). Las imágenes viven en
// public/capsula-falta, en el mismo estilo flat-lay que el catálogo.

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (café → cafe)
    .trim();

// Clave: `${tipo}|${colorFamilia}` normalizado (sin acentos, minúsculas).
const FALTA_IMAGES: Record<string, string> = {
  "cuello-tortuga|negro": "/capsula-falta/cuello-tortuga-negro.png",
  "sueter|esmeralda": "/capsula-falta/sueter-esmeralda.png",
  "chino|cafe": "/capsula-falta/chino-chocolate.png",
};

export function faltaImage(item: { tipo: string; colorFamilia: string }): string | null {
  return FALTA_IMAGES[`${slug(item.tipo)}|${slug(item.colorFamilia)}`] ?? null;
}

// Clave estable de un combo tipo|color para buscar su imagen en mapas del cliente
// (mismo formato que FALTA_IMAGES). La cápsula es de un solo género, así que aquí
// no se incluye el género.
export function faltaKey(item: { tipo: string; colorFamilia: string }): string {
  return `${slug(item.tipo)}|${slug(item.colorFamilia)}`;
}

// SINÓNIMOS Y PLURALES DEL TIPO, porque el tipo ES la clave de la biblioteca.
//
// El `tipo` de una pieza de la cápsula lo escribe un LLM en texto libre, y la
// biblioteca de imágenes se indexa por él. Dos corridas que dicen lo mismo con
// otra palabra producen dos entradas — y la imagen ya pagada no se encuentra.
// Medido en la tabla el 2026-09-09: `calcetin`/`calcetines`, `chino`/`chinos`,
// `botin`/`botines`, `bolsa`/`bolso`, `bailarina`/`balerina` conviven como
// claves distintas. Roberto lo vio como "no se auto generan las imágenes": su
// calcetín esmeralda tenía render desde agosto bajo `calcetines__…`, y esa
// corrida dijo `calcetin__…`, así que la pantalla le ofreció generarla de nuevo.
//
// Sólo se normaliza lo que es LA MISMA PRENDA con otro nombre. Los modificadores
// que cambian lo que ves —`sueter-grueso`, `camisa-lino`, `chamarra-piel`— se
// respetan: ahí la clave más específica es una virtud, no ruido (ver el punto 3
// del mismo día, la trenza del suéter).
const TIPO_CANONICO: Record<string, string> = {
  calcetines: "calcetin",
  chinos: "chino",
  botines: "botin",
  botas: "bota",
  bolso: "bolsa",
  balerina: "bailarina",
  aretes: "arete",
  arracadas: "arete",
  tenis: "tenis", // ya es plural invariable — explícito para que nadie lo "arregle"
  jeans: "jean",
  shorts: "short",
  bermudas: "bermuda",
  mocasines: "mocasin",
  sandalias: "sandalia",
  guantes: "guante",
  lentes: "lentes",
  gafas: "lentes",
};

/** El tipo, en su forma canónica: plurales y sinónimos a UNA sola palabra. */
export function tipoCanonico(tipo: string): string {
  const base = slug(tipo)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Sólo la primera palabra se canoniza; los modificadores se conservan tal
  // cual ("calcetines-lana" → "calcetin-lana").
  const [cabeza, ...resto] = base.split("-");
  return [TIPO_CANONICO[cabeza] ?? cabeza, ...resto].join("-");
}

// Clave/segmento de ruta para la biblioteca compartida (storage + tabla registro).
// Incluye género (un blazer de hombre ≠ uno de mujer) y es segura para path
// (solo a-z0-9 y guiones).
export function catalogStorageKey(
  tipo: string,
  colorFamilia: string,
  gender: string | null
): string {
  const safe = (s: string) =>
    slug(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `${tipoCanonico(tipo)}__${safe(colorFamilia)}__${gender ?? "u"}`;
}

/**
 * Las claves con las que BUSCAR una imagen ya hecha: la canónica y la cruda.
 *
 * Las 316 imágenes de la biblioteca se guardaron con el tipo tal cual venía, así
 * que canonizar a secas dejaría huérfanas las que están bajo la forma vieja
 * (`calcetines__esmeralda__hombre`) y se volverían a pagar. Se busca con las
 * dos; lo que se GUARDA de aquí en adelante siempre es la canónica.
 */
export function catalogLookupKeys(
  tipo: string,
  colorFamilia: string,
  gender: string | null
): string[] {
  const safe = (s: string) =>
    slug(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const cruda = `${safe(tipo)}__${safe(colorFamilia)}__${gender ?? "u"}`;
  const canonica = catalogStorageKey(tipo, colorFamilia, gender);
  return canonica === cruda ? [canonica] : [canonica, cruda];
}

// Familia de color (texto de la cápsula ideal, p. ej. "marino", "neutro claro")
// → hex aproximado para el swatch del clóset cuando sumas una prenda que no tiene
// foto. Matching por subcadena sobre el slug; cae a un neutro cálido si no acierta.
const FAMILIA_HEX: [string, string][] = [
  ["negro", "#1A1A1A"],
  ["blanco", "#F2F2F2"],
  ["hueso", "#ECE7DE"],
  ["crema", "#E7DDC8"],
  ["marino", "#1F2A44"],
  ["azul claro", "#9DB4D4"],
  ["azul", "#3B5BA5"],
  ["gris", "#8A8A8A"],
  ["carbon", "#3A3A3C"],
  ["camel", "#C8A877"],
  ["beige", "#C8B89E"],
  ["chocolate", "#4B3526"],
  ["cafe", "#6B4F3A"],
  ["verde", "#3E5641"],
  ["esmeralda", "#1F6B4A"],
  ["oliva", "#6B6A3A"],
  ["vino", "#5E2A33"],
  ["rojo", "#9B2D2D"],
  ["rosa", "#C98B9E"],
  ["morado", "#5B4673"],
  ["mostaza", "#B8902F"],
  ["neutro claro", "#D9D2C7"],
  ["neutro", "#9B9591"],
];

export function familiaToHex(familia: string): string {
  const s = slug(familia);
  for (const [name, hex] of FAMILIA_HEX) if (s.includes(name)) return hex;
  return "#C9BFB2"; // neutro cálido por defecto
}
