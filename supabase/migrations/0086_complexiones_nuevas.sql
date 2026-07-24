-- +2 complexiones por género (mujer 3→5, hombre 4→6). El CHECK de body_build
-- enumeraba los 7 valores viejos: sin esto, guardar una complexión nueva
-- revienta con violación de constraint.
--
-- Mujer:  delgada · ATLETICA · media · curvas · GRANDE
-- Hombre: delgado · atletico · MUSCULOSO · promedio · robusto · CORPULENTO
--
-- Aditivo: los valores viejos siguen siendo válidos, no se toca ningún dato.
alter table public.profiles drop constraint if exists profiles_body_build_check;

alter table public.profiles add constraint profiles_body_build_check
  check (body_build = any (array[
    -- mujer
    'delgada'::text, 'atletica'::text, 'media'::text, 'curvas'::text, 'grande'::text,
    -- hombre
    'delgado'::text, 'atletico'::text, 'musculoso'::text, 'promedio'::text,
    'robusto'::text, 'corpulento'::text
  ]));
