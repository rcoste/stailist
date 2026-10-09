import { withDb } from "@/lib/db";
import { origenDesdeDato } from "@/lib/origen";
import {
  DIAS_VENTANA,
  EVENTOS_QUE_NO_SON_VOLVER,
  MINIMO_PARA_VOLVER,
  ZONA,
  campanaDe,
  fuenteDe,
} from "@/lib/admin/adquisicion";
import type { PersonaEmbudo } from "@/lib/admin/embudo";

// Los datos del embudo por pasos (lib/admin/embudo.ts). Postgres directo y no
// Supabase JS por lo mismo que la pantalla de adquisición: son eventos de todas
// las cuentas y PostgREST corta en 1000 filas sin avisar.
//
// "Volvió" se calcula aquí con el MISMO criterio que SQL_ADQUISICION (otro día
// de la Ciudad de México, al menos MINIMO_PARA_VOLVER después de empezar, dentro
// de DIAS_VENTANA, contando eventos y prendas). Las interpolaciones son sólo
// constantes; la fecha y la lista de eventos viajan como parámetros.
const SQL_EMBUDO = `
with base as (
  select p.id, p.email, p.pais, p.origen, coalesce(p.is_admin, false) as is_admin,
    (select min(e.created_at) from public.events e
      where e.user_id = p.id and e.type = 'onboarding_started') as inicio
  from public.profiles p
)
select b.id, b.email, b.pais, b.origen, b.inicio,
  coalesce((select json_agg(json_build_object('type', e.type, 'data', e.data, 'at', e.created_at)
              order by e.created_at)
            from public.events e
           where e.user_id = b.id
             and e.type in ('onboarding_started', 'onboarding_step', 'first_outfit_ttv')), '[]'::json) as eventos,
  (select min(i.created_at) from public.items i where i.user_id = b.id and i.source = 'photo') as primera_foto,
  (select min(x.at) from (
      select e.created_at as at from public.events e
       where e.user_id = b.id and e.type <> all($2::text[])
      union all
      select i.created_at from public.items i where i.user_id = b.id
    ) x
    where x.at >= b.inicio + interval '${MINIMO_PARA_VOLVER}'
      and x.at < b.inicio + interval '${DIAS_VENTANA + 1} days'
      and (x.at at time zone '${ZONA}')::date > (b.inicio at time zone '${ZONA}')::date) as volvio,
  greatest(
    (select max(e.created_at) from public.events e where e.user_id = b.id),
    (select max(i.created_at) from public.items i where i.user_id = b.id),
    b.inicio
  ) as ultima
from base b
where b.inicio >= $1::timestamptz
  and not b.is_admin
  and coalesce(b.email, '') not like '%@stailist.app'
`;

export type PersonaConOrigen = PersonaEmbudo & { campana: string; fuente: string; pais: string | null };

/** Todo instante a ISO con Z: el JSON trae "+00:00" y pg trae Date, y se comparan como texto. */
const iso = (x: unknown): string | null => (x == null ? null : new Date(x as string).toISOString());

/** El inicio del periodo: hace `dias` días desde ahora. */
export function desdeHace(dias: number, ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - dias * 86_400_000);
}

export async function cargarEmbudo(desde: Date): Promise<PersonaConOrigen[]> {
  const filas = await withDb(
    async (c) => (await c.query(SQL_EMBUDO, [desde.toISOString(), EVENTOS_QUE_NO_SON_VOLVER])).rows
  );
  return filas.map((f) => {
    const o = origenDesdeDato(f.origen);
    const eventos = (f.eventos as { type: string; data: Record<string, unknown> | null; at: string }[]).map(
      (e) => ({ type: e.type, data: e.data, at: iso(e.at) as string })
    );
    return {
      id: f.id as string,
      etiqueta: (f.email as string | null) ?? `borrador ${String(f.id).slice(0, 8)}`,
      eventos,
      primeraFoto: iso(f.primera_foto),
      volvio: iso(f.volvio),
      ultimaActividad: iso(f.ultima) as string,
      campana: campanaDe(o),
      fuente: fuenteDe(o),
      pais: (f.pais as string | null) ?? null,
    };
  });
}

/** Visitantes distintos de la landing en el periodo, por campaña (lib/embudo-marcas.ts). */
export async function visitasLanding(desdeDia: string): Promise<{ campana: string; n: number }[]> {
  const r = await withDb(
    async (c) =>
      (
        await c.query(
          `select campana, count(distinct sujeto)::int as n
             from public.embudo_marcas
            where paso = 'landing' and dia >= $1::date
            group by 1`,
          [desdeDia]
        )
      ).rows
  );
  return r as { campana: string; n: number }[];
}
