-- CONTEXTO DE USO como atributo real de la prenda (attrs.contexto).
--
-- Hasta ahora, "esto no es ropa de calle" se deducía del NOMBRE con expresiones
-- regulares (lib/engine/capsule-match: contextoUso). Funciona, pero el nombre es
-- frágil: alguien renombra su bikini a "Marino dos piezas" y el guard deja de
-- verlo. El atributo es el dato autoritativo; el texto queda de respaldo para las
-- prendas viejas y las descritas a mano.
--
-- Valores: 'bano' | 'gym' | 'dormir' | 'interior'. Ausente o null = ropa de
-- calle, que es el caso normal y por eso NO se marca nada.
--
-- ALCANCE DELIBERADAMENTE CORTO — solo se marca lo de BAÑO. En la biblioteca hay
-- 24 prendas que suenan a "no calle", pero la mayoría son ATHLEISURE (leggings,
-- joggers, sudaderas y tops deportivos) y esa ropa HOY ES ROPA DE CALLE: se
-- sembraron a propósito, a pedido de Roberto, para que el motor las use en looks
-- normales. Marcarlas 'gym' las sacaría de esos looks y desharía ese trabajo.
-- Los tenis "deportivos" son calzado de calle por el mismo motivo.
-- El único caso inequívoco —y el que causó el bug real— es el de baño.
-- Si algún día se quiere marcar gym, se hace prenda por prenda, no por la
-- palabra "deportivo".

-- 1. Biblioteca: las 5 prendas de baño.
update public.archetypes
set attrs = coalesce(attrs, '{}'::jsonb) || '{"contexto":"bano"}'::jsonb
where slug in (
  'short-bano-marino',
  'short-bano-negro-h',
  'short-bano-estampado-h',
  'bikini-negro-m',
  'una-pieza-negro-m'
);

-- 2. Prendas de usuarios que vienen de esos arquetipos: heredan el contexto.
--    (loadClosetLite lee attrs de la PRENDA, no del arquetipo, por eso se copia.)
update public.items i
set attrs = coalesce(i.attrs, '{}'::jsonb) || '{"contexto":"bano"}'::jsonb
from public.archetypes a
where a.id = i.archetype_id
  and a.attrs->>'contexto' = 'bano'
  and i.attrs->>'contexto' is distinct from 'bano';

-- 3. Prendas descritas a mano cuyo nombre no deja lugar a dudas. Se usan solo los
--    términos inequívocos del guard de código — nada de "deportivo", que es
--    ambiguo y marcaría ropa de calle.
update public.items
set attrs = coalesce(attrs, '{}'::jsonb) || '{"contexto":"bano"}'::jsonb
where archetype_id is null
  and deleted_at is null
  and attrs->>'contexto' is null
  and (
    attrs->>'nombre' ilike '%bikini%'
    or attrs->>'nombre' ilike '%traje de baño%'
    or attrs->>'nombre' ilike '%bañador%'
  );
