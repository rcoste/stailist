-- Silueta para hombre: amplía los CHECK de body_build/body_volume a los valores
-- masculinos (complexión: delgado/atletico/promedio/robusto; forma:
-- pecho/parejo/panza). Mujer conserva los suyos. Aditiva (solo amplía el dominio).
alter table public.profiles drop constraint if exists profiles_body_build_check;
alter table public.profiles add constraint profiles_body_build_check
  check (body_build in (
    'delgada', 'media', 'curvas',
    'delgado', 'atletico', 'promedio', 'robusto'
  ));

alter table public.profiles drop constraint if exists profiles_body_volume_check;
alter table public.profiles add constraint profiles_body_volume_check
  check (body_volume in (
    'arriba', 'cintura', 'abajo', 'medio', 'pareja',
    'pecho', 'parejo', 'panza'
  ));
