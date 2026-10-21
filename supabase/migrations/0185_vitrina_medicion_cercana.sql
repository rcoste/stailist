-- 0185 · la medición de la vitrina distingue "la más cercana" (2026-10-21).
--
-- Desde v0.2.408.0 la vitrina, cuando ningún país tiene una prenda exacta,
-- puede enseñar UNA que cede sólo el tono ("la más cercana a azul rey: azul
-- intenso"). La lectura y la medición tienen que separarla de las exactas: una
-- cercana aprobada o tocada no dice lo mismo que una exacta.
alter table public.vitrina_medicion_candidatos
  add column if not exists cercana boolean not null default false,
  add column if not exists tono_cercano text;
