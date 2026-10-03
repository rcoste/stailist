-- EMPEZAR SIN REGISTRARSE (2026-10-02).
--
-- Hasta hoy lo primero que la app pedía era el correo, antes de dar nada. Roberto
-- decidió mover ese muro al final del onboarding: la persona elige su estilo,
-- sus colores y sus básicos, y el correo se pide justo antes de armar el primer
-- look. El mecanismo son las sesiones anónimas de Supabase: la cuenta existe
-- desde el primer toque, sin correo, y al verificarlo se convierte en la misma
-- cuenta, con todo lo que ya contestó.
--
-- 1) El perfil puede existir sin correo. `handle_new_user` inserta (id, email)
--    y con una sesión anónima el correo es NULL: con el NOT NULL, crear la
--    cuenta fallaba ("Database error creating anonymous user").
alter table public.profiles alter column email drop not null;

-- 2) Cuando la cuenta por fin tiene correo (o lo cambia), el perfil lo copia.
--    El perfil guarda su propia copia del correo desde el día uno; sin esto se
--    quedaría en NULL para siempre y los paneles la seguirían viendo como
--    borrador.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set email = new.email
   where id = new.id
     and email is distinct from new.email;
  return new;
end;
$$;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- 3) SIN CORREO NO SE SUBE NADA. Una sesión anónima entra con el rol
--    `authenticated`, y las políticas de Storage dejan a cualquier cuenta
--    escribir en su carpeta. La app no ofrece subir nada antes del correo, pero
--    Storage se puede llamar directo con la llave pública. Políticas
--    RESTRICTIVAS: se suman con AND a las que ya existen, no abren nada.
drop policy if exists "sin correo no se sube nada" on storage.objects;
create policy "sin correo no se sube nada" on storage.objects
  as restrictive for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "sin correo no se sobrescribe nada" on storage.objects;
create policy "sin correo no se sobrescribe nada" on storage.objects
  as restrictive for update to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
