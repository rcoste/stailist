-- Biblioteca: 25 prendas reales de las cuentas de prueba de Roberto (2026-08-17).
-- Renders flat-lay del pipeline de la casa, curados contra duplicados exactos
-- y por concepto (docs/designs/corpus-de-prendas.md). Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('rc-blazer-marron-de-lana', 'Blazer marrón de lana', 'abrigo', 'hombre', '{"color":"café","color_hex":"#6B4F3A","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/rc-blazer-marron-de-lana.jpg', 410, false),
  ('rc-botas-de-senderismo-negras', 'Botas de senderismo negras', 'calzado', 'hombre', '{"color":"negro","color_hex":"#1a1a1a","temporada":"frio","formalidad":"casual"}', '/archetypes/rc-botas-de-senderismo-negras.jpg', 411, false),
  ('rc-botines-de-cuero-marron', 'Botines de cuero marrón', 'calzado', 'hombre', '{"color":"marrón","color_hex":"#5a3826","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/rc-botines-de-cuero-marron.jpg', 412, false),
  ('rc-bufanda-de-lana-vino', 'Bufanda de lana vino', 'accesorio', 'hombre', '{"color":"vino","color_hex":"#5E2A33","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/rc-bufanda-de-lana-vino.jpg', 413, false),
  ('rc-camisa-azul-rey-de-manga-corta', 'Camisa azul rey de manga corta', 'top', 'hombre', '{"color":"azul","color_hex":"#3B5BA5","temporada":"calor","formalidad":"formal-casual"}', '/archetypes/rc-camisa-azul-rey-de-manga-corta.jpg', 414, false),
  ('rc-camisa-de-lino-esmeralda', 'Camisa de lino esmeralda', 'top', 'hombre', '{"color":"esmeralda","color_hex":"#1F6B4A","temporada":"calor","formalidad":"casual"}', '/archetypes/rc-camisa-de-lino-esmeralda.jpg', 415, false),
  ('rc-chamarra-acolchada-azul-marino', 'Chamarra acolchada azul marino', 'abrigo', 'hombre', '{"color":"azul marino","color_hex":"#1c2333","temporada":"frio","formalidad":"casual"}', '/archetypes/rc-chamarra-acolchada-azul-marino.jpg', 416, false),
  ('rc-chaqueta-negra-con-cierre', 'Chaqueta negra con cierre', 'abrigo', 'hombre', '{"color":"negro","color_hex":"#1a1a1a","temporada":"templado","formalidad":"casual"}', '/archetypes/rc-chaqueta-negra-con-cierre.jpg', 417, false),
  ('rc-gafas-de-sol-negras', 'Gafas de sol negras', 'accesorio', 'hombre', '{"color":"negro","color_hex":"#0F0F0F","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/rc-gafas-de-sol-negras.jpg', 418, false),
  ('rc-gafas-de-sol-wayfarer', 'Gafas de sol wayfarer', 'accesorio', 'hombre', '{"color":"negro","color_hex":"#1c1c1c","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/rc-gafas-de-sol-wayfarer.jpg', 419, false),
  ('rc-jersey-de-mexico-verde', 'Jersey de México verde', 'top', 'hombre', '{"color":"verde","color_hex":"#1B7A3D","temporada":"calor","formalidad":"casual"}', '/archetypes/rc-jersey-de-mexico-verde.jpg', 420, false),
  ('rc-lentes-redondos', 'Lentes redondos', 'accesorio', 'hombre', '{"color":"dorado","color_hex":"#c9a227","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/rc-lentes-redondos.jpg', 421, false),
  ('rc-pantalon-cargo-beige', 'Pantalón cargo beige', 'bottom', 'hombre', '{"color":"beige","color_hex":"#c4b393","temporada":"templado","formalidad":"casual"}', '/archetypes/rc-pantalon-cargo-beige.jpg', 422, false),
  ('rc-pantalon-deportivo-negro', 'Pantalón deportivo negro', 'bottom', 'hombre', '{"color":"negro","color_hex":"#1a1a1a","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/rc-pantalon-deportivo-negro.jpg', 423, false),
  ('rc-playera-azul-marino', 'Playera azul marino', 'top', 'hombre', '{"color":"azul marino","color_hex":"#3a4252","temporada":"calor","formalidad":"casual"}', '/archetypes/rc-playera-azul-marino.jpg', 424, false),
  ('rc-reloj-negro', 'Reloj negro', 'accesorio', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/rc-reloj-negro.jpg', 425, false),
  ('rc-sandalias-de-cuero-negras', 'Sandalias de cuero negras', 'calzado', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"calor","formalidad":"casual"}', '/archetypes/rc-sandalias-de-cuero-negras.jpg', 426, false),
  ('rc-sueter-de-cuello-redondo-vino', 'Suéter de cuello redondo vino', 'top', 'hombre', '{"color":"vino","color_hex":"#5E2A33","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/rc-sueter-de-cuello-redondo-vino.jpg', 427, false),
  ('rc-sueter-de-lana-negro', 'Suéter de lana negro', 'top', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/rc-sueter-de-lana-negro.jpg', 428, false),
  ('rc-tenis-grises', 'Tenis grises', 'calzado', 'hombre', '{"color":"gris","color_hex":"#a7adb5","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/rc-tenis-grises.jpg', 429, false),
  ('rc-tenis-rojos', 'Tenis rojos', 'calzado', 'hombre', '{"color":"rojo","color_hex":"#D62222","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/rc-tenis-rojos.jpg', 430, false),
  ('rc-zapato-derby-de-piel-chocolate', 'Zapato derby de piel chocolate', 'calzado', 'hombre', '{"color":"chocolate","color_hex":"#4B3526","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/rc-zapato-derby-de-piel-chocolate.jpg', 431, false),
  ('rc-guantes-largos', 'Guantes largos', 'accesorio', 'mujer', '{"color":"negro","color_hex":"#000000","temporada":"frio","formalidad":"formal"}', '/archetypes/rc-guantes-largos.jpg', 432, false),
  ('rc-vestido-de-gala-largo', 'Vestido de gala largo', 'vestido', 'mujer', '{"color":"negro","color_hex":"#000000","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/rc-vestido-de-gala-largo.jpg', 433, false),
  ('rc-zapatos-de-tacon-negros', 'Zapatos de tacón negros', 'calzado', 'mujer', '{"color":"negro","color_hex":"#000000","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/rc-zapatos-de-tacon-negros.jpg', 434, false)
on conflict (slug) do nothing;
