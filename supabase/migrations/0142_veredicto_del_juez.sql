-- CALIFICAR AL JUEZ, que es la única medición que el juez no puede hacer solo.
--
-- El cruce de la primera ronda votada (283d8d44) dio el número que motiva esto:
-- de 32 looks, Roberto y el juez coincidieron en 5, hubo 0 donde él marcara algo
-- que el juez no viera, y **20 donde el juez marcó y él no**. Ese 20 es el que
-- decide si el juez sirve: puede ser que vea lo que Roberto da por bueno, o que
-- esté inventando problemas. Nadie lo sabe, porque no había dónde anotarlo.
--
-- LO QUE SE GUARDA NO ES UNA OPINIÓN SOBRE EL LOOK — para eso están
-- `marcas_look` y `defectos_look`. Es una opinión sobre el HALLAZGO: "aquí el
-- juez tiene razón" / "aquí se pasó". Con eso, cada ronda votada recalibra al
-- juez, y el día que "sólo el juez lo vio" deje de acumular exageraciones, el
-- juez se ganó correr sin nadie mirando.
--
-- VIVE APARTE DE `prefs_look` Y DE `votos_look` por la misma razón que ellas
-- viven aparte entre sí (ver 0114 y 0116): el voto se emite A CIEGAS y sella el
-- resultado; esto se anota DESPUÉS, con el marcador y los hallazgos a la vista,
-- y no toca `voto` ni la regla pre-registrada. Es una tercera lectura, sobre un
-- objeto distinto.
--
-- Forma: {"<variante>": {"<índice de look>": {"v": "acuerdo"|"exagero", "nota": "…"}}}
--   acuerdo → el hallazgo es real, el juez hizo su trabajo
--   exagero → el hallazgo no es un problema; el juez está siendo pedante
-- Resuelta a la variante real: el ciego ya no aplica (el par está votado).
alter table comparador_motor_pares
  add column if not exists veredictos_juez jsonb;

comment on column comparador_motor_pares.veredictos_juez is
  'Calificación de Roberto AL HALLAZGO del juez, por look: {"<variante>":{"<índice>":{"v":"acuerdo"|"exagero","nota":"…"}}}. Se anota tras el voto, con los hallazgos a la vista. NO toca voto ni la regla pre-registrada — mide al juez, no al look.';
