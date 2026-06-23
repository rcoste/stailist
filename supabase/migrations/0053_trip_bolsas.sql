-- Multi-maleta (modelo aerolínea): un viaje puede llevar varias piezas de
-- equipaje (mochila + carry-on + N documentadas), no solo una. `bolsas` guarda
-- las cantidades por tipo, ej. {"mochila":1,"documentada":2}. La capacidad total
-- (techo de prendas) es la suma de (cantidad × maxPiezas) de cada tipo.
--
-- El campo `maleta` (texto, una sola bolsa) se conserva por back-compat: para
-- viajes nuevos se setea a la bolsa dominante; los viajes legacy lo siguen
-- usando hasta que se regeneren. Lectura: normalizeBolsas(bolsas, maleta).
alter table public.trips add column if not exists bolsas jsonb;
