-- Modo viaje multidestino: un viaje puede tener varias paradas. `paradas` guarda
-- cada parada con su lugar, coords, noches (modo "por lugar") y su clima resuelto.
-- Aditivo y seguro: los viajes existentes quedan con paradas = null y la app cae
-- a la columna `lugar` (display) + `weather` (agregado) como hasta ahora.
--
--   paradas: [{ lugar: text, lat?: number, lon?: number, noches?: int,
--               weather?: { temp_c, condition, estimated? } }]
--
-- `lugar` sigue siendo el string de display (paradas unidas) y `weather` el clima
-- agregado del viaje; `paradas` es el detalle por parada.

alter table public.trips
  add column if not exists paradas jsonb;
