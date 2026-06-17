-- Clóset cápsula (Tajada 1): assessment de vida + meta de cápsula derivada.
-- Aditivo y nullable: no toca datos existentes.
--   lifestyle:      respuestas crudas del assessment (jsonb).
--   capsule_target: meta derivada por el LLM una vez (slots categoría×formalidad).
alter table profiles add column if not exists lifestyle jsonb;
alter table profiles add column if not exists capsule_target jsonb;
