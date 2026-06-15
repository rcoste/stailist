-- Permite a un admin escribir en cualquier carpeta del bucket privado 'prendas'
-- (avatares, fotos de prenda). Se suma a la política "own folder insert" de
-- usuario; no la reemplaza. Útil para gestionar/sembrar assets desde el admin.
create policy "prendas admin insert" on storage.objects
  for insert with check (bucket_id = 'prendas' and public.is_admin());
create policy "prendas admin update" on storage.objects
  for update using (bucket_id = 'prendas' and public.is_admin());
