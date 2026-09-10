import { origenDesdeDato, type Origen } from "@/lib/origen";

// EL EMBUDO POR ORIGEN: de cada fuente y campaña, cuántas abrieron la app,
// cuántas llegaron a su primer look y cuántas VOLVIERON.
//
// POR QUÉ EXISTE
// Google Ads y TikTok cuentan clics y registros. No saben lo que decide si la
// campaña de septiembre 2026 sirve: la premisa medida del producto es que la
// gente llega, le gustan los looks y no vuelve (memory: premisa del setup
// refutada). Un registro barato que no vuelve no vale nada, así que la columna
// que importa aquí es la última.
//
// LAS DEFINICIONES, porque un embudo con definiciones implícitas miente:
// - "cuenta": abrió la app. Desde B4 (2026-09-07) eso es tener
//   onboarding_started_at; las cuentas de antes no la tienen y cuentan si
//   eligieron género, que es la mejor huella de lo mismo. Su arranque es
//   coalesce(onboarding_started_at, created_at). Pedir el código y no entrar no
//   cuenta: ese correo nunca vio el producto.
// - "primer look": llegó al paso 5 del onboarding.
// - "volvió": hizo algo (evento, prenda o look) en un día DISTINTO al que
//   arrancó, dentro de los DIAS_VENTANA siguientes, en hora de la Ciudad de
//   México, y al menos MINIMO_PARA_VOLVER después de arrancar (un onboarding que
//   cruza la medianoche no es volver). Los eventos de EVENTOS_QUE_NO_SON_VOLVER
//   no cuentan: pasan sin abrir la app.
// - "ventana cerrada": ya terminó, en CDMX, el último día de su ventana. Por
//   calendario y no por horas, igual que "volvió": medida por horas se cerraba
//   antes de que acabara su último día y la cohorte reciente se veía peor.

export const ZONA = "America/Mexico_City";
export const DIAS_VENTANA = 7;
/** Intervalo de Postgres: la actividad antes de esto es la misma sesión. */
export const MINIMO_PARA_VOLVER = "4 hours";
export const MINIMO_PARA_VOLVER_TEXTO = "4 horas";

/**
 * Eventos que se escriben sin que la persona abra la app. Darse de baja del
 * correo de reenganche desde el propio correo contaba como "volvió" (lo cazó la
 * revisión adversarial del 2026-09-10).
 */
export const EVENTOS_QUE_NO_SON_VOLVER = ["email_unsubscribed"];

// Vive aquí y no en la página para que su test (adquisicion.test.ts) vigile que
// los tres caminos de actividad lleven el mismo piso y la misma exclusión.
// Sin LIMIT a propósito: una fila por cuenta, y cortar en silencio es justo el
// error que esta pantalla existe para no cometer. Cuando sean decenas de miles,
// la agregación por fuente se mueve entera a SQL. Las interpolaciones son sólo
// constantes de este archivo; la lista de eventos viaja como $1.
const DESDE = `b.inicio + interval '${MINIMO_PARA_VOLVER}'`;
const HASTA = `b.inicio + interval '${DIAS_VENTANA + 1} days'`;
export const SQL_ADQUISICION = `
with base as (
  select p.id, p.email, p.gender, p.onboarding_step, p.origen,
    coalesce(p.onboarding_started_at, p.created_at) as inicio
  from public.profiles p
  where (p.onboarding_started_at is not null or p.gender is not null)
    and coalesce(p.is_admin, false) = false
    and coalesce(p.email, '') not ilike '%@stailist.app'
)
select
  b.id,
  b.email,
  b.gender,
  b.onboarding_step,
  b.inicio,
  to_char(b.inicio at time zone '${ZONA}', 'YYYY-MM-DD') as dia_inicio,
  (
    select array_agg(distinct to_char(a.t at time zone '${ZONA}', 'YYYY-MM-DD'))
    from (
      select e.created_at as t from public.events e
        where e.user_id = b.id
          and e.type <> all ($1::text[])
          and e.created_at >= ${DESDE}
          and e.created_at < ${HASTA}
      union all
      select o.created_at from public.outfits o
        where o.user_id = b.id
          and o.created_at >= ${DESDE}
          and o.created_at < ${HASTA}
      union all
      select i.created_at from public.items i
        where i.user_id = b.id
          and i.created_at >= ${DESDE}
          and i.created_at < ${HASTA}
    ) a
  ) as dias,
  b.origen
from base b
order by b.inicio desc
`;

export type FilaPerfilAdquisicion = {
  id: string;
  email: string | null;
  gender: string | null;
  onboarding_step: number;
  /** ISO del arranque: coalesce(onboarding_started_at, created_at). */
  inicio: string;
  /** YYYY-MM-DD en hora de CDMX del arranque. */
  dia_inicio: string;
  /** Días (YYYY-MM-DD, CDMX) con actividad que cuenta para "volvió". */
  dias: string[] | null;
  origen: unknown;
};

export type ResumenOrigen = {
  fuente: string;
  campana: string;
  cuentas: number;
  hombres: number;
  mujeres: number;
  primerLook: number;
  ventanaCerrada: number;
  volvieron: number;
};

const SIN_RASTRO = "directo / sin rastro";

export function fuenteDe(o: Origen | null): string {
  if (!o) return SIN_RASTRO;
  if (o.utm_source) return o.utm_source.toLowerCase();
  if (o.gclid || o.gbraid || o.wbraid) return "google (sin utm)";
  if (o.ttclid) return "tiktok (sin utm)";
  if (o.fbclid) return "meta (sin utm)";
  if (o.referer) return o.referer.replace(/^www\./, "");
  return SIN_RASTRO;
}

export function campanaDe(o: Origen | null): string {
  return o?.utm_campaign ?? "—";
}

/** "2026-09-14" + 7 → "2026-09-21". Aritmética de calendario, sin husos. */
export function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** El día (YYYY-MM-DD) que es en la Ciudad de México en ese instante. */
export function diaEnZona(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

export function volvioEn7Dias(diaInicio: string, dias: string[] | null): boolean {
  const limite = sumarDias(diaInicio, DIAS_VENTANA);
  return (dias ?? []).some((d) => d > diaInicio && d <= limite);
}

export function ventanaCerrada(diaInicio: string, ahora: Date): boolean {
  return diaEnZona(ahora) > sumarDias(diaInicio, DIAS_VENTANA);
}

export function resumirAdquisicion(filas: FilaPerfilAdquisicion[], ahora: Date): ResumenOrigen[] {
  const grupos = new Map<string, ResumenOrigen>();
  for (const f of filas) {
    const o = origenDesdeDato(f.origen);
    const fuente = fuenteDe(o);
    const campana = campanaDe(o);
    // JSON y no un separador: una campaña puede traer cualquier carácter
    // permitido, y dos pares distintos no deben chocar en la misma clave.
    const clave = JSON.stringify([fuente, campana]);
    let g = grupos.get(clave);
    if (!g) {
      g = { fuente, campana, cuentas: 0, hombres: 0, mujeres: 0, primerLook: 0, ventanaCerrada: 0, volvieron: 0 };
      grupos.set(clave, g);
    }
    g.cuentas++;
    if (f.gender === "hombre") g.hombres++;
    if (f.gender === "mujer") g.mujeres++;
    if (f.onboarding_step >= 5) g.primerLook++;
    if (ventanaCerrada(f.dia_inicio, ahora)) {
      g.ventanaCerrada++;
      if (volvioEn7Dias(f.dia_inicio, f.dias)) g.volvieron++;
    }
  }
  // Lo que no tiene rastro va al final: es el fondo contra el que se lee lo demás.
  return [...grupos.values()].sort((a, b) => {
    if ((a.fuente === SIN_RASTRO) !== (b.fuente === SIN_RASTRO)) return a.fuente === SIN_RASTRO ? 1 : -1;
    return b.cuentas - a.cuentas;
  });
}
