// DESDE DÓNDE ENTRÓ (2026-10-06).
//
// La campaña de Meta trajo un correo que parecía de fuera de México y no había
// forma de saberlo: no guardábamos el país. Ahora se guarda una sola vez por
// cuenta, junto al aparato (lib/dispositivo.ts), al arrancar el onboarding.
//
// Sale de los encabezados que Vercel le pone a cada visita a partir de la IP
// (x-vercel-ip-country y x-vercel-ip-country-region). La IP NO se guarda: para
// la pregunta ("¿de qué país y estado llega la gente?") basta el resultado, y
// guardar la IP sería un dato personal de más. Fuera de Vercel (en local) los
// encabezados no existen y el lugar queda sin dato.
//
// Precisión: el país es confiable; el estado es aproximado (la IP de un celular
// puede salir por la ciudad del operador, no la de la persona). Una VPN cambia
// los dos. Sirve para el agregado, no para afirmar dónde vive alguien.

export type Lugar = { pais: string; region: string | null };

const PAIS = /^[A-Z]{2}$/;
const REGION = /^[A-Z0-9]{1,3}$/;

/** Código de país (ISO 3166-1) válido, o null. "XX" y "T1" (Tor) no son países. */
export function esPais(v: unknown): v is string {
  return typeof v === "string" && PAIS.test(v) && v !== "XX" && v !== "T1";
}

export function esRegion(v: unknown): v is string {
  return typeof v === "string" && REGION.test(v);
}

/** El lugar desde los encabezados de Vercel; null si no vienen o no son válidos. */
export function lugarDesdeEncabezados(h: { get(nombre: string): string | null }): Lugar | null {
  const pais = h.get("x-vercel-ip-country")?.trim().toUpperCase();
  if (!esPais(pais)) return null;
  const region = h.get("x-vercel-ip-country-region")?.trim().toUpperCase();
  return { pais, region: esRegion(region) ? region : null };
}

// Estados de México por su código ISO 3166-2 (sin el "MX-"). DIF es el código
// viejo de la capital (antes de 2016) y algunas bases de IP todavía lo usan.
const ESTADOS_MX: Record<string, string> = {
  AGU: "Aguascalientes",
  BCN: "Baja California",
  BCS: "Baja California Sur",
  CAM: "Campeche",
  CHP: "Chiapas",
  CHH: "Chihuahua",
  CMX: "Ciudad de México",
  DIF: "Ciudad de México",
  COA: "Coahuila",
  COL: "Colima",
  DUR: "Durango",
  GUA: "Guanajuato",
  GRO: "Guerrero",
  HID: "Hidalgo",
  JAL: "Jalisco",
  MEX: "Estado de México",
  MIC: "Michoacán",
  MOR: "Morelos",
  NAY: "Nayarit",
  NLE: "Nuevo León",
  OAX: "Oaxaca",
  PUE: "Puebla",
  QUE: "Querétaro",
  ROO: "Quintana Roo",
  SLP: "San Luis Potosí",
  SIN: "Sinaloa",
  SON: "Sonora",
  TAB: "Tabasco",
  TAM: "Tamaulipas",
  TLA: "Tlaxcala",
  VER: "Veracruz",
  YUC: "Yucatán",
  ZAC: "Zacatecas",
};

const nombres = new Intl.DisplayNames(["es"], { type: "region" });

/** "México", "España". Si el código no se reconoce, el código tal cual. */
export function paisEnPalabras(pais: string): string {
  try {
    return nombres.of(pais) ?? pais;
  } catch {
    return pais;
  }
}

/**
 * "México · Nuevo León", "España", o null sin dato. El estado sólo se nombra en
 * México: es donde se reparte la campaña, y fuera basta saber que es fuera.
 */
export function lugarEnPalabras(pais: string | null | undefined, region?: string | null): string | null {
  if (!esPais(pais)) return null;
  const nombre = paisEnPalabras(pais);
  const estado = pais === "MX" && region ? ESTADOS_MX[region] : undefined;
  return estado ? `${nombre} · ${estado}` : nombre;
}
