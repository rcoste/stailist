-- Candado server-side de la beta cerrada: la pantalla de login ya filtra,
-- pero la API de Supabase Auth es pública (anon key) — sin esto, cualquiera
-- podría registrarse llamándola directo. El trigger rechaza el alta de
-- usuarios cuyo correo no esté en la allowlist, entre por donde entre.

create or replace function public.enforce_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_email_allowed(new.email) then
    raise exception 'beta cerrada: correo no invitado';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_allowlist_on_signup on auth.users;
create trigger enforce_allowlist_on_signup
  before insert on auth.users
  for each row execute function public.enforce_allowlist();
