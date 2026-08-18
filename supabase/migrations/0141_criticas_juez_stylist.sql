-- El juez que CRITICA guarda sus hallazgos.
--
-- POR QUÉ UNA COLUMNA APARTE de `notas` y `notas_vision`: no es la misma forma
-- de dato. Las dos rúbricas devuelven seis números y una línea; este devuelve
-- una lista de hallazgos {pieza, problema, arreglo, gravedad, defecto}. Meterlo
-- en `notas` obligaría a una forma unión que ningún lector quiere.
--
-- Y aditivo, por lo mismo que la 0140: cambiar la forma de lo ya guardado
-- rompería la comparabilidad del histórico, que es lo único que un instrumento
-- de medición no puede permitirse perder.
--
-- NULL = esta corrida no pasó por el juez stylist (todas las anteriores a hoy).
alter table public.comparador_motor_lados
  add column if not exists criticas jsonb;

comment on column public.comparador_motor_lados.criticas is
  'Críticas del juez stylist (js1), una por look: hallazgos con pieza, problema, arreglo, gravedad y defecto. NULL = corrida sin juez stylist.';
