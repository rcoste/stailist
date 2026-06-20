-- Paridad de color hombre (2026-06-19): 3a pieza por estación de colorimetria.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('sueter-esmeralda-hombre', 'Suéter esmeralda', 'top', 'hombre', '{"color":"esmeralda","color_hex":"#1E6B52","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-esmeralda-hombre.png', 260, false),
  ('sueter-mostaza-hombre', 'Suéter mostaza', 'top', 'hombre', '{"color":"mostaza","color_hex":"#C99700","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-mostaza-hombre.png', 261, false),
  ('polo-amarillo-hombre', 'Polo amarillo', 'top', 'hombre', '{"color":"amarillo","color_hex":"#F2C14E","temporada":"calor","formalidad":"casual"}', '/archetypes/polo-amarillo-hombre.png', 262, false),
  ('camisa-lavanda-hombre', 'Camisa lavanda', 'top', 'hombre', '{"color":"lavanda","color_hex":"#B9A7CE","temporada":"calor","formalidad":"casual"}', '/archetypes/camisa-lavanda-hombre.png', 263, false)
on conflict (slug) do nothing;
