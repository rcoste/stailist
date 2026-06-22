-- "El toque": tip de styling opcional por outfit (cómo llevarlo). Lo produce el
-- juez de estilo. Aditiva, nullable (null = el look está completo, sin tip).
alter table public.outfits add column if not exists tip text;
