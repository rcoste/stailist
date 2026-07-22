-- Blindaje del consentimiento de menores (review pre-landing del PR de edad).
-- El candado estaba solo en los endpoints; estas 4 piezas lo ponen en la DB:
--
-- 1) Índice ÚNICO parcial del token: sirve el lookup del endpoint público
--    /api/permiso (antes seq scan) y garantiza 1 token = 1 perfil.
-- 2) CHECK del rango de edad: el set válido vivía solo en lib/edad.ts; ahora
--    ningún write path (scripts, backfills) puede guardar texto arbitrario.
-- 3) Trigger guardián: las columnas de edad/consentimiento SOLO se escriben
--    desde el server (withDb / /api/permiso, conexiones directas sin JWT →
--    auth.uid() null). Un cliente autenticado (PostgREST con la sesión del
--    usuario) que intente tocarlas — p. ej. un menor auto-confirmándose el
--    permiso o re-declarándose adulto — recibe excepción.
-- 4) Política RESTRICTIVE de storage: un menor sin permiso confirmado no puede
--    subir NADA al bucket privado 'prendas' ni directo con supabase-js — el
--    bloqueo deja de depender de que los endpoints de análisis sean el único
--    camino. (Efecto colateral aceptado: tampoco puede generar renders
--    on-demand hasta que el tutor confirme.)

-- 0. Cooldown del correo al tutor: cuándo se envió el último. El server exige
--    >=10 min entre reenvíos (anti spam a terceros / reputación del dominio).
alter table public.profiles
  add column if not exists minor_consent_last_sent_at timestamptz;

-- 1. Índice único del token
create unique index if not exists profiles_minor_consent_token_key
  on public.profiles (minor_consent_token)
  where minor_consent_token is not null;

-- 2. CHECK del rango de edad
alter table public.profiles drop constraint if exists profiles_age_range_check;
alter table public.profiles add constraint profiles_age_range_check
  check (age_range is null or age_range in ('13-17','18-24','25-34','35-44','45-54','55+'));

-- 3. Trigger guardián de columnas de consentimiento
create or replace function public.guard_minor_consent_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() no-null = petición PostgREST con sesión de usuario (cliente).
  -- Conexiones directas del server (DATABASE_URL) no traen JWT → uid null.
  if auth.uid() is null then
    return new;
  end if;
  if TG_OP = 'INSERT' then
    -- La policy "own profile insert" existe: un insert del cliente no debe
    -- poder nacer con estado de consentimiento pre-cargado.
    if new.age_range is not null
      or new.minor_ack_at is not null
      or new.minor_parent_email is not null
      or new.minor_consent_token is not null
      or new.minor_consent_verified_at is not null
    then
      raise exception 'consent_cols_server_only';
    end if;
  elsif (
    new.age_range is distinct from old.age_range
    or new.minor_ack_at is distinct from old.minor_ack_at
    or new.minor_parent_email is distinct from old.minor_parent_email
    or new.minor_consent_token is distinct from old.minor_consent_token
    or new.minor_consent_verified_at is distinct from old.minor_consent_verified_at
  ) then
    raise exception 'consent_cols_server_only';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_minor_cols on public.profiles;
create trigger profiles_guard_minor_cols
  before insert or update on public.profiles
  for each row execute function public.guard_minor_consent_cols();

-- 4. Storage: menor sin permiso confirmado no sube al bucket 'prendas'.
--    RESTRICTIVE: se AND-ea con las políticas permisivas existentes.
drop policy if exists "menores sin permiso no suben fotos" on storage.objects;
create policy "menores sin permiso no suben fotos"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (
    bucket_id <> 'prendas'
    or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.age_range = '13-17'
        and p.minor_consent_verified_at is null
    )
  );

-- Gemela para UPDATE (los upserts de avatar/try-on pisan objetos existentes
-- por la vía update; hoy inalcanzable para un menor sin permiso, pero la
-- simetría evita que un flujo futuro se cuele por ahí).
drop policy if exists "menores sin permiso no actualizan fotos" on storage.objects;
create policy "menores sin permiso no actualizan fotos"
  on storage.objects
  as restrictive
  for update
  to authenticated
  using (
    bucket_id <> 'prendas'
    or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.age_range = '13-17'
        and p.minor_consent_verified_at is null
    )
  );
