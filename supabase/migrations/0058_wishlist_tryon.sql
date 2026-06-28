-- Cartera · Fase 3b: cachea el try-on de un item del Wishlist (probárselo en el
-- avatar). Cada try-on cuesta/tarda; se guarda la ruta y no se regenera.
alter table public.wishlist_items add column if not exists tryon_path text;
