-- Importar clóset desde el carrete (multi-prenda + render).
-- Spec: docs/designs/import-carrete-multiprenda.md
-- Aditiva: columnas con default + tabla de staging. No toca datos existentes.

-- 1) Estado del render por prenda fotografiada. 'none' para todo lo que ya
--    existe (arquetipos y fotos viejas usan su display de siempre).
alter table public.items
  add column if not exists render_status text not null default 'none'
    check (render_status in ('none', 'pending', 'done', 'failed')),
  add column if not exists render_path text;

-- 2) Staging de renders rechazados por el usuario ("no es mi prenda" pero la
--    imagen es válida). El admin decide después si entran a la biblioteca
--    compartida (archetypes). Nunca se publican solos.
create table if not exists public.library_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  attrs jsonb not null default '{}'::jsonb,   -- {nombre, categoria, color, color_hex, formalidad, temporada}
  image_path text not null,                   -- render en el bucket 'prendas'
  source_kind text not null default 'rejected_render',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'discarded')),
  created_at timestamptz not null default now()
);

create index if not exists library_candidates_status_idx
  on public.library_candidates (status) where status = 'pending';

alter table public.library_candidates enable row level security;

-- El dueño puede insertar sus propios candidatos (al rechazar un render).
create policy "insert own candidates" on public.library_candidates
  for insert with check (auth.uid() = user_id);

-- Solo admins leen/gestionan la cola de aprobación.
create policy "admin reads candidates" on public.library_candidates
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );
create policy "admin updates candidates" on public.library_candidates
  for update using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );
