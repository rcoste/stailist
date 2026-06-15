-- Chelsea boots estilo Meermin. botines-chelsea (café) y botines-chelsea-negros
-- (negro) solo se regeneró su imagen (la negra anterior se veía horrible) —
-- misma fila. Aquí solo se agrega el color nuevo: café gamuza (superbuck).
-- Biblioteca (onboarding_subset=false). Idempotente.

insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('botines-chelsea-ante', 'Botines Chelsea de gamuza', 'calzado', 'hombre', '{"color":"café gamuza","color_hex":"#6B4A33","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/botines-chelsea-ante.png', 98, false)
on conflict (slug) do nothing;
