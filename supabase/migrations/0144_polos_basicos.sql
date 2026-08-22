-- LOS POLOS BÁSICOS QUE FALTABAN (2026-08-22).
--
-- El catálogo tenía OCHO polos de hombre —marino, blanco, gris, rojo, oliva,
-- coral, salvia, amarillo— y NO tenía negro, que es de los tres colores con los
-- que un guardarropa real empieza. Y el dato que decide qué se añade y qué no:
-- de esos ocho, CINCO no los ha marcado nadie (0 prendas en toda la base:
-- gris, rojo, coral, salvia, amarillo); los que sí se usan son marino, blanco y
-- oliva. Al catálogo no le faltaban colores, le faltaban básicos — así que
-- entran los cuatro que un clóset normal tiene y no estaban, y NO se amplía la
-- gama exótica que ya demostró no usarse.
--
-- MANGA LARGA COMO PRENDA APARTE, no como variante. Roberto: "el azul marino y
-- negro también tienen una versión de manga larga". Es otra temporada y otro
-- registro (`temporada: templado` contra `calor`), y el motor tiene que poder
-- elegir uno y no el otro; una prenda con dos mangas no se puede vestir.
--
-- Imágenes: pipeline de la casa (scripts/gen-archetypes.mjs). Los dos CLAROS
-- —azul claro y arena— van con el tipo `flat-sombra` (sombra de contacto), que
-- es el prompt validado para que la prenda clara no se lave contra el fondo
-- papel. Los oscuros con el flat normal. Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('polo-negro-hombre', 'Polo negro', 'top', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-negro-hombre.png', 441, false),
  ('polo-azul-claro-hombre', 'Polo azul claro', 'top', 'hombre', '{"color":"azul claro","color_hex":"#A9C6E0","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-azul-claro-hombre.png', 442, false),
  ('polo-verde-botella-hombre', 'Polo verde botella', 'top', 'hombre', '{"color":"verde","color_hex":"#1E4D3B","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-verde-botella-hombre.png', 443, false),
  ('polo-arena-hombre', 'Polo arena', 'top', 'hombre', '{"color":"arena","color_hex":"#C9B79C","corte":"recto","largo":"regular","manga":"corta","subtipo":null,"temporada":"calor","formalidad":"casual"}', '/archetypes/polo-arena-hombre.png', 444, false),
  ('polo-manga-larga-marino-hombre', 'Polo de manga larga marino', 'top', 'hombre', '{"color":"azul marino","color_hex":"#27425F","corte":"recto","largo":"regular","manga":"larga","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-manga-larga-marino-hombre.png', 445, false),
  ('polo-manga-larga-negro-hombre', 'Polo de manga larga negro', 'top', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","corte":"recto","largo":"regular","manga":"larga","subtipo":null,"temporada":"templado","formalidad":"casual"}', '/archetypes/polo-manga-larga-negro-hombre.png', 446, false)
on conflict (slug) do nothing;
