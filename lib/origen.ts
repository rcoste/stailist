// DE DÓNDE LLEGÓ CADA PERSONA — la atribución que no depende de Google.
//
// POR QUÉ EXISTE
// El 2026-09-10 Roberto decidió prender Google Ads (y TikTok después) y nada en
// la app guardaba de qué anuncio llegó alguien. Los paneles de Google y TikTok
// cuentan clics y registros, pero no saben lo único que decide si la campaña
// sirve: si esa persona VOLVIÓ. Eso sólo lo sabe nuestra base, así que el origen
// tiene que vivir en ella, pegado a la cuenta.
//
// CÓMO VIAJA
// 1. proxy.ts lee la URL de cada visita y, si trae etiquetas de campaña (o un
//    referer de otro sitio), deja una cookie de primera parte `st_origen`.
// 2. /onboarding/genero, la primera vez que la persona abre la app, copia esa
//    cookie a `profiles.origen` (migración 0158).
//
// QUÉ VISITA GANA (decidirOrigen)
// - Una visita con etiquetas de campaña DISTINTAS reemplaza a la anterior: si
//   alguien vio el anuncio A y días después entró por el B, el que lo convenció
//   de registrarse fue el B.
// - Las MISMAS etiquetas otra vez (recargar, o la redirección a /login que
//   conserva la query) no tocan nada: es el mismo clic, y pisarlo borraba la
//   página a la que llegó de verdad.
// - Una visita sin etiquetas pero con referer externo (Google orgánico, un link
//   en WhatsApp web) sólo se guarda si no había nada: no puede borrar el
//   anuncio que la trajo la primera vez.
// - Una visita directa (sin etiquetas ni referer) no escribe nada.
//
// LO QUE NO GUARDA, a propósito: la URL completa del referer (puede traer la
// búsqueda exacta o datos de otro sitio) — sólo el dominio. Y los valores pasan
// por una lista de caracteres permitidos y un tope: la revisión adversarial del
// 2026-09-10 fabricó un link con acentos que, codificado, inflaba la cookie a
// ~14 KB (el navegador la tira en silencio y se pierde la atribución) y dejaba
// meter cualquier texto como "campaña" en el panel.

export const COOKIE_ORIGEN = "st_origen";
/** 90 días: una campaña se decide en semanas, y más allá el origen ya no explica nada. */
export const ORIGEN_MAX_AGE_S = 60 * 60 * 24 * 90;

export const PARAMETROS_ORIGEN = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  // Google Ads: gclid en web; gbraid/wbraid son su sustituto en iOS.
  "gclid",
  "gbraid",
  "wbraid",
  // TikTok y Meta.
  "ttclid",
  "fbclid",
] as const;

type Parametro = (typeof PARAMETROS_ORIGEN)[number];

export type Origen = Partial<Record<Parametro, string>> & {
  /** Dominio del sitio del que venía, sin ruta ni query. */
  referer?: string;
  /** Primera página que abrió en esta visita (sólo la ruta). */
  landing: string;
  /** Cuándo (ISO). */
  at: string;
};

const MAX = 120;
/** Muy por debajo de los 4 KB a partir de los cuales el navegador tira la cookie. */
const MAX_SERIALIZADO = 1800;

// ASCII seguro: letras, dígitos, espacio y . _ - ~ + :  (los ids de clic de
// Google y TikTok caben; una campaña "méxico" queda "mxico", que se lee igual).
const NO_PERMITIDO = /[^\w.\-~+: ]/g;
const NO_PERMITIDO_RUTA = /[^\w.\-~/]/g;

function limpio(v: string | null | undefined): string | undefined {
  const t = v?.replace(NO_PERMITIDO, "").trim();
  return t ? t.slice(0, MAX) : undefined;
}

function rutaLimpia(v: string): string {
  return v.replace(NO_PERMITIDO_RUTA, "").slice(0, MAX) || "/";
}

function tieneParametros(o: Partial<Origen> | null): boolean {
  return !!o && PARAMETROS_ORIGEN.some((k) => !!o[k]);
}

const mismoClic = (a: Origen, b: Origen): boolean =>
  PARAMETROS_ORIGEN.every((k) => (a[k] ?? "") === (b[k] ?? ""));

/** El dominio del referer si es de OTRO sitio web; undefined si es el propio, no es web o no se lee. */
export function hostExterno(referer: string | null, propioHost: string): string | undefined {
  if (!referer) return undefined;
  let u: URL;
  try {
    u = new URL(referer);
  } catch {
    return undefined;
  }
  // android-app://com.google.android.gm y similares no son un sitio: la app de
  // correo no es una fuente de tráfico que se pueda comprar.
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
  const h = u.hostname.toLowerCase();
  const propio = propioHost.toLowerCase().replace(/^www\./, "");
  const sinWww = h.replace(/^www\./, "");
  if (!sinWww || sinWww === propio) return undefined;
  return limpio(h);
}

/** Lo que dice ESTA visita sobre de dónde viene, o null si no dice nada. */
export function leerOrigen(
  url: { pathname: string; searchParams: URLSearchParams; hostname: string },
  referer: string | null,
  ahora: Date
): Origen | null {
  const o: Origen = { landing: rutaLimpia(url.pathname), at: ahora.toISOString() };
  for (const k of PARAMETROS_ORIGEN) {
    const v = limpio(url.searchParams.get(k));
    if (v) o[k] = v;
  }
  const ref = hostExterno(referer, url.hostname);
  if (ref) o.referer = ref;
  if (!tieneParametros(o) && !o.referer) return null;
  return serializarOrigen(o).length <= MAX_SERIALIZADO ? o : null;
}

/** Qué escribir en la cookie, o null para no tocarla. Reglas arriba. */
export function decidirOrigen(existente: Origen | null, nuevo: Origen | null): Origen | null {
  if (!nuevo) return null;
  if (tieneParametros(nuevo)) return existente && mismoClic(existente, nuevo) ? null : nuevo;
  return existente ? null : nuevo;
}

/**
 * Lee la cookie. Tolera que llegue codificada o no (la librería de cookies de
 * Next codifica al escribir y decodifica al leer, pero una cookie a mano no) y
 * descarta todo lo que no sea una clave conocida: el valor viene del navegador.
 */
export function parseOrigen(raw: string | null | undefined): Origen | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    try {
      data = JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }
  return origenDesdeDato(data);
}

/** Valida un objeto ya parseado (la cookie, o el jsonb de profiles.origen). */
export function origenDesdeDato(data: unknown): Origen | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.landing !== "string" || typeof d.at !== "string") return null;
  const at = limpio(d.at);
  if (!at) return null;
  const o: Origen = { landing: rutaLimpia(d.landing), at: at.slice(0, 40) };
  for (const k of [...PARAMETROS_ORIGEN, "referer"] as const) {
    const v = d[k];
    const valor = typeof v === "string" ? limpio(v) : undefined;
    if (valor) o[k] = valor;
  }
  return tieneParametros(o) || o.referer ? o : null;
}

export function serializarOrigen(o: Origen): string {
  return JSON.stringify(o);
}
