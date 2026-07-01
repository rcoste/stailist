-- Ampliación biblioteca: deportivo + traje de baño + loungewear (2026-06-30). Huecos
-- reales del catálogo: NO había ropa deportiva (solo "tenis deportivos") pese a que el
-- assessment pregunta por gym; traje de baño casi vacío (solo 1 de hombre, cero mujer);
-- sin joggers/sweatpants cómodos. 19 prendas. onboarding_subset=false. Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('playera-tecnica-h', 'Playera deportiva', 'top', 'hombre', '{"color":"gris","color_hex":"#6E7278","temporada":"calor","formalidad":"casual"}', '/archetypes/playera-tecnica-h.png', 333, false),
  ('tank-deportivo-h', 'Tank deportivo', 'top', 'hombre', '{"color":"negro","color_hex":"#26262A","temporada":"calor","formalidad":"casual"}', '/archetypes/tank-deportivo-h.png', 334, false),
  ('shorts-running-h', 'Shorts running', 'bottom', 'hombre', '{"color":"negro","color_hex":"#232326","temporada":"calor","formalidad":"casual"}', '/archetypes/shorts-running-h.png', 335, false),
  ('joggers-deportivos-h', 'Joggers deportivos', 'bottom', 'hombre', '{"color":"gris","color_hex":"#797B80","temporada":"templado","formalidad":"casual"}', '/archetypes/joggers-deportivos-h.png', 336, false),
  ('tech-hoodie-h', 'Sudadera deportiva con capucha', 'top', 'hombre', '{"color":"negro","color_hex":"#24252B","temporada":"templado","formalidad":"casual"}', '/archetypes/tech-hoodie-h.png', 337, false),
  ('pants-deportivos-h', 'Pants deportivos', 'bottom', 'hombre', '{"color":"negro","color_hex":"#212127","temporada":"templado","formalidad":"casual"}', '/archetypes/pants-deportivos-h.png', 338, false),
  ('top-deportivo-m', 'Top deportivo', 'top', 'mujer', '{"color":"negro","color_hex":"#26262A","temporada":"calor","formalidad":"casual"}', '/archetypes/top-deportivo-m.png', 339, false),
  ('playera-tecnica-m', 'Playera deportiva', 'top', 'mujer', '{"color":"gris","color_hex":"#7B7F85","temporada":"calor","formalidad":"casual"}', '/archetypes/playera-tecnica-m.png', 340, false),
  ('biker-shorts-m', 'Biker shorts', 'bottom', 'mujer', '{"color":"negro","color_hex":"#232326","temporada":"calor","formalidad":"casual"}', '/archetypes/biker-shorts-m.png', 341, false),
  ('joggers-deportivos-m', 'Joggers deportivos', 'bottom', 'mujer', '{"color":"gris","color_hex":"#7C7E83","temporada":"templado","formalidad":"casual"}', '/archetypes/joggers-deportivos-m.png', 342, false),
  ('tech-hoodie-m', 'Sudadera deportiva con capucha', 'top', 'mujer', '{"color":"negro","color_hex":"#24252B","temporada":"templado","formalidad":"casual"}', '/archetypes/tech-hoodie-m.png', 343, false),
  ('leggings-deportivos-m', 'Leggings deportivos', 'bottom', 'mujer', '{"color":"negro","color_hex":"#1F1F23","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/leggings-deportivos-m.png', 344, false),
  ('short-bano-negro-h', 'Short de baño negro', 'bottom', 'hombre', '{"color":"negro","color_hex":"#23232A","temporada":"calor","formalidad":"casual"}', '/archetypes/short-bano-negro-h.png', 345, false),
  ('short-bano-estampado-h', 'Short de baño estampado', 'bottom', 'hombre', '{"color":"marino","color_hex":"#2C3E5A","temporada":"calor","formalidad":"casual"}', '/archetypes/short-bano-estampado-h.png', 346, false),
  ('bikini-negro-m', 'Bikini negro', 'vestido', 'mujer', '{"color":"negro","color_hex":"#201F23","temporada":"calor","formalidad":"casual"}', '/archetypes/bikini-negro-m.png', 347, false),
  ('una-pieza-negro-m', 'Traje de baño una pieza negro', 'vestido', 'mujer', '{"color":"negro","color_hex":"#201F23","temporada":"calor","formalidad":"casual"}', '/archetypes/una-pieza-negro-m.png', 348, false),
  ('salida-playa-beige-m', 'Salida de playa beige', 'abrigo', 'mujer', '{"color":"beige","color_hex":"#DACEB8","temporada":"calor","formalidad":"casual"}', '/archetypes/salida-playa-beige-m.png', 349, false),
  ('sweatpants-crema-h', 'Sweatpants crema', 'bottom', 'hombre', '{"color":"crema","color_hex":"#DDD5C4","temporada":"templado","formalidad":"casual"}', '/archetypes/sweatpants-crema-h.png', 350, false),
  ('sweatpants-gris-m', 'Sweatpants gris', 'bottom', 'mujer', '{"color":"gris","color_hex":"#8B8D92","temporada":"templado","formalidad":"casual"}', '/archetypes/sweatpants-gris-m.png', 351, false)
on conflict (slug) do nothing;
