-- Ampliación del clóset de hombre (2026-06-14): 20 básicos del perfil
-- minimalista refinado de Roberto (Uniqlo + Massimo Dutti + Meermin +
-- Lululemon + Hugo Boss). Colores sesgados a su paleta profunda/neutra:
-- oliva, marino, carbón, burdeos, crema. Imágenes flat-lay estilo A en
-- public/archetypes/<slug>.png. Idempotente (on conflict do nothing).
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order) values
  ('camisa-negra', 'Camisa negra', 'top', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"templado","formalidad":"formal-casual"}', '/archetypes/camisa-negra.png', 31),
  ('sueter-cuello-alto', 'Suéter de cuello alto', 'top', 'hombre', '{"color":"carbón","color_hex":"#36373B","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/sueter-cuello-alto.png', 32),
  ('sueter-marino', 'Suéter marino', 'top', 'hombre', '{"color":"azul marino","color_hex":"#1F2A44","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-marino.png', 33),
  ('cardigan-marino', 'Cárdigan marino', 'top', 'hombre', '{"color":"azul marino","color_hex":"#25304A","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/cardigan-marino.png', 34),
  ('polo-punto-oliva', 'Polo de punto oliva', 'top', 'hombre', '{"color":"oliva","color_hex":"#6B7A4C","temporada":"templado","formalidad":"formal-casual"}', '/archetypes/polo-punto-oliva.png', 35),
  ('camiseta-manga-larga', 'Camiseta de manga larga', 'top', 'hombre', '{"color":"blanco","color_hex":"#F2F1EC","temporada":"templado","formalidad":"casual"}', '/archetypes/camiseta-manga-larga.png', 36),
  ('sudadera-crema', 'Sudadera crema', 'top', 'hombre', '{"color":"crema","color_hex":"#E7DFD0","temporada":"frio","formalidad":"casual"}', '/archetypes/sudadera-crema.png', 37),
  ('pantalon-vestir-gris', 'Pantalón de vestir gris', 'bottom', 'hombre', '{"color":"gris","color_hex":"#6E6E70","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/pantalon-vestir-gris.png', 38),
  ('chinos-oliva', 'Chinos oliva', 'bottom', 'hombre', '{"color":"oliva","color_hex":"#5E6B43","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/chinos-oliva.png', 39),
  ('jeans-claros', 'Jeans claros', 'bottom', 'hombre', '{"color":"azul claro","color_hex":"#7E9BB8","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/jeans-claros.png', 40),
  ('pantalon-tecnico', 'Pantalón técnico', 'bottom', 'hombre', '{"color":"carbón","color_hex":"#3A3B3F","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/pantalon-tecnico.png', 41),
  ('overshirt-oliva', 'Overshirt oliva', 'abrigo', 'hombre', '{"color":"oliva","color_hex":"#5E6B43","temporada":"templado","formalidad":"casual"}', '/archetypes/overshirt-oliva.png', 42),
  ('abrigo-lana-marino', 'Abrigo de lana marino', 'abrigo', 'hombre', '{"color":"azul marino","color_hex":"#1F2A44","temporada":"frio","formalidad":"formal"}', '/archetypes/abrigo-lana-marino.png', 43),
  ('gabardina-beige', 'Gabardina beige', 'abrigo', 'hombre', '{"color":"beige","color_hex":"#C2B49A","temporada":"templado","formalidad":"formal-casual"}', '/archetypes/gabardina-beige.png', 44),
  ('parka-negra', 'Parka negra', 'abrigo', 'hombre', '{"color":"negro","color_hex":"#1F1F22","temporada":"frio","formalidad":"casual"}', '/archetypes/parka-negra.png', 45),
  ('chaqueta-campo', 'Chaqueta de campo', 'abrigo', 'hombre', '{"color":"verde militar","color_hex":"#4F5A3C","temporada":"templado","formalidad":"casual"}', '/archetypes/chaqueta-campo.png', 46),
  ('botines-chelsea', 'Botines Chelsea', 'calzado', 'hombre', '{"color":"café","color_hex":"#6B4A33","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/botines-chelsea.png', 47),
  ('botines-ante', 'Botines de ante', 'calzado', 'hombre', '{"color":"arena","color_hex":"#A97D52","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/botines-ante.png', 48),
  ('mocasines-negro', 'Mocasines negros', 'calzado', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/mocasines-negro.png', 49),
  ('mocasines-burdeos', 'Mocasines burdeos', 'calzado', 'hombre', '{"color":"burdeos","color_hex":"#5C2A2E","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/mocasines-burdeos.png', 50)
on conflict (slug) do nothing;
