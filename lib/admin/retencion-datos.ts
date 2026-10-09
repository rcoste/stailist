import { withDb } from "@/lib/db";
import { origenDesdeDato } from "@/lib/origen";
import { EVENTOS_QUE_NO_SON_VOLVER, MINIMO_PARA_VOLVER, ZONA, campanaDe, diaEnZona } from "@/lib/admin/adquisicion";
import type { PersonaRetencion } from "@/lib/admin/retencion";

// Los datos de la tabla de retención (lib/admin/retencion.ts). Postgres directo,
// como el embudo y adquisición: son eventos, prendas y looks de todas las
// cuentas, muy por encima de las 1000 filas que corta PostgREST.
//
// Los días se calculan aquí con el criterio del plan: el día de la Ciudad de
// México de cada rastro menos el del inicio, y del día 1 en adelante sólo los
// rastros de al menos MINIMO_PARA_VOLVER después de empezar. Las
// interpolaciones son constantes de adquisicion.ts; lo variable va en $1/$2.
const SQL_RETENCION = `
with base as (
  select p.id, p.email, p.pais, p.origen, coalesce(p.is_admin, false) as is_admin,
    (select min(e.created_at) from public.events e
      where e.user_id = p.id and e.type = 'onboarding_started') as inicio
  from public.profiles p
),
rastro as (
  select e.user_id, e.created_at as at from public.events e where e.type <> all($2::text[])
  union all select i.user_id, i.created_at from public.items i
  union all select o.user_id, o.created_at from public.outfits o
)
select b.id, b.email, b.pais, b.origen,
  to_char((b.inicio at time zone '${ZONA}')::date, 'YYYY-MM-DD') as dia_inicio,
  coalesce(
    array_agg(distinct ((r.at at time zone '${ZONA}')::date - (b.inicio at time zone '${ZONA}')::date))
      filter (where r.at >= b.inicio + interval '${MINIMO_PARA_VOLVER}'
                and (r.at at time zone '${ZONA}')::date > (b.inicio at time zone '${ZONA}')::date),
    '{}'
  ) as dias
from base b
left join rastro r on r.user_id = b.id
where b.inicio >= $1::timestamptz
  and not b.is_admin
  and coalesce(b.email, '') not like '%@stailist.app'
group by b.id, b.email, b.pais, b.origen, b.inicio
order by b.inicio desc
`;

export type PersonaRetencionConOrigen = PersonaRetencion & { campana: string; pais: string | null };

/** Hoy en la Ciudad de México y el inicio del periodo (hace `dias` días). */
export function periodo(dias: number, ahora: Date = new Date()): { hoy: string; desde: Date } {
  return { hoy: diaEnZona(ahora), desde: new Date(ahora.getTime() - dias * 86_400_000) };
}

export async function cargarRetencion(desde: Date): Promise<PersonaRetencionConOrigen[]> {
  const filas = await withDb(
    async (c) => (await c.query(SQL_RETENCION, [desde.toISOString(), EVENTOS_QUE_NO_SON_VOLVER])).rows
  );
  return filas.map((f) => ({
    id: f.id as string,
    etiqueta: (f.email as string | null) ?? `borrador ${String(f.id).slice(0, 8)}`,
    diaInicio: f.dia_inicio as string,
    dias: (f.dias as number[]).map(Number).sort((a, b) => a - b),
    campana: campanaDe(origenDesdeDato(f.origen)),
    pais: (f.pais as string | null) ?? null,
  }));
}
