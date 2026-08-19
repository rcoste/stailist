-- LOS 3 LOOKS DE UNA GENERACIÓN VIAJAN JUNTOS.
--
-- Roberto (2026-08-19): "actualmente solo mostramos una opción y, si estamos
-- generando dos o tres, no perdemos nada… sino es desperdiciar lo que ya se
-- hizo". Y el desperdicio era literal: generateInto llamaba al generador —que
-- desde v54 produce EXACTAMENTE 3 outfits en la misma llamada, ya pagados—
-- revisaba el primero y TIRABA los otros dos.
--
-- El lazo: los looks alternos de una generación llevan aquí el id del look
-- principal (el placeholder que el cliente ya está polleando). Con eso el GET
-- puede devolver "tu look y sus otras dos opciones" sin adivinar por fechas —
-- adivinar por look_date confundiría los alternos con los descartes de "otro
-- look", que también viven en la fecha de hoy.
alter table public.outfits
  add column if not exists grupo_generacion uuid references public.outfits(id) on delete set null;

create index if not exists outfits_grupo_generacion
  on public.outfits (grupo_generacion) where grupo_generacion is not null;

comment on column public.outfits.grupo_generacion is
  'Para looks alternos de una generación del look del día: el id del look principal del trío. NULL en looks principales y en todo lo anterior a v0.2.263.0.';
