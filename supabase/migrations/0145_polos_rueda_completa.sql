-- LA RUEDA COMPLETA DE POLOS (2026-08-22, mismo día que 0144).
--
-- 0144 metió cuatro básicos con el argumento de que cinco de los ocho polos
-- viejos tenían CERO usos, así que ampliar la gama sería repetir un error.
-- EL ARGUMENTO ERA MALO y el dato lo desmiente: los dos únicos polos con uso
-- son justamente los dos que están en el onboarding (marino y oliva). El cero
-- de los otros mide FALTA DE EXPOSICIÓN, no falta de interés — nadie los ha
-- visto nunca. Roberto lo dijo primero ("te faltaron varios colores") y tenía
-- razón. Con esto el catálogo de polos queda como el de una tienda real: la
-- rueda de color entera, más manga larga en los cuatro que se repiten.
--
-- Los CLAROS (rosa palo, crudo, lavanda, blanco y gris de manga larga) van con
-- el prompt `flat-sombra` — sombra de contacto — para que no se laven contra el
-- fondo papel en el tile. Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('polo-vino-hombre', 'Polo vino', 'top', 'hombre', '{"color":"vino","color_hex":"#722F37","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-vino-hombre.png', 447, false),
  ('polo-gris-carbon-hombre', 'Polo gris carbón', 'top', 'hombre', '{"color":"gris carbón","color_hex":"#3A3E46","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-gris-carbon-hombre.png', 448, false),
  ('polo-azul-rey-hombre', 'Polo azul rey', 'top', 'hombre', '{"color":"azul rey","color_hex":"#2E4FA3","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-azul-rey-hombre.png', 449, false),
  ('polo-chocolate-hombre', 'Polo chocolate', 'top', 'hombre', '{"color":"chocolate","color_hex":"#4B3526","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-chocolate-hombre.png', 450, false),
  ('polo-oxido-hombre', 'Polo óxido', 'top', 'hombre', '{"color":"óxido","color_hex":"#B5541F","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-oxido-hombre.png', 451, false),
  ('polo-turquesa-hombre', 'Polo turquesa', 'top', 'hombre', '{"color":"turquesa","color_hex":"#2BB3B0","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-turquesa-hombre.png', 452, false),
  ('polo-rosa-palo-hombre', 'Polo rosa palo', 'top', 'hombre', '{"color":"rosa","color_hex":"#E3A8A8","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-rosa-palo-hombre.png', 453, false),
  ('polo-crudo-hombre', 'Polo crudo', 'top', 'hombre', '{"color":"crema","color_hex":"#EDE6D6","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-crudo-hombre.png', 454, false),
  ('polo-lavanda-hombre', 'Polo lavanda', 'top', 'hombre', '{"color":"lavanda","color_hex":"#C9B6DF","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-lavanda-hombre.png', 455, false),
  ('polo-manga-larga-blanco-hombre', 'Polo de manga larga blanco', 'top', 'hombre', '{"color":"blanco","color_hex":"#FAFAF7","corte":"recto","largo":"regular","manga":"larga","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-manga-larga-blanco-hombre.png', 456, false),
  ('polo-manga-larga-gris-hombre', 'Polo de manga larga gris', 'top', 'hombre', '{"color":"gris","color_hex":"#9AA0A6","corte":"recto","largo":"regular","manga":"larga","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-manga-larga-gris-hombre.png', 457, false),
  ('polo-manga-larga-verde-botella-hombre', 'Polo de manga larga verde botella', 'top', 'hombre', '{"color":"verde","color_hex":"#1E4D3B","corte":"recto","largo":"regular","manga":"larga","subtipo":null,"temporada":"frio","formalidad":"casual"}', '/archetypes/polo-manga-larga-verde-botella-hombre.png', 458, false),
  ('polo-manga-larga-vino-hombre', 'Polo de manga larga vino', 'top', 'hombre', '{"color":"vino","color_hex":"#722F37","corte":"recto","largo":"regular","manga":"larga","subtipo":null,"temporada":"frio","formalidad":"casual"}', '/archetypes/polo-manga-larga-vino-hombre.png', 459, false)
on conflict (slug) do nothing;
