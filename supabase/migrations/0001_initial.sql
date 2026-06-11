-- stailist — schema inicial (eng review 2026-06-10)
-- Tablas: allowlist, profiles, archetypes, items, outfits, events
-- RLS en todo: cada usuaria solo ve lo suyo. Storage privado para fotos.

-- ============ ALLOWLIST (beta cerrada) ============
create table public.allowlist (
  email text primary key,
  invited_by text,
  created_at timestamptz not null default now()
);
alter table public.allowlist enable row level security;
-- Sin policies: nadie lee/escribe la allowlist directamente desde el cliente.

-- Chequeo server-side (SECURITY DEFINER: corre con permisos del dueño,
-- así el cliente puede preguntar "¿está permitido este correo?" sin leer la tabla)
create or replace function public.is_email_allowed(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.allowlist
    where lower(email) = lower(check_email)
  );
$$;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  -- taste vector: tags estéticos derivados de los swipes (contexto de prompt, sin ML)
  taste_tags jsonb not null default '[]'::jsonb,
  -- colorimetría: estación (4 estaciones) + respuestas del quiz
  palette_season text check (palette_season in ('primavera','verano','otono','invierno')),
  palette_quiz jsonb,
  -- último objetivo declarado ("vestir diario", "oficina", "evento", "viaje", "refrescar")
  last_objective text,
  -- progreso del onboarding (cada paso se persiste; interrumpir y retomar)
  onboarding_step int not null default 0, -- 0=sin empezar … 4=checklist, 5=completo
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Crear profile automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ ARCHETYPES (catálogo canónico de básicos) ============
create table public.archetypes (
  id serial primary key,
  slug text unique not null,            -- p.ej. "camiseta-blanca"
  name text not null,                   -- "Camiseta blanca"
  category text not null,               -- top | bottom | calzado | abrigo | accesorio
  attrs jsonb not null default '{}'::jsonb, -- color, formalidad, temporada…
  image_path text,                      -- imagen generada one-off en /public/archetypes
  sort_order int not null default 0
);
alter table public.archetypes enable row level security;
create policy "archetypes readable" on public.archetypes
  for select using (auth.role() = 'authenticated');

-- ============ ITEMS (prendas del clóset) ============
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('archetype','photo')),
  archetype_id int references public.archetypes (id),
  -- atributos (de la IA con confirmación editable, o heredados del arquetipo):
  -- { tipo, color, color_hex, formalidad, temporada, notas }
  attrs jsonb not null default '{}'::jsonb,
  photo_path text,                      -- ruta en el bucket privado (si source=photo)
  created_at timestamptz not null default now(),
  deleted_at timestamptz                -- soft delete: el historial nunca se rompe
);
create index items_user_idx on public.items (user_id) where deleted_at is null;
alter table public.items enable row level security;
create policy "own items" on public.items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ OUTFITS ============
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_ids uuid[] not null,
  occasion text not null,
  weather jsonb,                        -- { temp_c, condition } o null (fallback sin clima)
  explanation text not null,            -- la justificación de una línea (voz amiga cool)
  prompt_version text not null,         -- versionado del prompt (medir mejoras)
  is_look_of_day boolean not null default false,
  look_date date,                       -- 1 look del día por fecha
  created_at timestamptz not null default now()
);
create index outfits_user_created_idx on public.outfits (user_id, created_at desc);
create unique index outfits_look_of_day_idx on public.outfits (user_id, look_date)
  where is_look_of_day;
alter table public.outfits enable row level security;
create policy "own outfits" on public.outfits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ EVENTS (votos, me-lo-puse, métricas TTV) ============
create table public.events (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  outfit_id uuid references public.outfits (id) on delete set null,
  type text not null check (type in (
    'vote_up','vote_down','worn',
    'onboarding_step','first_outfit_ttv','generation_timing','pwa_prompt_shown','pwa_installed'
  )),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_user_idx on public.events (user_id, created_at desc);
create index events_outfit_idx on public.events (outfit_id);
alter table public.events enable row level security;
create policy "own events" on public.events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Voto único por outfit+tipo (doble-tap idempotente): un upsert natural
create unique index events_unique_vote_idx on public.events (user_id, outfit_id, type)
  where type in ('vote_up','vote_down','worn');

-- ============ STORAGE (fotos de prendas — bucket PRIVADO) ============
insert into storage.buckets (id, name, public) values ('prendas', 'prendas', false)
on conflict (id) do nothing;

create policy "own folder read" on storage.objects for select
  using (bucket_id = 'prendas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder insert" on storage.objects for insert
  with check (bucket_id = 'prendas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete" on storage.objects for delete
  using (bucket_id = 'prendas' and (storage.foldername(name))[1] = auth.uid()::text);
