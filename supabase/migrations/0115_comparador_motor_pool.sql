-- La versión del pool de briefs, congelada en la corrida.
--
-- El pool está congelado a propósito para que corridas de meses distintos sean
-- comparables ("los tres retadores resolvieron los mismos días"). Al cambiarlo
-- —los eventos pasaron de "evento" a boda / cena con amigos / comida familiar—
-- esa afirmación deja de valer ENTRE retadores medidos en pools distintos.
--
-- Cada corrida sigue siendo justa consigo misma (control y retador resuelven
-- el mismo día). Esta columna solo evita que la tabla "qué modelo usamos" sume
-- peras con manzanas sin decirlo.
--
-- Las corridas que ya existen son del pool v1: ese es el default.
alter table comparador_motor_corridas
  add column if not exists pool_version text not null default 'v1';
