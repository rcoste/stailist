-- 0186 · la medición guarda con qué palabra se buscó cada candidato (2026-10-21).
--
-- Desde v0.2.409.0 la vitrina baja escalones cuando una consulta devuelve cero
-- ("leather ankle boots" → "ankle boots" → "boots" → ブーツ). La pantalla tiene
-- que decir la palabra que de verdad se usó en cada país, no el término de la
-- pieza: "q = boots" no es lo mismo que "q = leather ankle boots".
alter table public.vitrina_medicion_candidatos
  add column if not exists consulta text;
