-- INVITAR A UN VIAJE (2026-10-16). Quien ya armó su viaje manda un link; la
-- otra persona entra con la ruta, las fechas y las actividades ya puestas y
-- arma SU maleta con SU ropa. No es un viaje compartido: cada quien tiene su
-- fila en trips y su maleta; lo único que viaja en el link es la ruta.
--
-- invitacion:  el token del link (/v/<token>), se crea la primera vez que el
--              dueño toca "invitar". Inadivinable; sin él no se ve nada.
-- invitado_de: en el viaje de quien llegó por el link, el viaje de origen.
--              Sirve para contar "N personas ya armaron su maleta".
alter table public.trips add column if not exists invitacion text unique;
alter table public.trips add column if not exists invitado_de uuid references public.trips(id) on delete set null;
create index if not exists trips_invitado_de_idx on public.trips (invitado_de) where invitado_de is not null;

-- Lo que ve quien abre el link, con o sin cuenta: ruta, fechas, actividades.
-- NUNCA la maleta, los looks, el texto libre (contexto) ni quién es el dueño.
create or replace function public.viaje_por_invitacion(p_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'lugar', t.lugar,
    'paradas', coalesce((
      select jsonb_agg(jsonb_build_object('lugar', p->>'lugar', 'noches', p->'noches', 'weather', p->'weather'))
      from jsonb_array_elements(case when jsonb_typeof(t.paradas) = 'array' then t.paradas else '[]'::jsonb end) p
    ), '[]'::jsonb),
    'fecha_inicio', t.fecha_inicio,
    'fecha_fin', t.fecha_fin,
    'ocasiones', t.ocasiones
  )
  from public.trips t
  where t.invitacion = p_token and t.deleted_at is null
  limit 1
$$;
revoke all on function public.viaje_por_invitacion(text) from public;
grant execute on function public.viaje_por_invitacion(text) to anon, authenticated;

-- El id del viaje de origen, sólo para quien ya tiene sesión (al crear su
-- propio viaje desde el link). El anónimo no lo necesita.
create or replace function public.viaje_id_por_invitacion(p_token text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select t.id from public.trips t where t.invitacion = p_token and t.deleted_at is null limit 1
$$;
-- OJO: en Supabase las funciones nuevas traen EXECUTE para anon por default;
-- "from public" no lo quita, hay que quitárselo a anon por nombre.
revoke all on function public.viaje_id_por_invitacion(text) from public, anon;
grant execute on function public.viaje_id_por_invitacion(text) to authenticated;

-- Cuántas personas (distintas del dueño) ya armaron su maleta desde un viaje.
-- Sólo responde al dueño del viaje: a cualquier otro le da 0.
create or replace function public.unidos_a_mi_viaje(p_trip uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(distinct t.user_id)::int
  from public.trips t
  join public.trips o on o.id = t.invitado_de
  where t.invitado_de = p_trip
    and o.user_id = auth.uid()
    and t.user_id <> o.user_id
    and t.deleted_at is null
$$;
revoke all on function public.unidos_a_mi_viaje(uuid) from public, anon;
grant execute on function public.unidos_a_mi_viaje(uuid) to authenticated;
