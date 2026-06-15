-- Ampliación clóset MUJER (2026-06-15). Antes: 5 prendas segment='mujer' (+14
-- unisex = 19 visibles). El motor de outfits no tenía con qué armar looks
-- femeninos decentes: solo 1 vestido, cero tacones, cero sandalias, bottoms y
-- tops de corte unisex. Esta migración agrega 18 básicos de mujer curados como
-- capsule wardrobe + clima de México. Total mujer pasa a 32 visibles (vs 44
-- hombre). Imágenes flat-lay generadas con scripts/gen-archetypes.mjs.
-- Idempotente: on conflict (slug) do nothing.

insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order) values
  -- Tops
  ('blusa-blanca',            'Blusa blanca',            'top',     'mujer', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/blusa-blanca.png',            51),
  ('blusa-lino',              'Blusa de lino',           'top',     'mujer', '{"color":"natural","color_hex":"#E7DDCB","temporada":"calor","formalidad":"casual"}',            '/archetypes/blusa-lino.png',              52),
  ('top-tirantes',            'Camiseta de tirantes',    'top',     'mujer', '{"color":"blanco","color_hex":"#F5F5F0","temporada":"calor","formalidad":"casual"}',             '/archetypes/top-tirantes.png',            53),
  ('sueter-cuello-alto-mujer','Suéter de cuello alto',   'top',     'mujer', '{"color":"crema","color_hex":"#EFE6D6","temporada":"frio","formalidad":"formal-casual"}',        '/archetypes/sueter-cuello-alto-mujer.png',54),
  ('camiseta-rayas',          'Camiseta de rayas',       'top',     'mujer', '{"color":"marino y blanco","color_hex":"#1F3A5F","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/camiseta-rayas.png',         55),
  -- Bottoms
  ('pantalon-vestir-camel',   'Pantalón de vestir camel','bottom',  'mujer', '{"color":"camel","color_hex":"#B89968","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/pantalon-vestir-camel.png',   56),
  ('pantalon-wide-leg',       'Pantalón wide-leg',       'bottom',  'mujer', '{"color":"crema","color_hex":"#EAE2D2","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/pantalon-wide-leg.png',       57),
  ('jeans-claros-mujer',      'Jeans claros',            'bottom',  'mujer', '{"color":"azul claro","color_hex":"#8CA6C0","temporada":"todo-el-año","formalidad":"casual"}',   '/archetypes/jeans-claros-mujer.png',      58),
  ('falda-midi-camel',        'Falda midi camel',        'bottom',  'mujer', '{"color":"camel","color_hex":"#B08D57","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/falda-midi-camel.png',        59),
  -- Vestidos
  ('vestido-camisero',        'Vestido camisero',        'vestido', 'mujer', '{"color":"azul mezclilla","color_hex":"#6E89A6","temporada":"todo-el-año","formalidad":"casual"}','/archetypes/vestido-camisero.png',        60),
  ('vestido-floral',          'Vestido floral',          'vestido', 'mujer', '{"color":"floral","color_hex":"#C98B9B","temporada":"calor","formalidad":"formal-casual"}',      '/archetypes/vestido-floral.png',          61),
  ('vestido-midi-burdeos',    'Vestido midi burdeos',    'vestido', 'mujer', '{"color":"burdeos","color_hex":"#722F37","temporada":"todo-el-año","formalidad":"formal"}',      '/archetypes/vestido-midi-burdeos.png',    62),
  -- Calzado
  ('tacon-nude',              'Tacón nude',              'calzado', 'mujer', '{"color":"nude","color_hex":"#D9BFA8","temporada":"todo-el-año","formalidad":"formal"}',         '/archetypes/tacon-nude.png',              63),
  ('sandalias-tiras',         'Sandalias de tiras',      'calzado', 'mujer', '{"color":"tostado","color_hex":"#C2A079","temporada":"calor","formalidad":"formal-casual"}',     '/archetypes/sandalias-tiras.png',         64),
  ('botines-mujer',           'Botines',                 'calzado', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}',        '/archetypes/botines-mujer.png',           65),
  ('mocasines-mujer',         'Mocasines',               'calzado', 'mujer', '{"color":"café","color_hex":"#5C4433","temporada":"todo-el-año","formalidad":"formal-casual"}',  '/archetypes/mocasines-mujer.png',         66),
  -- Abrigos
  ('gabardina-mujer',         'Gabardina',               'abrigo',  'mujer', '{"color":"beige","color_hex":"#C8B89A","temporada":"templado","formalidad":"formal-casual"}',    '/archetypes/gabardina-mujer.png',         67),
  ('chaqueta-piel',           'Chaqueta de piel',        'abrigo',  'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"templado","formalidad":"casual"}',           '/archetypes/chaqueta-piel.png',           68)
on conflict (slug) do nothing;
