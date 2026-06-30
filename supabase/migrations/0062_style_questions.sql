-- Preguntas de estilo PERSONALIZADAS (generadas por IA según el arquetipo + gustos
-- ya conocidos del usuario) cacheadas en el perfil: { sig, questions[] }. `sig` es la
-- firma del estilo; si cambia (otro arquetipo/gustos) se regeneran. Alimentan el
-- assessment de la cápsula con profundidad de estilo SIN re-preguntar lo genérico.
alter table public.profiles add column if not exists style_questions jsonb;
