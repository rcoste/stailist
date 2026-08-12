-- LO QUE LA PERSONA ESCRIBIÓ CON SUS PALABRAS, guardado.
--
-- El wizard tiene un campo libre ("cuéntamelo con tus palabras") desde que se
-- quitó el chip "otro…". Ese texto viajaba al motor y se evaporaba: no existía
-- en ninguna tabla. Consecuencia práctica, medida el 2026-08-12 al intentar
-- decidir si valía la pena construir el issue #232 (una IA que interprete ese
-- campo): NO SE PUEDE SABER cuánta gente lo usa ni qué escribe. Y ese issue
-- exige, como requisito de merge, "20 planes reales revisados por Roberto" —
-- veinte ejemplos que no existían porque nunca se guardó ninguno.
--
-- Sin esta columna, esa feature se construye a ciegas y se calibra contra
-- ejemplos inventados. Con ella, en unas semanas la decisión se contesta con
-- datos: si aparecen bautizos y XV años, la feature se justifica; si el campo
-- resulta ser un cementerio, se ahorran siete horas.
--
-- Se guarda RECORTADO A 200 igual que lo que viaja al motor (lib/engine/
-- contexto.ts:188). La columna debe reflejar lo que el modelo VIO, que es lo
-- que se va a calibrar — guardar más sería guardar algo que nunca influyó en
-- el look.
--
-- Sin RLS propia: `outfits` ya la tiene por fila (política "own outfits"), y
-- este texto es del dueño de la fila como el resto.

alter table public.outfits
  add column if not exists plan text;

comment on column public.outfits.plan is
  'El plan en palabras de la persona (campo libre del wizard), recortado a 200 como lo que viaja al motor. NULL cuando eligió un chip. Sirve para saber qué se le pide de verdad al stylist — sin esto no hay forma de leer la cola larga de planes.';

-- Índice parcial: las consultas de esta columna son siempre "los que SÍ
-- escribieron", una minoría. Sin el WHERE, el índice pesaría lo que la tabla.
create index if not exists outfits_plan_idx
  on public.outfits (user_id, created_at desc)
  where plan is not null;
