-- Los defectos, POR LOOK.
--
-- Nacieron por lado (`defectos` = {"<variante>": ["clima","color"]}) cuando el
-- voto también era por lado. Desde que hay 👍/👎 y comentario por look, quedaron
-- fuera de lugar: en la pantalla se pintaban al fondo de la columna, después de
-- los tres looks, y Roberto los leía como si aplicaran a los tres. No aplicaban
-- a ninguno en particular, que es peor.
--
-- Misma llave que marcas_look y comentarios_look:
--   {"<clave de variante>": {"<índice>": ["clima","color"]}}
--
-- La columna vieja se queda con sus datos (una corrida ya la usó) y el marcador
-- lee las dos; no vale la pena migrar juicio de usuario por consistencia.
alter table public.comparador_motor_pares
  add column if not exists defectos_look jsonb;

comment on column public.comparador_motor_pares.defectos_look is
  'Defectos por look: {"<clave de variante>": {"<índice>": ["clave de defecto"]}}. Reemplaza a `defectos` (que era por lado); las dos se leen al sumar el marcador.';
