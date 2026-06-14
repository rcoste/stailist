-- Try-on opcional: avatar de la usuaria (foto cuerpo completo) + cache de las
-- imágenes de try-on por outfit. Ambas viven en el bucket privado 'prendas'.
alter table public.profiles
  add column if not exists avatar_path text;

alter table public.outfits
  add column if not exists tryon_path text;
