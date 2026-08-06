-- Marcas POR LOOK, además del voto por par.
--
-- DE DÓNDE SALE
-- Roberto, tras el primer vistazo real: "no sé si es mejor poner qué modelo
-- gana sobre cada outfit y no sobre cada grupo de 3". Tiene razón en el
-- diagnóstico — un lado con un look excelente y dos flojos se vota igual que
-- uno con tres decentes, y esa diferencia se perdía entera.
--
-- POR QUÉ SE SUMA Y NO SUSTITUYE AL VOTO DEL PAR
-- Los tres looks de un lado salen de UNA sola llamada al motor: no son tres
-- observaciones independientes. Contarlos como tres votos inflaría la
-- significancia (el sign test asume independencia y aquí no la hay), y además
-- emparejar "el look 1 de A contra el look 1 de B" es arbitrario: comparten
-- posición, no intención.
--
-- Así que el VOTO DEL PAR sigue siendo la unidad del veredicto —es también lo
-- que la usuaria ve: el set completo— y las marcas por look son DIAGNÓSTICO:
-- dicen cuál look arrastró la decisión y cuáles sobran, que es justo lo que
-- convierte un voto en una regla.
alter table public.comparador_motor_pares
  add column if not exists marcas_look jsonb;

comment on column public.comparador_motor_pares.marcas_look is
  'Diagnóstico por look: {"<clave de variante>": {"0": "arriba"|"abajo", ...}}. El índice es la posición del look dentro de su lado. NO es la unidad del veredicto (los looks de un lado no son independientes): ver el voto del par.';
