-- LOS POLOS DE MUJER (2026-08-24). El catálogo llegó a 27 polos de hombre y
-- CERO de mujer — el mismo sesgo del audit de género de julio, y las usuarias
-- reales de la app son mujeres. Seis básicos con CORTE FEMENINO real (entallado
-- al talle, hombro estrecho, cuello suave), generados diciéndolo en positivo y
-- en negativo ("NOT a men's boxy polo"): el default del generador es masculino,
-- igual que pasó con los trajes sastre. Claros con flat-sombra. Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('polo-blanco-mujer', 'Polo blanco', 'top', 'mujer', '{"color":"blanco","color_hex":"#FAFAF7","corte":"entallado","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-blanco-mujer.png', 460, false),
  ('polo-negro-mujer', 'Polo negro', 'top', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","corte":"entallado","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-negro-mujer.png', 461, false),
  ('polo-marino-mujer', 'Polo marino', 'top', 'mujer', '{"color":"azul marino","color_hex":"#27425F","corte":"entallado","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-marino-mujer.png', 462, false),
  ('polo-rojo-mujer', 'Polo rojo', 'top', 'mujer', '{"color":"rojo","color_hex":"#C8102E","corte":"entallado","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-rojo-mujer.png', 463, false),
  ('polo-manga-larga-blanco-mujer', 'Polo de manga larga blanco', 'top', 'mujer', '{"color":"blanco","color_hex":"#FAFAF7","corte":"entallado","largo":"regular","manga":"larga","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-manga-larga-blanco-mujer.png', 464, false),
  ('polo-manga-larga-marino-mujer', 'Polo de manga larga marino', 'top', 'mujer', '{"color":"azul marino","color_hex":"#27425F","corte":"entallado","largo":"regular","manga":"larga","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-manga-larga-marino-mujer.png', 465, false)
on conflict (slug) do nothing;
