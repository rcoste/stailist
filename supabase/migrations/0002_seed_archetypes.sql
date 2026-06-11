-- stailist — seed del catálogo canónico de básicos (checklist del onboarding)
-- 15 prendas que la mayoría ya tiene. Imágenes: se generan one-off en la build
-- y se actualizan via image_path. Lista pendiente de validación por Roberto.

insert into public.archetypes (slug, name, category, attrs, sort_order) values
  ('camiseta-blanca',    'Camiseta blanca',        'top',     '{"color":"blanco","color_hex":"#F5F5F0","formalidad":"casual","temporada":"todo-el-año"}', 1),
  ('camiseta-negra',     'Camiseta negra',         'top',     '{"color":"negro","color_hex":"#1A1A1A","formalidad":"casual","temporada":"todo-el-año"}', 2),
  ('camisa-blanca',      'Camisa blanca',          'top',     '{"color":"blanco","color_hex":"#FAFAF7","formalidad":"formal-casual","temporada":"todo-el-año"}', 3),
  ('camisa-azul-claro',  'Camisa azul claro',      'top',     '{"color":"azul claro","color_hex":"#AEC6E8","formalidad":"formal-casual","temporada":"todo-el-año"}', 4),
  ('sueter-gris',        'Suéter gris',            'top',     '{"color":"gris","color_hex":"#8A8784","formalidad":"casual","temporada":"frio"}', 5),
  ('blazer-azul-marino', 'Blazer azul marino',     'abrigo',  '{"color":"azul marino","color_hex":"#27425F","formalidad":"formal","temporada":"todo-el-año"}', 6),
  ('chamarra-mezclilla', 'Chamarra de mezclilla',  'abrigo',  '{"color":"azul mezclilla","color_hex":"#4A6B8A","formalidad":"casual","temporada":"templado"}', 7),
  ('abrigo-camel',       'Abrigo camel',           'abrigo',  '{"color":"camel","color_hex":"#B08D57","formalidad":"formal-casual","temporada":"frio"}', 8),
  ('jeans-azul-oscuro',  'Jeans azul oscuro',      'bottom',  '{"color":"azul oscuro","color_hex":"#2C3E50","formalidad":"casual","temporada":"todo-el-año"}', 9),
  ('pantalon-negro',     'Pantalón negro',         'bottom',  '{"color":"negro","color_hex":"#1A1A1A","formalidad":"formal-casual","temporada":"todo-el-año"}', 10),
  ('chinos-beige',       'Chinos beige',           'bottom',  '{"color":"beige","color_hex":"#C8B89A","formalidad":"casual","temporada":"todo-el-año"}', 11),
  ('vestido-negro',      'Vestido negro',          'vestido', '{"color":"negro","color_hex":"#1A1A1A","formalidad":"formal-casual","temporada":"todo-el-año"}', 12),
  ('tenis-blancos',      'Tenis blancos',          'calzado', '{"color":"blanco","color_hex":"#F5F5F0","formalidad":"casual","temporada":"todo-el-año"}', 13),
  ('zapato-formal-negro','Zapato formal negro',    'calzado', '{"color":"negro","color_hex":"#1A1A1A","formalidad":"formal","temporada":"todo-el-año"}', 14),
  ('botas-negras',       'Botas negras',           'calzado', '{"color":"negro","color_hex":"#1A1A1A","formalidad":"casual","temporada":"frio"}', 15)
on conflict (slug) do nothing;
