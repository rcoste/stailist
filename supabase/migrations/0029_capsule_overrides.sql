-- Cápsula: decisiones del usuario sobre las prendas "parecido" (sí me funciona /
-- no, quiero la ideal). Mapa { "<índice>": "accept" | "reject" }. Aditivo.
alter table profiles add column if not exists capsule_overrides jsonb;
