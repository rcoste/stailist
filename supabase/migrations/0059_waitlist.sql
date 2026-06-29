-- Waitlist de la beta cerrada: la landing pública captura correos de gente que
-- AÚN NO está invitada (lo opuesto a la allowlist). Mismo patrón de privacidad
-- que la allowlist: tabla con RLS y sin policies de cliente, más una función
-- SECURITY DEFINER que el anónimo puede llamar para anotarse, pero nunca leer
-- la lista. No dispara OTP ni crea usuario — solo guarda el correo.

create table public.waitlist (
  email text primary key,
  source text,                 -- de dónde llegó (p.ej. "landing-hero", "landing-cta")
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
-- Sin policies: nadie lee/escribe la waitlist directamente desde el cliente.

-- Alta idempotenete desde la landing (anon). SECURITY DEFINER para poder
-- insertar sin exponer la tabla; on conflict do nothing → re-anotarse no truena.
create or replace function public.join_waitlist(
  signup_email text,
  signup_source text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.waitlist (email, source)
  values (lower(trim(signup_email)), signup_source)
  on conflict (email) do nothing;
end;
$$;
