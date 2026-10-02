-- LA BIBLIOTECA COMPARTIDA DE IMÁGENES SÓLO LA ESCRIBE EL SERVIDOR (2026-10-01).
--
-- Los depósitos públicos `catalog` y `destinos` y sus tablas guardan imágenes
-- que ven TODAS las personas. Estas políticas dejaban a cualquier cuenta subir
-- archivos, sobrescribir la foto de un destino y registrar o editar filas
-- (asesor de seguridad de Supabase, alerta 0024 "RLS Policy Always True").
--
-- Desde v0.2.344.0 esas escrituras las hace lib/supabase/biblioteca-compartida.ts
-- con la llave de servicio, que no necesita política. Aquí se quitan los
-- permisos de `authenticated`. Las políticas de LECTURA se quedan: la app lee
-- con la sesión de cada persona.
--
-- ORDEN: aplicar DESPUÉS de que v0.2.344.0 esté en producción. Antes, la app
-- vieja dejaría de poder guardar renders de cápsula y fotos de destino.
drop policy if exists "catalog_renders insert" on public.catalog_renders;
drop policy if exists "destino_imagenes insert" on public.destino_imagenes;
drop policy if exists "destino_imagenes update" on public.destino_imagenes;
drop policy if exists "catalog auth insert" on storage.objects;
drop policy if exists "destinos auth insert" on storage.objects;
drop policy if exists "destinos auth update" on storage.objects;
