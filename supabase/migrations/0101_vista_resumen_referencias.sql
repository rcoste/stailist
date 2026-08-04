-- El conteo del panel del destilador, agregado en la base.
--
-- POR QUÉ UNA VISTA
-- El panel traía TODAS las filas (estilo, sirve) y contaba en JS. Supabase
-- corta en 1,000 filas y ese corte es un límite del SERVIDOR (Max Rows de
-- PostgREST): un range() explícito tampoco lo pasa — se probó y siguió
-- devolviendo 1,000. Al llegar la tabla a 1,070, dos familias desaparecieron
-- del panel con 20 fotos pendientes adentro, y la pantalla decía "no queda
-- nada por curar".
--
-- La vista devuelve UNA fila por familia: el volumen ya no importa.
--
-- security_invoker: la vista corre con los permisos de quien consulta, así que
-- la RLS de referencias (solo admin) aplica igual. Sin esto, la vista correría
-- como su dueño y sería un hoyo alrededor de la política.
create or replace view public.referencias_resumen
with (security_invoker = true) as
select
  genero,
  estilo,
  count(*)::int as total,
  count(sirve)::int as juzgadas,
  (count(*) filter (where sirve))::int as sirven
from public.referencias
group by genero, estilo;
