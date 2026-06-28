-- Fix: el guardado del avatar truena al REGENERARLO.
--
-- El avatar vive en una ruta fija `{userId}/avatar.jpg` y se sube con
-- upload({upsert:true}). La primera vez es INSERT (permitido por "own folder
-- insert"); al regenerar, el upsert sobre el archivo existente es UPDATE, y el
-- bucket privado 'prendas' tenía políticas de carpeta propia para INSERT/SELECT/
-- DELETE pero NO para UPDATE → la RLS lo rechaza con
-- "new row violates row-level security policy" y el wizard muestra error.
--
-- Reproducido como usuario no-admin: 1ra subida OK, 2da (overwrite) falla.
-- Esta política permite a cada usuario sobreescribir SOLO archivos de su propia
-- carpeta en 'prendas' (mismo alcance que las otras políticas own-folder).
create policy "own folder update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'prendas'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'prendas'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
