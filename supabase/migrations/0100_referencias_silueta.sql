-- La silueta de cada referencia: qué tan pegada al cuerpo va la ropa.
--
-- POR QUÉ HACE FALTA
-- El fit era el hueco más grande del perfil: no hay ninguna pregunta ni columna
-- sobre cómo le gusta a alguien que le quede la ropa. Lo que sí existe
-- (body_type, body_build, body_volume) describe el CUERPO, que es otra cosa —
-- saber que alguien es de complexión ancha no dice si prefiere pierna recta o
-- amplia. El motor llevaba meses adivinándolo, con una regla universal
-- ("evita todo holgado o todo pegado") igual para todas las personas.
--
-- Con la silueta en la referencia, cada familia puede declarar cómo se lleva
-- ("de pierna recta a amplia, nunca ceñida") en vez de heredar esa regla
-- genérica. Y del lado de la usuaria abre medir el gusto con pares de fotos —
-- mismo look, misma paleta, solo cambia la pierna—, que es la única forma
-- honesta: el fit no se declara, se reconoce al verlo.
--
-- Tercera dimensión del mismo patrón: clima (0097), paleta (0099), silueta.
alter table public.referencias
  add column if not exists silueta text
  check (silueta is null or silueta in ('cenida', 'recta', 'holgada'));
