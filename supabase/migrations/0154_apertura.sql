-- APERTURA AL PÚBLICO (bloque B5, decisión de Roberto 2026-09-06: total, sin lotes)
--
-- El candado de la beta cerrada era el trigger `enforce_allowlist_on_signup`
-- sobre auth.users (migración 0003): rechazaba el alta de cualquier correo que
-- no estuviera en `allowlist`, entrara por donde entrara. Con el registro
-- abierto ese trigger cae. La tabla `allowlist` y la función `enforce_allowlist`
-- se quedan: /admin/acceso sigue mandando invitaciones (un link que pre-llena
-- el correo), y borrar la función sin necesidad es riesgo gratis.
drop trigger if exists enforce_allowlist_on_signup on auth.users;

-- ─── LA LISTA DE ESPERA YA NO SE USA ────────────────────────────────────────
--
-- La landing mandaba a una waitlist porque no se podía entrar. Ahora manda al
-- login. `join_waitlist` deja de ser llamable por `anon`: era una función sin
-- límite que cualquiera podía llenar de filas. La tabla se queda como
-- histórico (44 correos que pidieron lugar y a los que ahora sí se les puede
-- avisar).
revoke execute on function public.join_waitlist(text, text) from anon;

-- ─── RITMO DEL LOGIN ────────────────────────────────────────────────────────
--
-- Con `shouldCreateUser: true`, pedir un código crea el usuario y manda un
-- correo. Abierto al público, un script contra el formulario manda miles de
-- correos desde stailist.co a quien quiera (reputación del dominio, costo de
-- Postmark) y llena auth.users de basura. El cooldown de 60 s que había vivía
-- en el cliente: no contaba.
--
-- Esta tabla registra cada petición de código (correo + IP) y `lib/ritmo-login`
-- decide con ella: 3 por correo y hora, 10 por IP y hora. Sólo la escribe el
-- servidor (withDb); ninguna sesión la ve.
create table if not exists public.login_intentos (
  id bigserial primary key,
  correo text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists login_intentos_correo_idx on public.login_intentos (correo, created_at desc);
create index if not exists login_intentos_ip_idx on public.login_intentos (ip, created_at desc);
alter table public.login_intentos enable row level security;
