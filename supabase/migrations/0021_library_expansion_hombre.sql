-- Ampliación de la BIBLIOTECA (no del onboarding) — lista de Roberto.
-- 4 tees de color unisex + 10 prendas de hombre + 6 accesorios de hombre.
-- Todas entran con onboarding_subset=false: viven en la biblioteca completa
-- (se agregan desde el clóset después del wow), no inflan el onboarding inicial.
-- Nombres genéricos (sin marca). Idempotente.

insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  -- Tees de color (unisex: playera lisa = misma prenda para ambos)
  ('camiseta-marino', 'Camiseta marino', 'top', 'unisex', '{"color":"azul marino","color_hex":"#27425F","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/camiseta-marino.png', 75, false),
  ('camiseta-olivo',  'Camiseta olivo',  'top', 'unisex', '{"color":"olivo","color_hex":"#5E6B43","temporada":"todo-el-año","formalidad":"casual"}',      '/archetypes/camiseta-olivo.png',  76, false),
  ('camiseta-arena',  'Camiseta arena',  'top', 'unisex', '{"color":"arena","color_hex":"#C9B79C","temporada":"todo-el-año","formalidad":"casual"}',      '/archetypes/camiseta-arena.png',  77, false),
  ('camiseta-vino',   'Camiseta vino',   'top', 'unisex', '{"color":"vino","color_hex":"#5C2A2E","temporada":"todo-el-año","formalidad":"casual"}',       '/archetypes/camiseta-vino.png',   78, false),
  -- Prendas de hombre
  ('chamarra-piel-negra',    'Chamarra de piel negra',  'abrigo',  'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"templado","formalidad":"casual"}',        '/archetypes/chamarra-piel-negra.png',    79, false),
  ('chamarra-piel-cafe',     'Chamarra de piel café',   'abrigo',  'hombre', '{"color":"café","color_hex":"#5C4433","temporada":"templado","formalidad":"casual"}',         '/archetypes/chamarra-piel-cafe.png',     80, false),
  ('sueter-cuello-v-marino', 'Suéter cuello V marino',  'top',     'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"frio","formalidad":"formal-casual"}','/archetypes/sueter-cuello-v-marino.png', 81, false),
  ('sueter-merino-camel',    'Suéter merino camel',     'top',     'hombre', '{"color":"camel","color_hex":"#B89968","temporada":"frio","formalidad":"casual"}',            '/archetypes/sueter-merino-camel.png',    82, false),
  ('chamarra-ultraligera',   'Chamarra ultraligera',    'abrigo',  'hombre', '{"color":"negro","color_hex":"#1F1F22","temporada":"frio","formalidad":"casual"}',            '/archetypes/chamarra-ultraligera.png',   83, false),
  ('pantalon-vestir-marino', 'Pantalón de vestir marino','bottom', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"todo-el-año","formalidad":"formal"}','/archetypes/pantalon-vestir-marino.png', 84, false),
  ('abrigo-charcoal',        'Abrigo charcoal',         'abrigo',  'hombre', '{"color":"charcoal","color_hex":"#3A3B3F","temporada":"frio","formalidad":"formal"}',         '/archetypes/abrigo-charcoal.png',        85, false),
  ('botines-chelsea-negros', 'Botines Chelsea negros',  'calzado', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/botines-chelsea-negros.png',86, false),
  ('tenis-blancos-urbanos',  'Tenis blancos urbanos',   'calzado', 'hombre', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"todo-el-año","formalidad":"casual"}',     '/archetypes/tenis-blancos-urbanos.png',  87, false),
  ('tenis-deportivos',       'Tenis deportivos',        'calzado', 'hombre', '{"color":"gris claro","color_hex":"#C8C8C8","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/tenis-deportivos.png',       88, false),
  -- Accesorios de hombre (categoría accesorio)
  ('cinturon-cafe',   'Cinturón café',     'accesorio', 'hombre', '{"color":"café","color_hex":"#5C4433","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/cinturon-cafe.png',   89, false),
  ('cinturon-negro',  'Cinturón negro',    'accesorio', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}','/archetypes/cinturon-negro.png',  90, false),
  ('gorra-negra',     'Gorra negra',       'accesorio', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}',       '/archetypes/gorra-negra.png',     91, false),
  ('gorra-marino',    'Gorra marino',      'accesorio', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/gorra-marino.png',    92, false),
  ('lentes-wayfarer', 'Lentes wayfarer',   'accesorio', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"calor","formalidad":"casual"}',             '/archetypes/lentes-wayfarer.png', 93, false),
  ('lentes-aviador',  'Lentes aviador',    'accesorio', 'hombre', '{"color":"dorado","color_hex":"#B08D57","temporada":"calor","formalidad":"casual"}',            '/archetypes/lentes-aviador.png',  94, false)
on conflict (slug) do nothing;
