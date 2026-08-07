-- CUÁNTO SABEMOS DE VERDAD SOBRE CADA PRENDA.
--
-- Roberto: "hoy el motor trata igual 'subí la foto de mis jeans' y 'marqué que
-- tengo jeans'". Cierto — pero al medirlo salió algo peor que un dato faltante:
-- un dato INVENTADO que parece real.
--
-- Al marcar el checklist de básicos, el alta COPIA los atributos del arquetipo
-- del catálogo a la prenda de la persona. O sea que unos "Jeans negros" que
-- ella solo marcó llegan al motor con `corte: recto` — un dato que nadie
-- confirmó y que el motor no puede distinguir de uno leído en su foto. Con eso
-- se alimentan las reglas de proporción y los tips de styling.
--
-- LOS TRES NIVELES:
--   exacta    la persona subió su foto y la visión la leyó → dato duro
--   generica  eligió del catálogo a propósito ("ya tengo esto") → el tipo es
--             suyo, los detalles finos son del arquetipo
--   asumida   marcó el checklist → solo sabemos que TIENE algo de esa familia
--
-- EL BACKFILL ES CONSERVADOR a propósito: todo lo que no venga de foto queda
-- como 'asumida'. Hoy no se puede distinguir el checklist del "ya lo tengo"
-- —los dos escriben source='archetype'— y equivocarse hacia MENOS certeza solo
-- hace al motor más prudente; hacia más, lo hace mentir con seguridad.
alter table public.items add column if not exists certeza text
  check (certeza in ('exacta', 'generica', 'asumida'));

update public.items
  set certeza = case when source = 'photo' then 'exacta' else 'asumida' end
  where certeza is null;

create index if not exists items_certeza on public.items (user_id, certeza);
