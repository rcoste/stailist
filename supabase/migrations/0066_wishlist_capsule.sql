-- 0066 · La wishlist acepta prendas SUGERIDAS de la cápsula (lo que te falta),
-- que no tienen foto propia del usuario. Cambios aditivos y seguros:
--   * image_path deja de ser obligatoria (una sugerencia no tiene foto tuya).
--   * capsule_key: identifica la prenda (tipo|color, = faltaKey) para
--     togglear/deduplicar sin depender del nombre.
--   * image_url: referencia pública (render de catálogo) para pintarla.
--   * porque: el motivo de la sugerencia, para mostrarlo en la wishlist.
alter table public.wishlist_items alter column image_path drop not null;
alter table public.wishlist_items add column if not exists capsule_key text;
alter table public.wishlist_items add column if not exists image_url text;
alter table public.wishlist_items add column if not exists porque text;

-- Búsqueda del toggle: ¿ya está esta prenda de cápsula en mi wishlist?
create index if not exists wishlist_items_user_capsule_idx
  on public.wishlist_items (user_id, capsule_key);
