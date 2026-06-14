-- Colorimetría no binaria: además de la estación base (palette_season), una
-- estación "flow" opcional para casos frontera (ej. otoño de base con tonos
-- profundos de invierno que también favorecen). NULL = caso claro, sin flow.
alter table public.profiles
  add column if not exists palette_flow text;
