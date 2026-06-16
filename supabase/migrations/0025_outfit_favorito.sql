-- Favoritos: marcar un look para guardarlo y volver a verlo. Sello de tiempo
-- (null = no favorito) sirve de flag y de orden. Se consultan en Historial con
-- el filtro "solo favoritos". Distinto del 👍 (eso es feedback de calidad).
alter table public.outfits
  add column if not exists favorited_at timestamptz;
