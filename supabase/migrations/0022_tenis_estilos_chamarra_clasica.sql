-- Ajuste a referencias reales de Roberto: 2 estilos de tenis adicionales
-- (piel negros minimalistas + retro blanco con detalle azul) y una segunda
-- chamarra de piel negra en estilo clásico (la otra quedó muy moto/rocker).
-- (Los tenis-blancos-urbanos y tenis-deportivos solo se regeneró su imagen para
-- parecerse a AF1 / On Cloud — misma fila, no cambian aquí.)
-- Biblioteca (onboarding_subset=false). Idempotente.

insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('tenis-piel-negros',           'Tenis de piel negros',        'calzado', 'hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/tenis-piel-negros.png',           95, false),
  ('tenis-retro-blanco',          'Tenis retro blanco',          'calzado', 'hombre', '{"color":"blanco","color_hex":"#FAFAF7","temporada":"todo-el-año","formalidad":"casual"}', '/archetypes/tenis-retro-blanco.png',          96, false),
  ('chamarra-piel-negra-clasica', 'Chamarra de piel negra clásica','abrigo','hombre', '{"color":"negro","color_hex":"#1A1A1A","temporada":"templado","formalidad":"casual"}',    '/archetypes/chamarra-piel-negra-clasica.png',97, false)
on conflict (slug) do nothing;
