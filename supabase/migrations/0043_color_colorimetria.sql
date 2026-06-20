-- Batch de COLOR por estación de colorimetría (2026-06-19). 20 prendas para
-- desbloquear la colorimetría: invierno (rojo/cobalto/esmeralda), otoño
-- (mostaza/óxido/oliva/teal), primavera (coral/durazno/amarillo/turquesa),
-- verano (azul empolvado/lavanda/rosa polvo/salvia). Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('sueter-rojo-mujer', 'Suéter rojo', 'top', 'mujer', '{"color":"rojo","color_hex":"#C8102E","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-rojo-mujer.png', 240, false),
  ('blusa-cobalto-mujer', 'Blusa cobalto', 'top', 'mujer', '{"color":"cobalto","color_hex":"#0047AB","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/blusa-cobalto-mujer.png', 241, false),
  ('vestido-esmeralda-mujer', 'Vestido esmeralda', 'vestido', 'mujer', '{"color":"esmeralda","color_hex":"#1E6B52","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/vestido-esmeralda-mujer.png', 242, false),
  ('sueter-cobalto-hombre', 'Suéter cobalto', 'top', 'hombre', '{"color":"cobalto","color_hex":"#0047AB","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-cobalto-hombre.png', 243, false),
  ('polo-rojo-hombre', 'Polo rojo', 'top', 'hombre', '{"color":"rojo","color_hex":"#C8102E","temporada":"calor","formalidad":"casual"}', '/archetypes/polo-rojo-hombre.png', 244, false),
  ('sueter-mostaza-mujer', 'Suéter mostaza', 'top', 'mujer', '{"color":"mostaza","color_hex":"#C99700","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-mostaza-mujer.png', 245, false),
  ('blusa-oxido-mujer', 'Blusa óxido', 'top', 'mujer', '{"color":"óxido","color_hex":"#A0522D","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/blusa-oxido-mujer.png', 246, false),
  ('vestido-oliva-mujer', 'Vestido oliva', 'vestido', 'mujer', '{"color":"oliva","color_hex":"#6B6B3A","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/vestido-oliva-mujer.png', 247, false),
  ('sueter-teal-hombre', 'Suéter teal', 'top', 'hombre', '{"color":"teal","color_hex":"#2A6F6F","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-teal-hombre.png', 248, false),
  ('camisa-oxido-hombre', 'Camisa óxido', 'top', 'hombre', '{"color":"óxido","color_hex":"#A0522D","temporada":"calor","formalidad":"casual"}', '/archetypes/camisa-oxido-hombre.png', 249, false),
  ('blusa-coral-mujer', 'Blusa coral', 'top', 'mujer', '{"color":"coral","color_hex":"#FF6F61","temporada":"calor","formalidad":"formal-casual"}', '/archetypes/blusa-coral-mujer.png', 250, false),
  ('sueter-durazno-mujer', 'Suéter durazno', 'top', 'mujer', '{"color":"durazno","color_hex":"#FFB07C","temporada":"templado","formalidad":"casual"}', '/archetypes/sueter-durazno-mujer.png', 251, false),
  ('vestido-amarillo-mujer', 'Vestido amarillo', 'vestido', 'mujer', '{"color":"amarillo","color_hex":"#F2C14E","temporada":"calor","formalidad":"casual"}', '/archetypes/vestido-amarillo-mujer.png', 252, false),
  ('polo-coral-hombre', 'Polo coral', 'top', 'hombre', '{"color":"coral","color_hex":"#FF6F61","temporada":"calor","formalidad":"casual"}', '/archetypes/polo-coral-hombre.png', 253, false),
  ('camisa-turquesa-hombre', 'Camisa turquesa', 'top', 'hombre', '{"color":"turquesa","color_hex":"#40B5AD","temporada":"calor","formalidad":"casual"}', '/archetypes/camisa-turquesa-hombre.png', 254, false),
  ('blusa-azul-empolvado-mujer', 'Blusa azul empolvado', 'top', 'mujer', '{"color":"azul empolvado","color_hex":"#9DB4C0","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/blusa-azul-empolvado-mujer.png', 255, false),
  ('vestido-lavanda-mujer', 'Vestido lavanda', 'vestido', 'mujer', '{"color":"lavanda","color_hex":"#B9A7CE","temporada":"calor","formalidad":"casual"}', '/archetypes/vestido-lavanda-mujer.png', 256, false),
  ('sueter-rosa-polvo-mujer', 'Suéter rosa polvo', 'top', 'mujer', '{"color":"rosa polvo","color_hex":"#D8A1A8","temporada":"templado","formalidad":"casual"}', '/archetypes/sueter-rosa-polvo-mujer.png', 257, false),
  ('camisa-azul-empolvado-hombre', 'Camisa azul empolvado', 'top', 'hombre', '{"color":"azul empolvado","color_hex":"#9DB4C0","temporada":"calor","formalidad":"casual"}', '/archetypes/camisa-azul-empolvado-hombre.png', 258, false),
  ('polo-salvia-hombre', 'Polo salvia', 'top', 'hombre', '{"color":"salvia","color_hex":"#9CAF88","temporada":"calor","formalidad":"casual"}', '/archetypes/polo-salvia-hombre.png', 259, false)
on conflict (slug) do nothing;
