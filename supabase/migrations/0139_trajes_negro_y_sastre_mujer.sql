-- LOS TRES TRAJES QUE FALTABAN (2026-08-17) — los huecos que dejó abierta la
-- pestaña "Trajes" el día que se shippeó (anotados en TODOS.md, cerrados aquí).
--
-- 1) EL NEGRO DE HOMBRE. Roberto lo pidió por nombre y no existía: había
--    marino, carbón, gris claro, arena, azul claro y esmoquin. El esmoquin NO
--    lo sustituye — `lib/eventos.ts` prohíbe explícitamente el esmoquin en un
--    velorio ("es ropa de CELEBRACIÓN") y en el mismo párrafo exige negro. Sin
--    traje negro, el evento donde más importa no tener que pensar se resolvía
--    con piezas sueltas.
--
-- 2) DOS TRAJES SASTRE DE MUJER. El catálogo tenía once blazers de mujer y
--    CERO pares saco+pantalón, así que la pestaña Trajes —la feature que se
--    acaba de shippear— no le aparecía a ninguna usuaria. Y las usuarias que
--    de verdad entran a la app son mujeres. Es el mismo sesgo que documentó el
--    audit de género de julio: 22 prendas formales de hombre contra 7 de mujer.
--
--    CON CORTE DE MUJER, no un traje de hombre en otra talla (Roberto: "que no
--    parezca traje de hombre sobre mujer"). Los renders se generaron con el
--    corte descrito pieza por pieza —solapa angosta, cintura con pinzas,
--    hombro estrecho, largo a la cadera; pantalón de tiro alto y caída
--    fluida— y se revisaron uno por uno antes de sembrarlos.
--
-- EL LAZO, igual que en la 0137: mismo uuid en las dos piezas, y uuid en vez
-- de llave legible porque el prompt del motor imprime `conjunto.slice(0, 6)`.
-- Los tres nuevos (c0a714 / c0a814 / c0a914) no chocan con los seis de la
-- 0137 (c0a113 … c0a613) en esos primeros seis caracteres.
--
-- AL ONBOARDING los tres: hombre queda con marino, carbón y negro —los tres
-- que pidió Roberto— y mujer estrena la pestaña con negro y marino.
-- Idempotente (on conflict do nothing + updates por slug).

insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
  ('saco-traje-negro', 'Saco de traje negro', 'saco', 'hombre',
   '{"color":"negro","color_hex":"#1A1A1E","subtipo":"sencillo","temporada":"todo-el-año","formalidad":"formal","conjunto":"c0a71435-b0de-4a11-9b71-000000000435"}',
   '/archetypes/saco-traje-negro.png', 435, true),
  ('pantalon-traje-negro', 'Pantalón de traje negro', 'bottom', 'hombre',
   '{"color":"negro","color_hex":"#1A1A1E","subtipo":"con pinzas","temporada":"todo-el-año","formalidad":"formal","conjunto":"c0a71435-b0de-4a11-9b71-000000000435"}',
   '/archetypes/pantalon-traje-negro.png', 436, true),

  ('saco-traje-sastre-negro-m', 'Saco de traje sastre negro', 'saco', 'mujer',
   '{"color":"negro","color_hex":"#1A1A1E","subtipo":"sencillo","temporada":"todo-el-año","formalidad":"formal","conjunto":"c0a81437-b0de-4a11-9b71-000000000437"}',
   '/archetypes/saco-traje-sastre-negro-m.png', 437, true),
  ('pantalon-traje-sastre-negro-m', 'Pantalón de traje sastre negro', 'bottom', 'mujer',
   '{"color":"negro","color_hex":"#1A1A1E","temporada":"todo-el-año","formalidad":"formal","conjunto":"c0a81437-b0de-4a11-9b71-000000000437"}',
   '/archetypes/pantalon-traje-sastre-negro-m.png', 438, true),

  ('saco-traje-sastre-marino-m', 'Saco de traje sastre marino', 'saco', 'mujer',
   '{"color":"azul marino","color_hex":"#26344F","subtipo":"sencillo","temporada":"todo-el-año","formalidad":"formal","conjunto":"c0a91439-b0de-4a11-9b71-000000000439"}',
   '/archetypes/saco-traje-sastre-marino-m.png', 439, true),
  ('pantalon-traje-sastre-marino-m', 'Pantalón de traje sastre marino', 'bottom', 'mujer',
   '{"color":"azul marino","color_hex":"#26344F","temporada":"todo-el-año","formalidad":"formal","conjunto":"c0a91439-b0de-4a11-9b71-000000000439"}',
   '/archetypes/pantalon-traje-sastre-marino-m.png', 440, true)
on conflict (slug) do nothing;
