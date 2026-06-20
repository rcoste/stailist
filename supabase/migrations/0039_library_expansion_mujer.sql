-- Ampliación biblioteca MUJER (2026-06-19). 16 piezas en huecos del catálogo
-- (knitwear, capas, leggings/cuero, ballerinas, vestido blanco, accesorios:
-- reloj plateado, bolso estructurado, cinturón camel, collar, bufanda, guantes).
-- onboarding_subset=false. Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('cuello-tortuga-negro-mujer', 'Cuello tortuga negro', 'top', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/cuello-tortuga-negro-mujer.png', 190, false),
  ('sueter-crewneck-marino-mujer', 'Suéter crewneck marino', 'top', 'mujer', '{"color":"azul marino","color_hex":"#27425F","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-crewneck-marino-mujer.png', 191, false),
  ('sueter-half-zip-gris-mujer', 'Suéter half-zip gris', 'top', 'mujer', '{"color":"gris","color_hex":"#9AA0A6","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-half-zip-gris-mujer.png', 192, false),
  ('cardigan-corto-negro-mujer', 'Cardigan corto negro', 'abrigo', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"casual"}', '/archetypes/cardigan-corto-negro-mujer.png', 193, false),
  ('blazer-camel-mujer', 'Blazer camel', 'abrigo', 'mujer', '{"color":"camel","color_hex":"#B89968","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/blazer-camel-mujer.png', 194, false),
  ('abrigo-acolchado-largo-mujer', 'Abrigo acolchado largo', 'abrigo', 'mujer', '{"color":"negro","color_hex":"#1F1F22","temporada":"frio","formalidad":"casual"}', '/archetypes/abrigo-acolchado-largo-mujer.png', 195, false),
  ('leggings-negros', 'Leggings negros', 'bottom', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/leggings-negros.png', 196, false),
  ('pantalon-cuero-negro-mujer', 'Pantalón de cuero negro', 'bottom', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/pantalon-cuero-negro-mujer.png', 197, false),
  ('ballerinas-negras', 'Ballerinas negras', 'calzado', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/ballerinas-negras.png', 198, false),
  ('vestido-blanco-verano', 'Vestido blanco', 'vestido', 'mujer', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"calor","formalidad":"casual"}', '/archetypes/vestido-blanco-verano.png', 199, false),
  ('reloj-plateado-mujer', 'Reloj plateado', 'accesorio', 'mujer', '{"color":"plateado","color_hex":"#C7C9CC","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/reloj-plateado-mujer.png', 200, false),
  ('bolso-estructurado-negro', 'Bolso estructurado negro', 'accesorio', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/bolso-estructurado-negro.png', 201, false),
  ('cinturon-camel-mujer', 'Cinturón camel', 'accesorio', 'mujer', '{"color":"camel","color_hex":"#B89968","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/cinturon-camel-mujer.png', 202, false),
  ('collar-dorado', 'Collar dorado', 'accesorio', 'mujer', '{"color":"dorado","color_hex":"#C9A23B","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/collar-dorado.png', 203, false),
  ('bufanda-lana-mujer', 'Bufanda de lana', 'accesorio', 'mujer', '{"color":"gris","color_hex":"#9AA0A6","temporada":"frio","formalidad":"casual"}', '/archetypes/bufanda-lana-mujer.png', 204, false),
  ('guantes-piel-negros-mujer', 'Guantes de piel negros', 'accesorio', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/guantes-piel-negros-mujer.png', 205, false)
on conflict (slug) do nothing;
