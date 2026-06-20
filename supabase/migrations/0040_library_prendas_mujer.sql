-- Ampliación biblioteca MUJER — PRENDAS (2026-06-19, sin accesorios). 13 piezas:
-- camisa oxford, suéteres camel/vino, blusa seda, falda lápiz, culotte, enterizo,
-- vestidos camisero/rojo/lápiz, trench negro, chaleco acolchado, sandalias tacón.
-- onboarding_subset=false. Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('camisa-oxford-blanca-mujer', 'Camisa oxford blanca', 'top', 'mujer', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/camisa-oxford-blanca-mujer.png', 206, false),
  ('sueter-crewneck-camel-mujer', 'Suéter crewneck camel', 'top', 'mujer', '{"color":"camel","color_hex":"#B89968","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-crewneck-camel-mujer.png', 207, false),
  ('sueter-vino-mujer', 'Suéter vino', 'top', 'mujer', '{"color":"vino","color_hex":"#5C2A2E","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-vino-mujer.png', 208, false),
  ('blusa-seda-negra', 'Blusa de seda negra', 'top', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/blusa-seda-negra.png', 209, false),
  ('falda-lapiz-negra', 'Falda lápiz negra', 'bottom', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/falda-lapiz-negra.png', 210, false),
  ('pantalon-culotte-negro', 'Pantalón culotte', 'bottom', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/pantalon-culotte-negro.png', 211, false),
  ('enterizo-negro', 'Enterizo negro', 'vestido', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/enterizo-negro.png', 212, false),
  ('vestido-camisero-blanco', 'Vestido camisero blanco', 'vestido', 'mujer', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"calor","formalidad":"casual"}', '/archetypes/vestido-camisero-blanco.png', 213, false),
  ('vestido-rojo', 'Vestido rojo', 'vestido', 'mujer', '{"color":"rojo","color_hex":"#9B2C2C","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/vestido-rojo.png', 214, false),
  ('vestido-lapiz-negro', 'Vestido lápiz negro', 'vestido', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/vestido-lapiz-negro.png', 215, false),
  ('trench-negro-mujer', 'Trench negro', 'abrigo', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"templado","formalidad":"formal-casual"}', '/archetypes/trench-negro-mujer.png', 216, false),
  ('chaleco-acolchado-mujer', 'Chaleco acolchado', 'abrigo', 'mujer', '{"color":"negro","color_hex":"#1F1F22","temporada":"frio","formalidad":"casual"}', '/archetypes/chaleco-acolchado-mujer.png', 217, false),
  ('sandalias-tacon-nude', 'Sandalias de tacón', 'calzado', 'mujer', '{"color":"nude","color_hex":"#D8B89A","temporada":"calor","formalidad":"formal"}', '/archetypes/sandalias-tacon-nude.png', 218, false)
on conflict (slug) do nothing;
