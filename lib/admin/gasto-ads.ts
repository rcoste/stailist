import { timingSafeEqual } from "node:crypto";

// EL GASTO DE GOOGLE ADS, SIN CAPTURARLO A MANO.
//
// Hasta el 2026-10-04 clics, impresiones, costo y registros de Google se
// copiaban a mano en /admin/campana (o los leía Claude desde la cuenta). Si
// nadie capturaba, el costo por primer look salía vacío en el panel y en el
// correo.
//
// Se descartó la API de Google Ads: pide un token de desarrollador que Google
// aprueba a mano (días), un proyecto de Google Cloud y un refresh token que
// caduca, todo para cuatro números al día. En su lugar, un SCRIPT DE GOOGLE ADS
// (corre dentro de la cuenta, a la hora que uno elige, sin aprobaciones) lee los
// últimos 7 días y los manda por POST a /api/campana/gasto con un secreto.
// El script vive en docs/google-ads-script-gasto.js.
//
// Manda 7 días y no sólo ayer a propósito: Google corrige conversiones y clics
// inválidos durante días, y reenviar la semana deja la base al día sola.
//
// Aquí sólo la validación (pura, con tests); la ruta escribe.

export type FilaGastoAds = {
  dia: string;
  campana: string;
  impresiones: number;
  clics: number;
  costo_mxn: number;
  registros: number;
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
/** Nombres de campaña como los de utm_campaign: letras, números, guiones, puntos. */
const CAMPANA = /^[\w.-]{1,64}$/;
export const MAX_FILAS = 500;

const entero = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : null);
const monto = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x < 10_000_000 ? Math.round(x * 100) / 100 : null;

/** Lo que mandó el script, ya validado; lo que no cuadra se descarta fila por fila. */
export function filasValidas(body: unknown): FilaGastoAds[] {
  const filas = (body as { filas?: unknown } | null)?.filas;
  if (!Array.isArray(filas)) return [];
  const out: FilaGastoAds[] = [];
  for (const f of filas.slice(0, MAX_FILAS)) {
    if (!f || typeof f !== "object") continue;
    const r = f as Record<string, unknown>;
    const dia = typeof r.dia === "string" && DIA.test(r.dia) ? r.dia : null;
    const campana = typeof r.campana === "string" && CAMPANA.test(r.campana) ? r.campana : null;
    const impresiones = entero(r.impresiones);
    const clics = entero(r.clics);
    const costo = monto(r.costo_mxn);
    const registros = entero(r.registros);
    if (!dia || !campana || impresiones == null || clics == null || costo == null || registros == null) continue;
    out.push({ dia, campana, impresiones, clics, costo_mxn: costo, registros });
  }
  return out;
}

/** Comparación de tiempo constante: el secreto no se adivina midiendo cuánto tarda en fallar. */
export function secretoValido(recibido: string | null, esperado: string | undefined): boolean {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
