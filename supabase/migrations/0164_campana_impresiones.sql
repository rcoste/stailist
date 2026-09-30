-- 0164 · impresiones en el gasto capturado de la campaña.
--
-- El plan P-03 (2026-09-29) pone objetivos de CTR por canal: clics ÷ veces que
-- se mostró el anuncio. /admin/campana ya capturaba clics y costo por día y
-- campaña, pero no las impresiones, así que el CTR sólo se podía leer dentro de
-- cada plataforma y no contra su objetivo. Columna opcional: un día capturado
-- sin impresiones sigue valiendo para todo lo demás y el CTR sale "—".
--
-- Aditiva y nullable: no toca filas existentes ni permisos (la tabla sigue con
-- RLS prendido y sin políticas; sólo la lee Postgres directo con admin).

alter table public.campana_gasto add column if not exists impresiones integer;

comment on column public.campana_gasto.impresiones is
  'Veces que se mostró el anuncio ese día, capturado a mano de la plataforma. Opcional; con clics da el CTR contra el objetivo del plan P-03.';
