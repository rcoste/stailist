-- Taxonomía v2 de referencias: familias generables + la paleta como dimensión.
--
-- EL ERROR QUE CORRIGE
-- La lista v1 de "estilos" mezclaba familias reales (sastre), paletas (tonos
-- tierra) y cualidades (casual effortless) como si fueran alternativas. Medido:
-- de 362 fotos de invierno, tonos-tierra se llevó 52 y sastre 1 — el color le
-- ganaba la casilla a la construcción, porque un abrigo camel sobre traje café
-- es ambas cosas y el clasificador solo podía escoger una.
--
-- El arreglo: el color se vuelve columna (paleta), como ya se hizo con el clima
-- (0097), y las casillas quedan solo para familias con vocabulario de prendas.
-- Las 10 familias viven en scripts/familias.mjs.

-- La paleta del look: qué color manda, independiente de la familia.
alter table public.referencias
  add column if not exists paleta text
  check (paleta is null or paleta in ('tierra', 'neutra', 'oscura', 'color'));

-- Fusiones v1 → v2. Los pares fusionados eran indistinguibles en los datos
-- (clásico-elegante ~ smart-casual: distancia 0.15, la menor de 36 pares;
-- minimalista ~ casual-effortless: misma paleta exacta y ornamento 1.4 vs 1.6).
-- El path del storage NO cambia: es una llave, no una clasificación.
update public.referencias set estilo = 'clasico-arreglado'
  where estilo in ('smart-casual', 'clasico-elegante');
update public.referencias set estilo = 'casual-limpio'
  where estilo in ('minimalista', 'casual-effortless');

-- tonos-tierra y color-protagonista NO se tocan aquí: cada una de sus fotos se
-- re-clasifica por visión (scripts/reclasificar-referencias.mjs) a la familia
-- que le corresponde, llevándose su paleta como dato.
