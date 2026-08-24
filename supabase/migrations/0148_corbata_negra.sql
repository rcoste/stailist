-- LA CORBATA NEGRA (2026-08-24). El funeral la exige por catálogo de eventos
-- ("LA CORBATA VA NEGRA") y no existía ni en el catálogo ni en el clóset de
-- referencia — el motor mandaba looks de luto sin corbata y el juez los
-- marcaba, con razón. Delgada porque la de Roberto es "una corbata negra
-- delgadita". Idempotente.
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('corbata-negra-delgada', 'Corbata negra delgada', 'accesorio', 'hombre', '{"color":"negro","color_hex":"#111111","corte":null,"largo":null,"manga":null,"subtipo":"delgada","temporada":"todo-el-año","formalidad":"formal"}', '/archetypes/corbata-negra-delgada.png', 466, false)
on conflict (slug) do nothing;
