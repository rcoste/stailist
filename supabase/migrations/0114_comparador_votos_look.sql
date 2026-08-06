-- Voto POR LOOK, y el del par derivado de ellos.
--
-- Roberto, a media votación del primer veredicto: "yo pensaba que era un par a
-- calificar a la vez, veía la primera y ya le ponía A o B, pero no veía el look
-- uno, dos y tres... ¿por qué se compiten tres contra tres? A final de cuentas
-- tú sacas cuál de esa serie hubiera ganado, termina siendo lo mismo. Para mí
-- me haces más complicado el evaluar."
--
-- Tiene razón: sostener seis looks en la cabeza para emitir un voto es una
-- tarea peor que comparar dos, y el resultado del conjunto SE DERIVA de los
-- individuales. Lo único que había que cuidar era no inflar la estadística —
-- tres sub-votos salen de UNA llamada al motor, no son independientes — y eso
-- se resuelve derivando el voto del par por mayoría: la unidad de la prueba
-- sigue siendo el par.
--
-- {"<índice>": "<clave de variante>" | "empate"}, ya resuelto (nunca izq/der).
alter table public.comparador_motor_pares
  add column if not exists votos_look jsonb;

comment on column public.comparador_motor_pares.votos_look is
  'Voto por look: {"<índice>": "<clave de variante>"|"empate"}. El voto del PAR (columna voto) se deriva de estos por mayoría y sigue siendo la unidad estadística: los looks de un lado no son observaciones independientes.';
