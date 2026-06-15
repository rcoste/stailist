-- Admin: Roberto puede ver datos de TODAS las usuarias y curar el catálogo.
-- Sin "llave maestra" (service role) en la app: el control vive en la base con
-- políticas RLS que solo aplican a admins. Defense-in-depth — aunque el gate de
-- la app fallara, la base solo deja leer a admins.

-- 1. Marca de admin en el perfil.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2. Helper. SECURITY DEFINER + search_path fijo para evitar recursión de RLS
-- (corre como owner, no re-evalúa las políticas de profiles al consultarse).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- 3. Políticas de admin (permisivas → se SUMAN con OR a las de usuario; no las
-- reemplazan). El admin solo LEE datos de usuaria; no los edita.
create policy "admin reads profiles" on public.profiles
  for select using (public.is_admin());
create policy "admin reads items" on public.items
  for select using (public.is_admin());
create policy "admin reads outfits" on public.outfits
  for select using (public.is_admin());
create policy "admin reads events" on public.events
  for select using (public.is_admin());

-- 4. Catálogo: el admin puede editar básicos (attrs + image_path).
create policy "admin updates archetypes" on public.archetypes
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin inserts archetypes" on public.archetypes
  for insert with check (public.is_admin());

-- 5. Allowlist: gestionar invitados desde el admin (hoy no tiene políticas).
create policy "admin reads allowlist" on public.allowlist
  for select using (public.is_admin());
create policy "admin inserts allowlist" on public.allowlist
  for insert with check (public.is_admin());
create policy "admin deletes allowlist" on public.allowlist
  for delete using (public.is_admin());

-- 6. Roberto es el admin.
update public.profiles set is_admin = true where email = 'roberto@kublau.com';
