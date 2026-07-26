-- Athleisure de mujer EN COLOR (2026-07-26). El set athleisure (top deportivo,
-- leggings, biker shorts, joggers, playera y sudadera) existía sólo en negro y
-- gris: cero variedad de color. Se agregan tres colores —olivo · lavanda · crema—
-- sobre las dos piezas héroe (legging + top deportivo) para que se puedan armar
-- conjuntos del mismo tono, que es la firma del athleisure tipo Alo Yoga.
--
-- Los tres colores YA existen en el vocabulario del catálogo (olivo, lavanda,
-- crema) — no se inventan etiquetas que la colorimetría no sepa leer. Los
-- color_hex se muestrearon de la propia foto (región de tela sólida), así que el
-- swatch coincide con la imagen. Imágenes: scripts/gen-archetypes.mjs, tipo
-- "flat-sombra" (prompt validado con sombra de contacto — el crema es prenda
-- clara y con el prompt viejo se lavaba contra el fondo papel).
--
-- onboarding_subset = false: son ampliación de biblioteca, no básicos del
-- onboarding. Entran al final de su categoría (no se renumeran ~60 filas).

-- 1 · Duplicado: "Leggings negros" estaba dos veces (slug leggings-negros +
-- genz-leggings-negros-m), misma prenda y mismo color. Se conserva el genz (su
-- foto es la mejor: mate, cintura alta, 900px) y hereda los atributos ricos
-- (corte/largo) del que se va. El guard de items es por si alguien lo adoptó
-- entre que se verificó (0 usos) y que corre esto: entonces NO se borra.
update public.archetypes
   set attrs = attrs || '{"corte":"entallado","largo":"largo"}'::jsonb
 where slug = 'genz-leggings-negros-m';

delete from public.archetypes a
 where a.slug = 'leggings-negros'
   and not exists (select 1 from public.items i where i.archetype_id = a.id);

-- 2 · Los tres colores, en legging y en top (conjuntos posibles).
insert into public.archetypes
  (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset)
values
  ('leggings-deportivos-olivo-m', 'Leggings deportivos olivo', 'bottom', 'mujer',
   '{"color":"olivo","corte":"entallado","largo":"largo","color_hex":"#7B7C60","temporada":"todo-el-año","formalidad":"casual"}'::jsonb,
   '/archetypes/leggings-deportivos-olivo-m.png', 404, false),

  ('leggings-deportivos-lavanda-m', 'Leggings deportivos lavanda', 'bottom', 'mujer',
   '{"color":"lavanda","corte":"entallado","largo":"largo","color_hex":"#C5ADC8","temporada":"todo-el-año","formalidad":"casual"}'::jsonb,
   '/archetypes/leggings-deportivos-lavanda-m.png', 405, false),

  ('leggings-deportivos-crema-m', 'Leggings deportivos crema', 'bottom', 'mujer',
   '{"color":"crema","corte":"entallado","largo":"largo","color_hex":"#E0D7C4","temporada":"todo-el-año","formalidad":"casual"}'::jsonb,
   '/archetypes/leggings-deportivos-crema-m.png', 406, false),

  ('top-deportivo-olivo-m', 'Top deportivo olivo', 'top', 'mujer',
   '{"color":"olivo","corte":"entallado","largo":"crop","manga":"sin","color_hex":"#7B7C60","temporada":"calor","formalidad":"casual"}'::jsonb,
   '/archetypes/top-deportivo-olivo-m.png', 407, false),

  ('top-deportivo-lavanda-m', 'Top deportivo lavanda', 'top', 'mujer',
   '{"color":"lavanda","corte":"entallado","largo":"crop","manga":"sin","color_hex":"#C5ADC8","temporada":"calor","formalidad":"casual"}'::jsonb,
   '/archetypes/top-deportivo-lavanda-m.png', 408, false),

  ('top-deportivo-crema-m', 'Top deportivo crema', 'top', 'mujer',
   '{"color":"crema","corte":"entallado","largo":"crop","manga":"sin","color_hex":"#E0D7C4","temporada":"calor","formalidad":"casual"}'::jsonb,
   '/archetypes/top-deportivo-crema-m.png', 409, false)
on conflict do nothing;
