-- Correo semanal "tu stylist te espera" — opt-in explícito (nadie recibe nada
-- sin pedirlo: default 'off'). El opt-in se ofrece tras "me lo puse".
alter table public.profiles
  add column if not exists email_semanal text not null default 'off'
    check (email_semanal in ('off', 'semanal')),
  -- Token para baja de un clic sin login (link en cada correo).
  add column if not exists email_unsub_token uuid not null default gen_random_uuid(),
  -- Anti-duplicado: el cron no reenvía si ya mandó esta semana.
  add column if not exists email_semanal_last_sent timestamptz;

create unique index if not exists profiles_email_unsub_token_idx
  on public.profiles (email_unsub_token);
