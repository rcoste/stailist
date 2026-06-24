-- "Ver los looks que tu cápsula arma": el payoff de la métrica "~N looks".
-- Outfits generados a partir de las prendas que YA TIENES de tu cápsula (los
-- "tienes" del match), con el mismo motor "Sudoku" del viaje. Se cachean en el
-- perfil; capsule_outfits_sig guarda la firma del clóset de cuando se generaron,
-- para saber si quedaron viejos (cambió tu clóset → regenerar).
alter table public.profiles add column if not exists capsule_outfits jsonb;
alter table public.profiles add column if not exists capsule_outfits_sig text;
