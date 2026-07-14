-- El admin necesita LEER (firmar URLs de) archivos de otros usuarios en el bucket
-- privado 'prendas' para mostrar avatar/try-on/fotos en /admin/usuarios/[id].
-- Las tablas ya tienen lectura admin vía RLS ("cinturón y tirantes"); 0017 agregó
-- insert/update admin en storage pero faltaba el select. Esta política es el espejo.
drop policy if exists "prendas admin read" on storage.objects;
create policy "prendas admin read" on storage.objects
  for select using (bucket_id = 'prendas' and public.is_admin());
