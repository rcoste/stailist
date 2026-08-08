-- QUÉ atributos confirmó la persona — distinto de DE DÓNDE vino la prenda.
--
-- Roberto, al leer la primera versión: "esta certeza genérica, no entiendo
-- eso". Tenía razón en no entenderla, porque estaba mal: `certeza` se usaba
-- para dos cosas a la vez.
--
--   1. De dónde vino la prenda (foto / catálogo / checklist) — un dato de
--      origen, que no cambia nunca.
--   2. Si la persona ya confirmó algún detalle — que sí cambia, atributo por
--      atributo.
--
-- Mezclarlas hacía imposible lo que de verdad importa: si confirma el CORTE de
-- unos jeans del checklist, el motor debería saber que el corte es suyo y que
-- el LARGO sigue siendo del catálogo. Con un solo nivel global no se puede
-- decir eso — o toda la prenda es confiable o ninguna.
--
-- `attrs.confirmados` es una lista: ["corte"]. El origen se queda en `certeza`
-- y vuelve a significar solo eso.
--
-- Los que ya se habían confirmado con la versión anterior (pasaron a
-- 'generica' viniendo del checklist) se recuperan aquí: se les marca el corte
-- como confirmado y se les devuelve su origen real.
update public.items
set attrs = jsonb_set(attrs, '{confirmados}', '["corte"]'::jsonb),
    certeza = 'asumida'
where certeza = 'generica'
  and source = 'archetype'
  and attrs ? 'corte'
  and not (attrs ? 'confirmados')
  -- Solo las del checklist: las que eligió del catálogo a propósito nunca
  -- confirmaron nada y su 'generica' sí es su origen correcto.
  and archetype_id is not null
  and id in (select id from public.items where certeza = 'generica');

comment on column public.items.certeza is
  'De DÓNDE vino la prenda: exacta = su foto leída por la visión · generica = la eligió del catálogo · asumida = la marcó en el checklist. NO dice qué atributos están confirmados — eso vive en attrs.confirmados.';
