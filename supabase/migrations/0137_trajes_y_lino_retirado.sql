-- TRES COSAS DEL CATÁLOGO, todas del mismo recorrido de Roberto por el flujo
-- desde cero (2026-08-17).
--
-- 1) RETIRAR UNA PRENDA SIN BORRARLA. La "Camisa de lino" (id 32, beige sucio
--    sobre fondo beige) se ve lavada y estaba en el subset del onboarding.
--    Roberto: "está horrible el color, bórrala de la base". Borrar la FILA no
--    se puede: cinco prendas de usuarios reales cuelgan de ella por
--    items.archetype_id y la FK no tiene ON DELETE. Y no hace falta: el
--    catálogo necesitaba lo que las otras tres entidades de la app ya tienen
--    (prendas, outfits, viajes) — un borrado suave. Con `deleted_at` la prenda
--    desaparece de todas las puertas de alta y las cinco que ya existen siguen
--    intactas (copian nombre e imagen al insertarse, no leen el arquetipo).
--
-- 2) EL TRAJE SE AÑADE COMO TRAJE. Hoy el saco y el pantalón del mismo traje
--    viven en pestañas distintas y hay que cazarlos por separado. Peor que
--    incómodo: al entrar sueltos, nada dice que son un traje, y la regla
--    `traje-desparejado` del motor (prompt v7) castiga exactamente eso — saco y
--    pantalón de vestir del mismo tono. O sea que marcar tu traje en la
--    biblioteca te lo volvía inservible.
--
--    El mecanismo ya existía para las fotos: `attrs.conjunto`, el mismo id en
--    las dos piezas (lib/traje.ts, lib/par-de-traje.ts). Aquí se le pone al
--    CATÁLOGO, y como las dos altas —saveCloset y addArchetypes— copian los
--    attrs del arquetipo tal cual, el lazo viaja solo hasta la prenda del
--    usuario. La UI lo lee para pintar un traje como UNA tarjeta.
--
--    POR QUÉ UUID Y NO UNA LLAVE LEGIBLE ('traje-gris-carbon'): el prompt del
--    motor imprime `parte del conjunto ${conjunto.slice(0, 6)}` — con llaves
--    legibles, "gris carbón" y "gris claro" llegarían al modelo como el MISMO
--    conjunto ("gris-c") y aparejaría el saco de un traje con el pantalón del
--    otro. Los seis primeros caracteres de estos uuid son distintos entre sí.
--
-- 3) DOS TRAJES EN EL ONBOARDING. Sólo entraba el saco carbón (sin su
--    pantalón, así que ni siquiera se podía marcar el traje completo). Entran
--    los dos pares más comunes: marino y gris carbón.

-- 1 ─────────────────────────────────────────────────────────────────────────
alter table public.archetypes add column if not exists deleted_at timestamptz;

comment on column public.archetypes.deleted_at is
  'Retirada del catálogo (borrado suave). Las prendas de usuario que ya la referencian siguen vivas; las puertas de alta la filtran.';

update public.archetypes
set deleted_at = coalesce(deleted_at, now()), onboarding_subset = false
where slug = 'camisa-lino';

-- Su reemplazo en el onboarding: la misma prenda en blanco, que ya existía en
-- la biblioteca. Toma el hueco (sort_order) de la retirada para no reordenar.
update public.archetypes
set onboarding_subset = true, sort_order = 17
where slug = 'camisa-lino-blanca';

-- 2 ─────────────────────────────────────────────────────────────────────────
update public.archetypes a
set attrs = a.attrs || jsonb_build_object('conjunto', t.conjunto)
from (values
  ('saco-traje-marino',      'c0a11319-b0de-4a11-9b71-000000000319'),
  ('pantalon-traje-marino',  'c0a11319-b0de-4a11-9b71-000000000319'),
  ('saco-traje-carbon',      'c0a21321-b0de-4a11-9b71-000000000321'),
  ('pantalon-traje-carbon',  'c0a21321-b0de-4a11-9b71-000000000321'),
  ('saco-traje-gris-claro',      'c0a31323-b0de-4a11-9b71-000000000323'),
  ('pantalon-traje-gris-claro',  'c0a31323-b0de-4a11-9b71-000000000323'),
  ('saco-traje-arena',       'c0a41325-b0de-4a11-9b71-000000000325'),
  ('pantalon-traje-arena',   'c0a41325-b0de-4a11-9b71-000000000325'),
  ('saco-traje-azul-claro',      'c0a51327-b0de-4a11-9b71-000000000327'),
  ('pantalon-traje-azul-claro',  'c0a51327-b0de-4a11-9b71-000000000327'),
  ('saco-smoking-negro',     'c0a61329-b0de-4a11-9b71-000000000329'),
  ('pantalon-smoking-negro', 'c0a61329-b0de-4a11-9b71-000000000329')
) as t(slug, conjunto)
where a.slug = t.slug;

-- 3 ─────────────────────────────────────────────────────────────────────────
update public.archetypes
set onboarding_subset = true
where slug in (
  'saco-traje-marino', 'pantalon-traje-marino',
  'saco-traje-carbon', 'pantalon-traje-carbon'
);
