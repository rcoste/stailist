import { withDb } from "@/lib/db";
import {
  DIAS_VENTANA,
  EVENTOS_QUE_NO_SON_VOLVER,
  SQL_ADQUISICION,
  diaEnZona,
  sumarDias,
  ZONA,
  type FilaPerfilAdquisicion,
} from "@/lib/admin/adquisicion";
import { origenDesdeDato } from "@/lib/origen";
import {
  criterioDeParo,
  esDeCampana,
  resumirCampana,
  type DatosCorreoDiario,
  type EstadoParo,
  type ExtraCuenta,
  type FilaCodigos,
  type FilaGasto,
  type ResumenCampana,
} from "@/lib/admin/campana";

// LA CARGA DE LA CAMPAÑA: la usan la pantalla (/admin/campana) y el correo
// diario (/api/cron/campana), para que los dos cuenten EXACTAMENTE lo mismo.
// Postgres directo por la misma razón que adquisición: son agregaciones sobre
// toda la app, que PostgREST cortaría en 1000 filas sin avisar. Quien llama
// tiene que haber exigido admin (la pantalla) o el secreto del cron.

/** Lo de cada cuenta que adquisición no trae. Una fila por cuenta. */
const SQL_EXTRAS = `
select p.id,
  p.age_range,
  (select min((e.data->>'seconds')::numeric)::int from public.events e
     where e.user_id = p.id and e.type = 'first_outfit_ttv') as ttv_s,
  exists (select 1 from public.events e where e.user_id = p.id and e.type = 'worn') as se_lo_puso,
  coalesce((select sum(a.costo_usd) from public.ai_calls a
     where a.user_id = p.id
       and a.created_at >= coalesce(p.onboarding_started_at, p.created_at)
       and a.created_at < coalesce(p.onboarding_started_at, p.created_at) + interval '${DIAS_VENTANA} days'), 0)::float as ia_usd_7d
from public.profiles p
where p.id = any ($1::uuid[])
`;

/** El primer día con gasto capturado, o hace 30 días si todavía no hay. */
export async function desdePorDefecto(ahora: Date = new Date()): Promise<string> {
  const r = await withDb((c) =>
    c.query<{ dia: string | null }>(`select to_char(min(dia), 'YYYY-MM-DD') as dia from public.campana_gasto`)
  );
  return r.rows[0]?.dia ?? sumarDias(diaEnZona(ahora), -30);
}

export type DatosCampana = {
  desde: string;
  filas: FilaPerfilAdquisicion[];
  resumen: ResumenCampana[];
  paro: EstadoParo;
  gasto: FilaGasto[];
  campanasConocidas: string[];
};

export async function cargarCampana(desde: string, ahora: Date = new Date()): Promise<DatosCampana> {
  const crudas = await withDb(async (c) => (await c.query(SQL_ADQUISICION, [EVENTOS_QUE_NO_SON_VOLVER])).rows);
  const todas: FilaPerfilAdquisicion[] = crudas.map((r) => ({
    id: r.id,
    email: r.email,
    gender: r.gender,
    onboarding_step: Number(r.onboarding_step ?? 0),
    inicio: new Date(r.inicio).toISOString(),
    dia_inicio: r.dia_inicio,
    dias: r.dias,
    origen: r.origen,
    como_nos_conocio: r.como_nos_conocio ?? null,
  }));
  const filas = todas.filter((f) => f.dia_inicio >= desde);

  // En serie y no con Promise.all: una conexión de pg corre una consulta a la
  // vez, y encimarlas está deprecado (pg@9 lo quita).
  const [extrasRows, codigos, gasto] = await withDb(async (c) => {
    const extras = (await c.query(SQL_EXTRAS, [filas.map((f) => f.id)])).rows;
    const cods = (
      await c.query(
        `select to_char(dia, 'YYYY-MM-DD') as dia, fuente, campana, nuevos, recurrentes
           from public.campana_codigos where dia >= $1::date`,
        [desde]
      )
    ).rows as FilaCodigos[];
    const gas = (
      await c.query(
        `select to_char(dia, 'YYYY-MM-DD') as dia, campana, clics, costo_mxn::float as costo_mxn,
                registros_google, nota
           from public.campana_gasto where dia >= $1::date order by dia desc, campana`,
        [desde]
      )
    ).rows as FilaGasto[];
    return [extras, cods, gas] as const;
  });

  const extras = new Map<string, ExtraCuenta>(
    extrasRows.map((r) => [
      r.id as string,
      {
        age_range: r.age_range ?? null,
        ttv_s: r.ttv_s == null ? null : Number(r.ttv_s),
        se_lo_puso: !!r.se_lo_puso,
        ia_usd_7d: Number(r.ia_usd_7d ?? 0),
      },
    ])
  );

  const campanasConocidas = [
    ...new Set([
      ...gasto.map((g) => g.campana),
      ...filas.map((f) => origenDesdeDato(f.origen)?.utm_campaign).filter((x): x is string => !!x),
      ...codigos.map((c) => c.campana).filter((x) => x !== "—"),
    ]),
  ].sort();

  return {
    desde,
    filas,
    resumen: resumirCampana({ filas, extras, codigos, gasto, ahora }),
    // El criterio mira TODAS las cuentas de campaña, no sólo las de la ventana
    // elegida en pantalla: las primeras 30 son las primeras 30.
    paro: criterioDeParo(todas, ahora),
    gasto,
    campanasConocidas,
  };
}

/** Lo que el correo diario agrega sobre la carga: el día de ayer y el gasto de IA. */
export async function datosCorreoDiario(ahora: Date = new Date()): Promise<DatosCorreoDiario> {
  const hoy = diaEnZona(ahora);
  const ayer = sumarDias(hoy, -1);
  const desde = await desdePorDefecto(ahora);
  const d = await cargarCampana(desde, ahora);

  const ia = await withDb(async (c) => {
    const rango = `(created_at at time zone '${ZONA}')::date = $1::date`;
    const tot = (
      await c.query<{ usd: number; llamadas: number }>(
        `select coalesce(sum(costo_usd), 0)::float as usd, count(*)::int as llamadas
           from public.ai_calls where ${rango}`,
        [ayer]
      )
    ).rows[0];
    const top =
      (
        await c.query<{ correo: string; usd: number }>(
          `select coalesce(u.email, a.user_id::text) as correo, sum(a.costo_usd)::float as usd
             from public.ai_calls a left join auth.users u on u.id = a.user_id
            where (a.created_at at time zone '${ZONA}')::date = $1::date and a.user_id is not null
            group by 1 order by 2 desc limit 1`,
          [ayer]
        )
      ).rows[0] ?? null;
    return { tot, top };
  });

  const deAyer = d.filas.filter((f) => f.dia_inicio === ayer);
  return {
    ayer,
    iaAyerUsd: Number(ia.tot?.usd ?? 0),
    iaAyerLlamadas: Number(ia.tot?.llamadas ?? 0),
    iaTop: ia.top ? { correo: ia.top.correo, usd: Number(ia.top.usd) } : null,
    nuevasAyer: deAyer.length,
    nuevasAyerDeCampana: deAyer.filter((f) => esDeCampana(origenDesdeDato(f.origen))).length,
    primerLookAyer: deAyer.filter((f) => f.onboarding_step >= 5).length,
    campanas: d.resumen,
    paro: d.paro,
    desde,
  };
}
