-- Prendas juveniles de mujer que no existían ni en la biblioteca (huecos del
-- look Gen-Z que quedaban tras el rebalanceo 0084). Imágenes generadas con
-- scripts/gen-archetypes.mjs. Entran directo al clóset precargado
-- (onboarding_subset = true) para que una usuaria joven las vea al arrancar.
insert into public.archetypes
  (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset)
values
  ('crop-top-blanco-mujer', 'Crop top blanco', 'top', 'mujer',
   '{"color":"blanco","corte":"entallado","largo":"crop","manga":"corta","color_hex":"#FAFAF7","temporada":"calor","formalidad":"casual"}'::jsonb,
   '/archetypes/crop-top-blanco-mujer.png', 399, true),

  ('jeans-baggy-mujer', 'Jeans baggy', 'bottom', 'mujer',
   '{"color":"azul claro","corte":"holgado","largo":"regular","color_hex":"#8CA6C0","temporada":"todo-el-año","formalidad":"casual"}'::jsonb,
   '/archetypes/jeans-baggy-mujer.png', 400, true),

  ('mary-janes-negras', 'Mary Janes negras', 'calzado', 'mujer',
   '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}'::jsonb,
   '/archetypes/mary-janes-negras.png', 401, true),

  ('botas-combat-mujer', 'Botas militares', 'calzado', 'mujer',
   '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"casual"}'::jsonb,
   '/archetypes/botas-combat-mujer.png', 402, true),

  ('vestido-babydoll-mujer', 'Vestido babydoll', 'vestido', 'mujer',
   '{"color":"negro","corte":"holgado","largo":"crop","manga":"corta","color_hex":"#1A1A1A","temporada":"calor","formalidad":"casual"}'::jsonb,
   '/archetypes/vestido-babydoll-mujer.png', 403, true)
on conflict (slug) do nothing;
