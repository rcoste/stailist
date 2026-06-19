-- Modo viaje (v1): una cápsula temporal por viaje, seleccionada contra tu clóset
-- real. Reusa el motor de cápsula (capsule_target + matchCapsule): genera la
-- cápsula ideal del viaje (dimensionada a días × ocasiones × clima, con techo de
-- maleta) y la cruza con el clóset → "empaca esto" + "te falta". Un renglón por
-- viaje (historial).

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lugar text not null,
  lat double precision,
  lon double precision,
  fecha_inicio date not null,
  fecha_fin date not null,
  ocasiones jsonb not null default '[]'::jsonb,   -- toggles: playa/ciudad/trabajo/noche
  maleta text,                                     -- 'mochila' | 'mano' | 'documentada'
  weather jsonb,                                   -- clima resuelto {temp_c, condition} o null
  capsule_target jsonb,                            -- cápsula ideal del viaje (CapsuleTarget)
  capsule_match jsonb,                             -- match contra clóset (CapsuleMatch)
  overrides jsonb,                                 -- decisiones parecido (CapsuleOverrides)
  empacado jsonb not null default '{}'::jsonb,     -- checklist "lo empaqué" por índice
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;
create policy "own trips" on public.trips for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index trips_user_idx on public.trips (user_id, created_at desc);
