-- Ampliación del clóset de hombre (2026-06-13): +9 prendas, validadas por
-- Roberto, con foco en clima cálido de México (lino, short, sandalias,
-- mocasines). UPSERT por slug; sort_order 16-24 (continúa tras las 15).

insert into public.archetypes (slug, name, category, attrs, image_path, sort_order, segment) values
  ('camiseta-gris',   'Camiseta gris',       'top',     '{"color":"gris","color_hex":"#A3A09B","formalidad":"casual","temporada":"todo-el-año"}',         '/archetypes/camiseta-gris.png',   16, 'unisex'),
  ('camisa-lino',     'Camisa de lino',      'top',     '{"color":"lino claro","color_hex":"#E8E0CE","formalidad":"formal-casual","temporada":"calor"}',  '/archetypes/camisa-lino.png',     17, 'hombre'),
  ('camisa-mezclilla','Camisa de mezclilla', 'top',     '{"color":"azul mezclilla","color_hex":"#7D9BB5","formalidad":"casual","temporada":"templado"}',  '/archetypes/camisa-mezclilla.png',18, 'unisex'),
  ('short-caqui',     'Bermuda caqui',       'bottom',  '{"color":"caqui","color_hex":"#C2B391","formalidad":"casual","temporada":"calor"}',              '/archetypes/short-caqui.png',     19, 'hombre'),
  ('jeans-negros',    'Jeans negros',        'bottom',  '{"color":"negro","color_hex":"#1F1F1F","formalidad":"casual","temporada":"todo-el-año"}',         '/archetypes/jeans-negros.png',    20, 'unisex'),
  ('chinos-marino',   'Chinos azul marino',  'bottom',  '{"color":"azul marino","color_hex":"#27425F","formalidad":"formal-casual","temporada":"todo-el-año"}', '/archetypes/chinos-marino.png', 21, 'hombre'),
  ('mocasines-cafe',  'Mocasines café',      'calzado', '{"color":"café","color_hex":"#6B4A33","formalidad":"formal-casual","temporada":"todo-el-año"}',   '/archetypes/mocasines-cafe.png',  22, 'hombre'),
  ('sandalias-cuero', 'Sandalias de cuero',  'calzado', '{"color":"café","color_hex":"#8B6B4A","formalidad":"casual","temporada":"calor"}',                '/archetypes/sandalias-cuero.png', 23, 'hombre'),
  ('bomber',          'Chamarra bomber',     'abrigo',  '{"color":"negro","color_hex":"#2A2A2A","formalidad":"casual","temporada":"templado"}',            '/archetypes/bomber.png',          24, 'unisex')
on conflict (slug) do update set
  name        = excluded.name,
  category    = excluded.category,
  attrs       = excluded.attrs,
  image_path  = excluded.image_path,
  sort_order  = excluded.sort_order,
  segment     = excluded.segment;
