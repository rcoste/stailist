-- Ampliación de la BIBLIOTECA v2 (2026-06-19). 22 piezas: tapa el hueco de
-- accesorios de MUJER (estaba en 0), expande accesorios de hombre, y suma
-- staples (cuello tortuga, chino chocolate, henley, cuadros, chaleco, suéter
-- esmeralda, tenis blancos mujer, bodysuit). onboarding_subset=false → solo
-- biblioteca, no infla el onboarding. Idempotente por slug.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('bolso-tote-camel', 'Bolso tote camel', 'accesorio', 'mujer', '{"color":"camel","color_hex":"#B89968","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/bolso-tote-camel.png', 149, false),
  ('bolso-crossbody-negro', 'Bolso crossbody negro', 'accesorio', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/bolso-crossbody-negro.png', 150, false),
  ('clutch-negro', 'Clutch negro', 'accesorio', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/clutch-negro.png', 151, false),
  ('cinturon-negro-mujer', 'Cinturón negro', 'accesorio', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/cinturon-negro-mujer.png', 152, false),
  ('mascada-seda', 'Mascada de seda', 'accesorio', 'mujer', '{"color":"neutro","color_hex":"#C9B79C","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/mascada-seda.png', 153, false),
  ('lentes-carey-mujer', 'Lentes de sol carey', 'accesorio', 'mujer', '{"color":"carey","color_hex":"#6B4A2B","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/lentes-carey-mujer.png', 154, false),
  ('reloj-dorado-mujer', 'Reloj dorado', 'accesorio', 'mujer', '{"color":"dorado","color_hex":"#C9A23B","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/reloj-dorado-mujer.png', 155, false),
  ('arracadas-oro', 'Arracadas doradas', 'accesorio', 'mujer', '{"color":"dorado","color_hex":"#C9A23B","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/arracadas-oro.png', 156, false),
  ('reloj-plateado-hombre', 'Reloj plateado', 'accesorio', 'hombre', '{"color":"plateado","color_hex":"#C7C9CC","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/reloj-plateado-hombre.png', 157, false),
  ('reloj-piel-cafe-hombre', 'Reloj de piel café', 'accesorio', 'hombre', '{"color":"café","color_hex":"#6B4A2B","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/reloj-piel-cafe-hombre.png', 158, false),
  ('bufanda-lana-gris', 'Bufanda de lana gris', 'accesorio', 'hombre', '{"color":"gris","color_hex":"#9AA0A6","temporada":"frio","formalidad":"casual"}', '/archetypes/bufanda-lana-gris.png', 159, false),
  ('corbata-punto-marino', 'Corbata de punto marino', 'accesorio', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/corbata-punto-marino.png', 160, false),
  ('beanie-gris', 'Beanie gris', 'accesorio', 'hombre', '{"color":"gris","color_hex":"#9AA0A6","temporada":"frio","formalidad":"casual"}', '/archetypes/beanie-gris.png', 161, false),
  ('portafolio-piel-cafe', 'Portafolio de piel café', 'accesorio', 'hombre', '{"color":"café","color_hex":"#5C4433","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/portafolio-piel-cafe.png', 162, false),
  ('cuello-tortuga-negro', 'Cuello tortuga negro', 'top', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/cuello-tortuga-negro.png', 163, false),
  ('chino-chocolate', 'Chino chocolate', 'bottom', 'hombre', '{"color":"café","color_hex":"#5C4433","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/chino-chocolate.png', 164, false),
  ('henley-negro', 'Henley negro', 'top', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/henley-negro.png', 165, false),
  ('camisa-cuadros', 'Camisa de cuadros', 'top', 'hombre', '{"color":"verde","color_hex":"#3A4A3F","temporada":"frio","formalidad":"casual"}', '/archetypes/camisa-cuadros.png', 166, false),
  ('chaleco-acolchado-marino', 'Chaleco acolchado marino', 'abrigo', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"frio","formalidad":"casual"}', '/archetypes/chaleco-acolchado-marino.png', 167, false),
  ('sueter-esmeralda', 'Suéter esmeralda', 'top', 'mujer', '{"color":"esmeralda","color_hex":"#1E6B52","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-esmeralda.png', 168, false),
  ('tenis-blancos-mujer', 'Tenis blancos minimalistas', 'calzado', 'mujer', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/tenis-blancos-mujer.png', 169, false),
  ('bodysuit-negro', 'Bodysuit negro', 'top', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/bodysuit-negro.png', 170, false)
on conflict (slug) do nothing;
