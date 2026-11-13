-- 0190 · LA INVITACIÓN A OPINAR (2026-11-13).
--
-- Roberto: "a los usuarios que más usan la app, la próxima vez que entren,
-- mostrarles un mensaje diciendo que son de los más activos y que nos interesa
-- su retroalimentación". Una fila por persona invitada; la invita Roberto
-- (service role, desde una consulta), nunca la app sola. La tarjeta de Inicio
-- sale mientras la fila exista sin respuesta ni "ahora no".
--
-- Las fechas cuentan el embudo de la invitación sin eventos nuevos: así no se
-- toca events_type_check, que la rama de avisos (0189, sin aplicar) también
-- redefine.

create table if not exists public.invitaciones_opinion (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  invitada_at timestamptz not null default now(),
  vista_at timestamptz,
  respondida_at timestamptz,
  descartada_at timestamptz
);

alter table public.invitaciones_opinion enable row level security;

-- La persona ve y marca SU invitación. Nadie se invita solo: sin política de
-- insert, sólo el service role crea filas.
drop policy if exists "own invitacion select" on public.invitaciones_opinion;
create policy "own invitacion select" on public.invitaciones_opinion
  for select using (auth.uid() = user_id);

drop policy if exists "own invitacion update" on public.invitaciones_opinion;
create policy "own invitacion update" on public.invitaciones_opinion
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
