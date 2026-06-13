-- Lista de mujer (2026-06-13): 5 prendas femeninas con imagen + el zapato
-- formal negro reasignado a hombre (alternativa al café). Las 10 unisex ya
-- sembradas completan los 15 básicos de mujer. UPSERT por slug.

insert into public.archetypes (slug, name, category, attrs, image_path, sort_order, segment) values
  ('cardigan-crema',     'Cardigan crema',     'abrigo',  '{"color":"crema","color_hex":"#EFE6D6","formalidad":"casual","temporada":"templado"}',         '/archetypes/cardigan-crema.png',     25, 'mujer'),
  ('abrigo-camel',       'Abrigo camel',       'abrigo',  '{"color":"camel","color_hex":"#B08D57","formalidad":"formal-casual","temporada":"frio"}',      '/archetypes/abrigo-camel.png',       26, 'mujer'),
  ('falda-midi-negra',   'Falda midi negra',   'bottom',  '{"color":"negro","color_hex":"#1A1A1A","formalidad":"formal-casual","temporada":"todo-el-año"}','/archetypes/falda-midi-negra.png',   27, 'mujer'),
  ('vestido-negro',      'Vestido negro',      'vestido', '{"color":"negro","color_hex":"#1A1A1A","formalidad":"formal-casual","temporada":"todo-el-año"}','/archetypes/vestido-negro.png',      28, 'mujer'),
  ('flats-nude',         'Flats nude',         'calzado', '{"color":"nude","color_hex":"#D9BFA8","formalidad":"formal-casual","temporada":"todo-el-año"}', '/archetypes/flats-nude.png',         29, 'mujer'),
  ('zapato-formal-negro','Zapato formal negro','calzado', '{"color":"negro","color_hex":"#1A1A1A","formalidad":"formal","temporada":"todo-el-año"}',       '/archetypes/zapato-formal-negro.png',30, 'hombre')
on conflict (slug) do update set
  name        = excluded.name,
  category    = excluded.category,
  attrs       = excluded.attrs,
  image_path  = excluded.image_path,
  sort_order  = excluded.sort_order,
  segment     = excluded.segment;
