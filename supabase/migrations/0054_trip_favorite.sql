-- Favoritos del Modo Viaje promovidos a outfits reales.
-- Al favoritear un look de viaje, se inserta una fila en outfits para que viva en
-- el Historial junto a los diarios (con un badge "Viaje"). Antes los looks de
-- viaje vivían solo como elementos de trips.outfits (jsonb) y no tenían casa en el
-- historial.
--   source            — 'daily' (diario, default) | 'viaje' (promovido del viaje).
--                       El badge del historial se pinta cuando source = 'viaje'.
--   trip_id           — viaje de origen. on delete set null: borrar el viaje NO
--                       borra tu favorito (ya es un look guardado tuyo); solo
--                       pierde el vínculo. El badge sobrevive vía source.
--   trip_look_index   — índice del look dentro de trips.outfits. (trip_id,
--                       trip_look_index) es la fuente única de verdad del corazón
--                       en la vista del viaje.
alter table public.outfits add column if not exists source text not null default 'daily';
alter table public.outfits add column if not exists trip_id uuid references public.trips (id) on delete set null;
alter table public.outfits add column if not exists trip_look_index int;

-- Un look de viaje se favoritea una sola vez (idempotente): mismo viaje + índice.
create unique index if not exists outfits_trip_look_idx
  on public.outfits (user_id, trip_id, trip_look_index)
  where source = 'viaje';
