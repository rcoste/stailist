-- Variedad mujer (2026-06-19). 3 clásicas restauradas como piezas aparte (gala,
-- blusa drapeada, falda lápiz clásica) + 12 prendas nuevas en rango de estilos
-- (romántico, casual, edgy, statement, siluetas distintas). Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('vestido-rojo-gala', 'Vestido rojo de gala', 'vestido', 'mujer', '{"color":"rojo","color_hex":"#9B2C2C","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/vestido-rojo-gala.png', 219, false),
  ('blusa-seda-drapeada', 'Blusa de seda drapeada', 'top', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/blusa-seda-drapeada.png', 220, false),
  ('falda-lapiz-clasica', 'Falda lápiz clásica', 'bottom', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/falda-lapiz-clasica.png', 221, false),
  ('blusa-holanes-blanca', 'Blusa de holanes blanca', 'top', 'mujer', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"calor","formalidad":"formal-casual"}', '/archetypes/blusa-holanes-blanca.png', 222, false),
  ('top-encaje-negro', 'Top de encaje negro', 'top', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/top-encaje-negro.png', 223, false),
  ('falda-gasa-floral', 'Falda midi de gasa floral', 'bottom', 'mujer', '{"color":"floral","color_hex":"#C98B9A","temporada":"calor","formalidad":"casual"}', '/archetypes/falda-gasa-floral.png', 224, false),
  ('hoodie-oversize-gris-mujer', 'Hoodie oversize gris', 'top', 'mujer', '{"color":"gris","color_hex":"#9AA0A6","temporada":"frio","formalidad":"casual"}', '/archetypes/hoodie-oversize-gris-mujer.png', 225, false),
  ('sudadera-crema-mujer', 'Sudadera crema', 'top', 'mujer', '{"color":"crema","color_hex":"#E8E1D4","temporada":"frio","formalidad":"casual"}', '/archetypes/sudadera-crema-mujer.png', 226, false),
  ('chamarra-acolchada-cropped-mujer', 'Chamarra acolchada cropped', 'abrigo', 'mujer', '{"color":"negro","color_hex":"#1F1F22","temporada":"frio","formalidad":"casual"}', '/archetypes/chamarra-acolchada-cropped-mujer.png', 227, false),
  ('falda-cuero-mini-negra', 'Falda de cuero mini', 'bottom', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/falda-cuero-mini-negra.png', 228, false),
  ('blazer-estructurado-negro-mujer', 'Blazer estructurado negro', 'abrigo', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/blazer-estructurado-negro-mujer.png', 229, false),
  ('vestido-lentejuelas-negro', 'Vestido de lentejuelas negro', 'vestido', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/vestido-lentejuelas-negro.png', 230, false),
  ('maxi-vestido-negro', 'Maxi vestido negro', 'vestido', 'mujer', '{"color":"negro","color_hex":"#1A1A1A","temporada":"calor","formalidad":"casual"}', '/archetypes/maxi-vestido-negro.png', 231, false),
  ('pantalon-palazzo-crema', 'Pantalón palazzo crema', 'bottom', 'mujer', '{"color":"crema","color_hex":"#E8E1D4","temporada":"todo-el-año","formalidad":"formal-casual"}', '/archetypes/pantalon-palazzo-crema.png', 232, false),
  ('sueter-oversize-crema', 'Suéter oversize crema', 'top', 'mujer', '{"color":"crema","color_hex":"#E8E1D4","temporada":"frio","formalidad":"casual"}', '/archetypes/sueter-oversize-crema.png', 233, false)
on conflict (slug) do nothing;
