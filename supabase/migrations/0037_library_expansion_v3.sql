-- Ampliación biblioteca v3 (2026-06-19). 6 prendas de la lista de Roberto que
-- faltaban (turtleneck negro, abrigo charcoal, cinturón negro, blazer marino y
-- overshirt oliva ya estaban). Todas hombre. onboarding_subset=false. Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('sueter-half-zip-marino', 'Suéter half-zip marino', 'top', 'hombre', '{"color":"azul marino","color_hex":"#27425F","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-half-zip-marino.png', 171, false),
  ('sueter-crewneck-verde-bosque', 'Suéter crewneck verde bosque', 'top', 'hombre', '{"color":"verde","color_hex":"#2E4636","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-crewneck-verde-bosque.png', 172, false),
  ('chamarra-impermeable-ligera', 'Chamarra impermeable ligera', 'abrigo', 'hombre', '{"color":"gris","color_hex":"#4A4E54","temporada":"templado","formalidad":"casual"}', '/archetypes/chamarra-impermeable-ligera.png', 173, false),
  ('bufanda-lana-negra', 'Bufanda de lana negra', 'accesorio', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"casual"}', '/archetypes/bufanda-lana-negra.png', 174, false),
  ('guantes-piel-negros', 'Guantes de piel negros', 'accesorio', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"frio","formalidad":"formal-casual"}', '/archetypes/guantes-piel-negros.png', 175, false),
  ('camiseta-termica', 'Camiseta térmica', 'top', 'hombre', '{"color":"negro","color_hex":"#2A2A2D","temporada":"frio","formalidad":"casual"}', '/archetypes/camiseta-termica.png', 176, false)
on conflict (slug) do nothing;
