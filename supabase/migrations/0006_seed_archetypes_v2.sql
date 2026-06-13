-- Re-seed del catálogo: lista HOMBRE validada por Roberto (2026-06-13) + estilo
-- A de imágenes. UPSERT por slug para no romper items/outfits ya creados que
-- referencian archetype_id. image_path apunta a /archetypes/<slug>.png (public).
--
-- Segmentos:
--   unisex (10): las comparten hombre y mujer
--   hombre (5):  camisa azul claro, polo, hoodie, chinos, zapato café
--   mujer  (3):  abrigo camel, vestido negro, zapato formal negro → ocultos
--                de la lista de hombre (se reusan/ajustan al armar lista mujer)

insert into public.archetypes (slug, name, category, attrs, image_path, sort_order, segment) values
  ('camiseta-blanca',    'Camiseta blanca',     'top',     '{"color":"blanco","color_hex":"#F5F5F0","formalidad":"casual","temporada":"todo-el-año"}',        '/archetypes/camiseta-blanca.png',    1,  'unisex'),
  ('camiseta-negra',     'Camiseta negra',      'top',     '{"color":"negro","color_hex":"#1A1A1A","formalidad":"casual","temporada":"todo-el-año"}',         '/archetypes/camiseta-negra.png',     2,  'unisex'),
  ('camisa-blanca',      'Camisa blanca',       'top',     '{"color":"blanco","color_hex":"#FAFAF7","formalidad":"formal-casual","temporada":"todo-el-año"}',  '/archetypes/camisa-blanca.png',      3,  'unisex'),
  ('camisa-azul-claro',  'Camisa azul claro',   'top',     '{"color":"azul claro","color_hex":"#AEC6E8","formalidad":"formal-casual","temporada":"todo-el-año"}', '/archetypes/camisa-azul-claro.png', 4,  'hombre'),
  ('polo-marino',        'Polo marino',         'top',     '{"color":"azul marino","color_hex":"#27425F","formalidad":"casual","temporada":"templado"}',      '/archetypes/polo-marino.png',        5,  'hombre'),
  ('sueter-gris',        'Suéter gris',         'top',     '{"color":"gris","color_hex":"#8A8784","formalidad":"casual","temporada":"frio"}',                 '/archetypes/sueter-gris.png',        6,  'unisex'),
  ('hoodie-gris',        'Hoodie gris',         'top',     '{"color":"gris","color_hex":"#9B9894","formalidad":"casual","temporada":"templado"}',             '/archetypes/hoodie-gris.png',        7,  'hombre'),
  ('blazer-azul-marino', 'Blazer marino',       'abrigo',  '{"color":"azul marino","color_hex":"#27425F","formalidad":"formal","temporada":"todo-el-año"}',    '/archetypes/blazer-azul-marino.png', 8,  'unisex'),
  ('chamarra-mezclilla', 'Chamarra de mezclilla','abrigo', '{"color":"azul mezclilla","color_hex":"#4A6B8A","formalidad":"casual","temporada":"templado"}',   '/archetypes/chamarra-mezclilla.png', 9,  'unisex'),
  ('jeans-azul-oscuro',  'Jeans azul oscuro',   'bottom',  '{"color":"azul oscuro","color_hex":"#2C3E50","formalidad":"casual","temporada":"todo-el-año"}',    '/archetypes/jeans-azul-oscuro.png',  10, 'unisex'),
  ('pantalon-negro',     'Pantalón negro',      'bottom',  '{"color":"negro","color_hex":"#1A1A1A","formalidad":"formal-casual","temporada":"todo-el-año"}',   '/archetypes/pantalon-negro.png',     11, 'unisex'),
  ('chinos-beige',       'Chinos beige',        'bottom',  '{"color":"beige","color_hex":"#C8B89A","formalidad":"casual","temporada":"todo-el-año"}',          '/archetypes/chinos-beige.png',       12, 'hombre'),
  ('tenis-blancos',      'Tenis blancos',       'calzado', '{"color":"blanco","color_hex":"#F5F5F0","formalidad":"casual","temporada":"todo-el-año"}',         '/archetypes/tenis-blancos.png',      13, 'unisex'),
  ('zapato-formal-cafe', 'Zapato formal café',  'calzado', '{"color":"café","color_hex":"#6B4A33","formalidad":"formal","temporada":"todo-el-año"}',           '/archetypes/zapato-formal-cafe.png', 14, 'hombre'),
  ('botas-negras',       'Botas negras',        'calzado', '{"color":"negro","color_hex":"#1A1A1A","formalidad":"casual","temporada":"frio"}',                 '/archetypes/botas-negras.png',       15, 'unisex')
on conflict (slug) do update set
  name        = excluded.name,
  category    = excluded.category,
  attrs       = excluded.attrs,
  image_path  = excluded.image_path,
  sort_order  = excluded.sort_order,
  segment     = excluded.segment;

-- Prendas de la lista vieja que salen de HOMBRE → a 'mujer' para ocultarlas
-- del checklist de hombre (se revisan/ajustan al construir la lista de mujer).
update public.archetypes set segment = 'mujer'
  where slug in ('abrigo-camel', 'vestido-negro', 'zapato-formal-negro');
