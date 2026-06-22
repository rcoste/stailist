-- Selector de silueta (dos ejes): complexión + dónde carga volumen.
-- Autoselect del usuario, distinto de body_type (que deriva del avatar).
-- Spec/diseño: docs/designs (pasaporte + silueta). Aditiva, nullable.
alter table public.profiles
  add column if not exists body_build text
    check (body_build in ('delgada', 'media', 'curvas')),
  add column if not exists body_volume text
    check (body_volume in ('arriba', 'cintura', 'abajo', 'medio', 'pareja'));
