import { PARAMETROS_ORIGEN } from "@/lib/origen";
import { isMinor, type AgeRange } from "@/lib/edad";

// LAS ETIQUETAS DE PUBLICIDAD: Google Ads, Google Analytics 4 y el píxel de
// TikTok. APAGADAS HASTA QUE EXISTA SU ID.
//
// POR QUÉ EXISTE
// Roberto prende Google Ads el lunes 2026-09-14 y TikTok después. Sin etiquetas,
// Google no sabe qué anuncio trae registros y no puede optimizar: se paga de
// más a ciegas. "El switch" es literal: sin la variable NEXT_PUBLIC_* de cada
// plataforma no se carga NADA de ella; con la variable puesta (y un redeploy,
// porque Next las hornea en el bundle) se prende.
//
// DÓNDE CARGAN, Y DÓNDE NO (rutaMedible)
// En la landing (donde cae el anuncio) y en dos pantallas del onboarding: el
// objetivo y el wow (ver ZONA_MEDIDA). No en el login, género, edad, swipes,
// colores ni clóset. Dentro de la app (clóset, looks, perfil) tampoco — y eso lo promete el
// aviso de privacidad, así que no puede quedar en buena intención: toda salida
// de la zona con etiquetas vivas es una navegación completa (salirSinEtiquetas,
// y components/tags-publicidad.tsx convierte los links), con una recarga como
// red de seguridad.
//
// QUÉ SE LES MANDA
// Visitas de esas páginas (a Google con la URL LIMPIA: sólo ruta + etiquetas de
// campaña, ver urlParaEtiquetas; a TikTok nada —ni siquiera se carga su píxel—
// si la dirección trae otra cosa, porque lee la URL cruda) y dos momentos:
// `registro` y `primer_look`. Nunca el correo, nunca nada del clóset. Una cuenta
// de 13-17 años deja la cookie COOKIE_MENOR en cada navegador donde siga su
// onboarding, y con ella no se carga nada.
//
// QUÉ SE APAGA DEL LADO DE GOOGLE (config en cargarEtiquetas): señales de Google
// y personalización de anuncios. Medimos anuncios; no armamos audiencias. Si un
// día se quiere remarketing, se cambia aquí Y en el aviso, en el mismo commit.
//
// PRECONDICIONES QUE EL CÓDIGO NO PUEDE GARANTIZAR (docs/designs/adwords-readiness.md):
// en Google Ads, conversiones mejoradas y "datos proporcionados por el usuario"
// apagados; en GA4, "cambios de página según el historial" e "interacciones con
// formularios" apagados; en TikTok, coincidencia avanzada automática apagada.
// La landing SÍ tiene campo de correo: su promesa depende de esos ajustes.

export type TipoConversion = "registro" | "primer_look";

export type IdsPublicidad = {
  googleAds?: string;
  labelRegistro?: string;
  labelPrimerLook?: string;
  ga4?: string;
  tiktok?: string;
};

/** La cookie con la que el servidor le pide al navegador medir un momento. */
export const COOKIE_CONVERSION = "st_conversion";
/** "1" = una cuenta de 13-17 años sigue su onboarding en este navegador: no se carga nada. */
export const COOKIE_MENOR = "st_menor";
/** localStorage: "1" = esta persona pidió no ser medida (botón en /privacidad). */
export const OPT_OUT_KEY = "st_sin_medicion";

const FORMATOS: Record<keyof IdsPublicidad, RegExp> = {
  googleAds: /^AW-\d{6,15}$/,
  labelRegistro: /^[\w-]{4,40}$/,
  labelPrimerLook: /^[\w-]{4,40}$/,
  ga4: /^G-[A-Z0-9]{6,15}$/,
  tiktok: /^[A-Z0-9]{10,30}$/,
};

/**
 * Valida cada ID contra su formato. Un ID con typo se descarta en vez de
 * cargarse: además de no medir nada, el valor termina interpolado en una URL y
 * en un script.
 */
export function limpiarIds(raw: Partial<Record<keyof IdsPublicidad, string | undefined>>): IdsPublicidad {
  const out: IdsPublicidad = {};
  for (const k of Object.keys(FORMATOS) as (keyof IdsPublicidad)[]) {
    const v = raw[k]?.trim();
    if (v && FORMATOS[k].test(v)) out[k] = v;
  }
  return out;
}

export function idsPublicidad(): IdsPublicidad {
  // Cada variable escrita completa: Next sólo hornea las que ve literales.
  return limpiarIds({
    googleAds: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    labelRegistro: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_REGISTRO,
    labelPrimerLook: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_PRIMER_LOOK,
    ga4: process.env.NEXT_PUBLIC_GA4_ID,
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  });
}

export const hayEtiquetas = (ids: IdsPublicidad): boolean =>
  !!(ids.googleAds || ids.ga4 || ids.tiktok);

/**
 * LA ZONA MEDIDA, como lista de lo PERMITIDO (no de lo prohibido):
 * - `/`: la landing, donde cae el anuncio.
 * - `/onboarding/objetivo`: la primera pantalla medida después de la edad; ahí
 *   sale el registro que se decidió al guardarla.
 * - `/onboarding/wow`: donde llega el primer look.
 * Fuera, además del login y la app: género (va antes de saber si es menor),
 * edad (correo del tutor) y — desde la revisión legal del 2026-09-10 — los
 * swipes, el quiz de color y el checklist del clóset: ahí se contestan gustos y
 * rasgos (venas, cabello, ojos), y la captura automática de clics del píxel de
 * TikTok no se puede apagar desde el código. Una pantalla nueva del onboarding
 * NO queda medida hasta que alguien la agregue aquí a propósito.
 */
const ZONA_MEDIDA = ["/", "/onboarding/objetivo", "/onboarding/wow"];

export function rutaMedible(pathname: string): boolean {
  return ZONA_MEDIDA.some((r) => pathname === r || (r !== "/" && pathname.startsWith(`${r}/`)));
}

/** ¿Un link del propio sitio lleva fuera de la zona medida? (Los externos ya son navegación completa.) */
export function linkSaleDeZona(destino: URL, origenPropio: string): boolean {
  return destino.origin === origenPropio && !rutaMedible(destino.pathname);
}

/** El botón de /privacidad, Global Privacy Control o una menor: cualquiera apaga todo. */
export function medicionPermitida(p: { optOut: boolean; gpc: boolean; menor: boolean }): boolean {
  return !p.optOut && !p.gpc && !p.menor;
}

/**
 * ¿Se le avisa a las plataformas del primer look de esta persona? Sólo en el
 * paso 4 (sus primeros looks, se estén generando o ya guardados de una corrida
 * que murió antes de avisar), y nunca sin edad o de alguien de 13-17.
 */
export function debeMedirPrimerLook(step: number, ageRange: AgeRange | null): boolean {
  return step === 4 && ageRange !== null && !isMinor(ageRange);
}

export function esTipoConversion(v: unknown): v is TipoConversion {
  return v === "registro" || v === "primer_look";
}

/**
 * La URL que ve Google: origen + ruta + SÓLO las etiquetas de campaña. Todo lo
 * demás de la query se tira — un `?email=` viejo, un token, el id de un look.
 * Las etiquetas sí se quedan: GA4 atribuye la visita leyéndolas.
 */
export function urlParaEtiquetas(href: string): string {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return "";
  }
  const limpia = new URL(u.origin + u.pathname);
  for (const k of PARAMETROS_ORIGEN) {
    const v = u.searchParams.get(k);
    if (v) limpia.searchParams.set(k, v);
  }
  return limpia.toString();
}

/** Parámetros que no dicen nada de la persona: los de campaña y `g` (la versión de la landing). */
const PARAMETROS_INOFENSIVOS: readonly string[] = [...PARAMETROS_ORIGEN, "g"];

/**
 * ¿La dirección trae SÓLO parámetros inofensivos? TikTok no deja pasarle una
 * URL limpia (su píxel lee location.href), así que si trae cualquier otra cosa
 * no se le carga ni se le manda nada.
 */
export function urlSoloConCampana(href: string): boolean {
  try {
    return [...new URL(href).searchParams.keys()].every((k) => PARAMETROS_INOFENSIVOS.includes(k));
  } catch {
    return false;
  }
}

type Comando =
  | { a: "gtag"; args: [string, string, Record<string, unknown>] }
  | { a: "ttq"; evento: string };

/**
 * QUÉ SE LE DICE A CADA PLATAFORMA EN CADA MOMENTO. Es la decisión que viaja, y
 * por eso es pura y tiene test.
 *
 * - GA4: `sign_up` es su evento recomendado para registro; `primer_look` es
 *   nuestro.
 * - Google Ads: una acción de conversión por momento, identificada por su label.
 *   Sin label, no se manda (una conversión sin label no la cuenta nadie).
 * - TikTok: `CompleteRegistration` es estándar y es con el que se optimiza al
 *   arrancar; `PrimerLook` es personalizado y sirve para reportar.
 */
export function comandosDeConversion(tipo: TipoConversion, ids: IdsPublicidad): Comando[] {
  const out: Comando[] = [];
  if (ids.ga4) {
    out.push(
      tipo === "registro"
        ? { a: "gtag", args: ["event", "sign_up", { method: "email", send_to: ids.ga4 }] }
        : { a: "gtag", args: ["event", "primer_look", { send_to: ids.ga4 }] }
    );
  }
  const label = tipo === "registro" ? ids.labelRegistro : ids.labelPrimerLook;
  if (ids.googleAds && label) {
    out.push({ a: "gtag", args: ["event", "conversion", { send_to: `${ids.googleAds}/${label}` }] });
  }
  if (ids.tiktok) {
    out.push({ a: "ttq", evento: tipo === "registro" ? "CompleteRegistration" : "PrimerLook" });
  }
  return out;
}

// ─── Lo que corre en el navegador ────────────────────────────────────────────

type Ttq = { page: () => void; track: (evento: string) => void };
type Ventana = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; ttq?: Ttq };

let cargadas = false;
export const etiquetasCargadas = (): boolean => cargadas;

export function gpcActivo(): boolean {
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function permitidoEnEsteNavegador(): boolean {
  let optOut: boolean;
  try {
    optOut = localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    // Sin storage no hay dónde leer el botón de /privacidad: se asume que sí
    // lo pulsó. Mejor perder una medición que medir a quien pidió que no.
    optOut = true;
  }
  const menor = new RegExp(`(?:^|;\\s*)${COOKIE_MENOR}=1(?:;|$)`).test(document.cookie);
  return medicionPermitida({ optOut, gpc: gpcActivo(), menor });
}

function inyectarScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

// El snippet base oficial de TikTok, sin la llamada a page() (la hace
// registrarVista, para no contar dos veces la primera). El id ya pasó por
// limpiarIds: sólo mayúsculas y dígitos, no puede romper el string.
const snippetTiktok = (id: string) =>
  `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load("${id}");}(window,document,"ttq");`;

/** Idempotente. Devuelve si quedaron cargadas. */
export function cargarEtiquetas(ids: IdsPublicidad = idsPublicidad()): boolean {
  if (cargadas) return true;
  if (typeof window === "undefined") return false;
  if (!hayEtiquetas(ids) || !rutaMedible(location.pathname) || !permitidoEnEsteNavegador()) return false;
  const w = window as Ventana;
  const pagina = urlParaEtiquetas(location.href);

  if (ids.googleAds || ids.ga4) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() {
      // gtag.js exige el objeto `arguments`, no un arreglo: con [...args] los
      // comandos se encolan y nunca se procesan, sin ningún error.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag("js", new Date());
    w.gtag("set", { allow_google_signals: false, allow_ad_personalization_signals: false });
    // send_page_view: false — las visitas las manda registrarVista con la URL
    // limpia; la automática llevaría la query completa.
    if (ids.ga4) w.gtag("config", ids.ga4, { send_page_view: false, page_location: pagina });
    if (ids.googleAds) w.gtag("config", ids.googleAds, { page_location: pagina });
    inyectarScript(`https://www.googletagmanager.com/gtag/js?id=${ids.googleAds ?? ids.ga4}`);
  }

  // Su píxel lee la URL cruda en cuanto carga (vistas, clics automáticos): con
  // cualquier otra cosa en la dirección, a TikTok no se le carga nada.
  if (ids.tiktok && urlSoloConCampana(location.href)) {
    const s = document.createElement("script");
    s.textContent = snippetTiktok(ids.tiktok);
    document.head.appendChild(s);
  }

  cargadas = true;
  return true;
}

let ultimaVista = "";

export function registrarVista(ids: IdsPublicidad = idsPublicidad()) {
  if (!cargadas) return;
  // Una vista por dirección: si el efecto corre dos veces para la misma ruta
  // (React en desarrollo lo hace a propósito; se vio al verificar), GA4 no la
  // cuenta doble. Ir y volver a la misma página sí cuenta: la anterior ya es otra.
  const pagina = urlParaEtiquetas(location.href);
  if (pagina === ultimaVista) return;
  ultimaVista = pagina;
  const w = window as Ventana;
  if (ids.ga4) {
    w.gtag?.("event", "page_view", {
      send_to: ids.ga4,
      page_location: pagina,
      page_title: document.title,
    });
  }
  if (ids.tiktok && urlSoloConCampana(location.href)) w.ttq?.page();
}

const claveMedida = (tipo: TipoConversion) => `st_conv_${tipo}`;

/**
 * Manda un momento a las plataformas. Una sola vez por navegador: recargar el
 * wow o volver atrás no puede contar dos registros.
 */
export function registrarConversion(tipo: TipoConversion, ids: IdsPublicidad = idsPublicidad()): boolean {
  if (!cargarEtiquetas(ids)) return false;
  try {
    if (localStorage.getItem(claveMedida(tipo))) return false;
  } catch {
    /* sin storage: se manda, mejor que perderla */
  }
  const cmds = comandosDeConversion(tipo, ids);
  // Sin comandos (p. ej. el ID de Ads puesto antes que sus labels) no se marca
  // como enviada: si se marcara, ese navegador ya no la contaría nunca.
  if (cmds.length === 0) return false;
  const w = window as Ventana;
  const tiktokPuedeVer = urlSoloConCampana(location.href);
  for (const c of cmds) {
    if (c.a === "gtag") w.gtag?.(...c.args);
    else if (tiktokPuedeVer) w.ttq?.track(c.evento);
  }
  try {
    localStorage.setItem(claveMedida(tipo), new Date().toISOString());
  } catch {
    /* idem */
  }
  return true;
}

/**
 * Sale de la zona medida SIN que las etiquetas vean la página siguiente: si
 * están vivas, navegación completa (los scripts mueren con la página; GA4 ni
 * alcanza a registrar el cambio de historial). Devuelve si navegó.
 */
export function salirSinEtiquetas(href: string): boolean {
  if (!cargadas) return false;
  window.location.assign(href);
  return true;
}

/** Lee y BORRA la cookie de conversión pendiente que dejó el servidor. */
export function tomarConversionPendiente(): TipoConversion | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_CONVERSION}=([^;]*)`));
    if (!m) return null;
    document.cookie = `${COOKIE_CONVERSION}=; Max-Age=0; path=/`;
    const v = decodeURIComponent(m[1]);
    return esTipoConversion(v) ? v : null;
  } catch {
    return null;
  }
}
