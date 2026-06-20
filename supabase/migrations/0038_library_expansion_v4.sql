-- Ampliación biblioteca v4 (2026-06-19). 13 prendas de la lista completa de
-- Roberto que faltaban (el resto ya estaba). Todas hombre. Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('chinos-carbon', 'Chinos carbón', 'bottom', 'hombre', '{"color":"carbón","color_hex":"#3A3B3F","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/chinos-carbon.png', 177, false),
  ('pantalon-tecnico-marino', 'Pantalón técnico marino', 'bottom', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/pantalon-tecnico-marino.png', 178, false),
  ('pantalon-lino-verano', 'Pantalón de lino', 'bottom', 'hombre', '{"color":"beige","color_hex":"#C9B79C","temporada":"calor","formalidad":"casual"}', '/archetypes/pantalon-lino-verano.png', 179, false),
  ('pantalon-vestir-carbon', 'Pantalón de vestir carbón', 'bottom', 'hombre', '{"color":"carbón","color_hex":"#3A3B3F","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/pantalon-vestir-carbon.png', 180, false),
  ('camiseta-carbon', 'Camiseta carbón', 'top', 'hombre', '{"color":"carbón","color_hex":"#3A3B3F","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/camiseta-carbon.png', 181, false),
  ('polo-blanco', 'Polo blanco', 'top', 'hombre', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"calor","formalidad":"casual"}', '/archetypes/polo-blanco.png', 182, false),
  ('polo-gris', 'Polo gris', 'top', 'hombre', '{"color":"gris","color_hex":"#9AA0A6","temporada":"calor","formalidad":"casual"}', '/archetypes/polo-gris.png', 183, false),
  ('sueter-half-zip-gris', 'Suéter half-zip gris', 'top', 'hombre', '{"color":"gris","color_hex":"#9AA0A6","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-half-zip-gris.png', 184, false),
  ('sueter-crewneck-carbon', 'Suéter crewneck carbón', 'top', 'hombre', '{"color":"carbón","color_hex":"#3A3B3F","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-crewneck-carbon.png', 185, false),
  ('camisa-oxford-blanca', 'Camisa oxford blanca', 'top', 'hombre', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/camisa-oxford-blanca.png', 186, false),
  ('camisa-oxford-azul-hombre', 'Camisa oxford azul', 'top', 'hombre', '{"color":"azul claro","color_hex":"#AFC3DA","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/camisa-oxford-azul-hombre.png', 187, false),
  ('camisa-lino-blanca', 'Camisa de lino blanca', 'top', 'hombre', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"calor","formalidad":"casual"}', '/archetypes/camisa-lino-blanca.png', 188, false),
  ('camisa-lino-azul', 'Camisa de lino azul', 'top', 'hombre', '{"color":"azul claro","color_hex":"#AFC3DA","temporada":"calor","formalidad":"casual"}', '/archetypes/camisa-lino-azul.png', 189, false)
on conflict (slug) do nothing;
