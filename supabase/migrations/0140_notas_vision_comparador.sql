-- La rúbrica que MIRA entra al instrumento pareado.
--
-- POR QUÉ: `scripts/comparador-juzgar.ts` compara A contra B dentro del mismo
-- brief (así la varianza del día se cancela), pero hasta hoy sólo llamaba a la
-- rúbrica de TEXTO — que ve nombres de prenda, no tonos. Para una iteración de
-- regla de COLOR eso es preguntarle por matices a alguien que lee etiquetas.
-- La rúbrica de visión ya existe (rv3) y ya la usan los evales; lo único que
-- faltaba era guardar su nota aquí.
--
-- COLUMNA APARTE Y NO DENTRO DE `notas`: cambiar la forma de `notas` rompería
-- la lectura del marcador para todas las corridas ya juzgadas. Aditivo es el
-- único cambio que deja el histórico comparable, que es justo lo que un
-- instrumento de medición no puede permitirse perder.
--
-- NULL = esta corrida no se juzgó con visión (todas las anteriores a hoy).
alter table public.comparador_motor_lados
  add column if not exists notas_vision jsonb;

comment on column public.comparador_motor_lados.notas_vision is
  'Notas de la rúbrica de visión (rv3), una por look. NULL = corrida juzgada solo con texto.';
