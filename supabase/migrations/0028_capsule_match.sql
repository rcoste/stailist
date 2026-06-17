-- Cápsula v2: cache del matching (capa 2). Guarda qué prendas de la cápsula
-- ideal ya cubre el clóset, con una firma del clóset para saber cuándo recalcular.
-- Aditivo y nullable.
alter table profiles add column if not exists capsule_match jsonb;
