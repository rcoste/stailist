-- Invitación por correo: al agregar a alguien a la allowlist se le manda un
-- correo con un deep-link que cae en el login con su correo ya puesto. Antes
-- agregar era un INSERT mudo — nadie recibía nada y Roberto tenía que decir por
-- WhatsApp "entra a stailist.co y haz X". Ahora el correo ES esa instrucción.
--
-- invite_token: identifica al invitado en el deep-link (/login?invite=<token>).
--   NO autentica ni caduca — solo pre-llena el correo. El acceso real sigue
--   exigiendo el código de 6 dígitos que llega a ese correo (OTP fresco pedido
--   por la persona, nunca uno embebido que caduque).
-- invite_sent_at: última vez que se mandó el correo (estado "ya invitado" en
--   admin + base para el cooldown de reenvío).
alter table public.allowlist
  add column if not exists invite_token uuid,
  add column if not exists invite_sent_at timestamptz;

-- Resolver token → correo para pre-llenar el login. SECURITY DEFINER porque la
-- allowlist no es legible por anon (un invitado llega SIN sesión): esto expone
-- solo el correo de un token válido, nunca la lista. Como is_email_allowed.
create or replace function public.email_for_invite(check_token uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from public.allowlist where invite_token = check_token;
$$;
