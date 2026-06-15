-- Bucket público para imágenes de básicos REGENERADAS desde el admin. Las 45
-- originales siguen en public/ del repo; las que el admin edite aterrizan aquí
-- y archetypes.image_path guarda la URL pública. El consumidor lee image_path
-- igual, venga de public/ o de Storage.
insert into storage.buckets (id, name, public)
values ('archetypes', 'archetypes', true)
on conflict (id) do nothing;

-- Lectura pública (bucket público) + escritura solo admin.
create policy "archetypes public read" on storage.objects
  for select using (bucket_id = 'archetypes');
create policy "archetypes admin insert" on storage.objects
  for insert with check (bucket_id = 'archetypes' and public.is_admin());
create policy "archetypes admin update" on storage.objects
  for update using (bucket_id = 'archetypes' and public.is_admin());
