-- Los atributos completos de la prenda de la wishlist.
--
-- Al subir una foto ya se analiza (nombre, categoría, color, material,
-- formalidad, temporada…), pero solo se guardaban el nombre y el color: el resto
-- se tiraba. Sin categoría no se puede pasar la prenda al clóset cuando la
-- compras — el clóset necesita saber si es un top o un calzado para armar looks.
--
-- Nullable a propósito: las filas viejas y las que vienen de la cápsula
-- (source='capsule', sin foto propia) no lo tienen, y el "ya la compré" solo se
-- ofrece cuando sí hay atributos.
alter table public.wishlist_items
  add column if not exists attrs jsonb;

comment on column public.wishlist_items.attrs is
  'Análisis de /api/analizar-prenda al subir la foto (PrendaAnalisis). Lo usa "ya la compré" para crear la prenda en el clóset sin volver a analizar.';
