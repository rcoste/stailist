-- 0067 · Blinda la categoría del catálogo (archetypes.category) al set canónico,
-- ahora incluyendo "saco" (sacos/blazers/trajes, separado de "abrigo"). Los items
-- del usuario guardan la categoría en attrs.categoria (JSON) y se validan en el
-- enum del análisis de IA, por eso el CHECK vive solo en la columna de archetypes.
alter table public.archetypes
  add constraint archetypes_category_check
  check (category in ('top', 'saco', 'bottom', 'calzado', 'abrigo', 'vestido', 'accesorio'));
