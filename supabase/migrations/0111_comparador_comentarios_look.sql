-- Un comentario POR LOOK, no solo por par.
--
-- El 👍/👎 dice CUÁL look arrastró el voto; el comentario dice POR QUÉ, que es
-- lo único que se convierte en regla. Hasta ahora el porqué vivía a nivel del
-- par: servía para explicar la comparación ("gané A porque el otro moja los
-- pies"), pero no para señalar el defecto de un look concreto entre seis.
--
-- COLUMNA APARTE Y NO UN VALOR MÁS RICO EN marcas_look: esa columna ya tiene
-- datos reales de la primera corrida ({"variante": {"0": "arriba"}}), y
-- cambiarle la forma obligaría a migrar juicio del usuario o a tolerar dos
-- formas para siempre. Aditivo es más barato y no toca nada suyo.
--
-- Misma llave que marcas_look: {"<clave de variante>": {"<índice>": "texto"}}.
alter table public.comparador_motor_pares
  add column if not exists comentarios_look jsonb;

comment on column public.comparador_motor_pares.comentarios_look is
  'Por qué, look por look: {"<clave de variante>": {"<índice>": "texto"}}. El índice es la posición del look dentro de su lado. Es la cosecha que se vuelve regla; el 👍/👎 vive en marcas_look.';
