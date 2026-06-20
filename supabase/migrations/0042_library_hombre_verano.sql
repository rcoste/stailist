-- Ampliación biblioteca HOMBRE (2026-06-19). 6 prendas que faltaban de la lista
-- de Roberto: lino gris/marino, bermudas sastre marino/carbón, short de baño,
-- camisa de lino marino. (Calcetines omitidos a propósito.) Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('pantalon-lino-gris', 'Pantalón de lino gris', 'bottom', 'hombre', '{"color":"gris claro","color_hex":"#C5C7CA","temporada":"calor","formalidad":"casual"}', '/archetypes/pantalon-lino-gris.png', 234, false),
  ('pantalon-lino-marino', 'Pantalón de lino marino', 'bottom', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"calor","formalidad":"casual"}', '/archetypes/pantalon-lino-marino.png', 235, false),
  ('bermuda-sastre-marino', 'Bermuda sastre marino', 'bottom', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"calor","formalidad":"formal-casual"}', '/archetypes/bermuda-sastre-marino.png', 236, false),
  ('bermuda-sastre-carbon', 'Bermuda sastre carbón', 'bottom', 'hombre', '{"color":"carbón","color_hex":"#3A3B3F","temporada":"calor","formalidad":"formal-casual"}', '/archetypes/bermuda-sastre-carbon.png', 237, false),
  ('short-bano-marino', 'Short de baño marino', 'bottom', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"calor","formalidad":"casual"}', '/archetypes/short-bano-marino.png', 238, false),
  ('camisa-lino-marino', 'Camisa de lino marino', 'top', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"calor","formalidad":"casual"}', '/archetypes/camisa-lino-marino.png', 239, false)
on conflict (slug) do nothing;
