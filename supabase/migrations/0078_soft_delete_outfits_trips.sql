-- Borrado suave de outfits y viajes (las prendas ya lo tenían desde 0001).
--
-- Por qué suave y no real: un borrado es la señal de rechazo MÁS fuerte que da
-- una usuaria — más que un 👎, porque significa "no lo quiero ni ver". Con el
-- experimento por delante, tirar esa fila sería tirar justo el dato que fuimos
-- a buscar. La fila se queda; deja de mostrarse.
--
-- Lo que YA estaba resuelto y no hace falta tocar:
--   · events.outfit_id es ON DELETE SET NULL → los votos y el "me lo puse"
--     sobreviven de todos modos.
--   · outfits.trip_id es ON DELETE SET NULL → borrar un viaje NO borra sus
--     looks favoritos (decisión de 0054, se respeta).

alter table public.outfits add column if not exists deleted_at timestamptz;
alter table public.trips add column if not exists deleted_at timestamptz;

-- Índices parciales: todas las lecturas de producto filtran deleted_at is null.
create index if not exists outfits_user_vivos_idx
  on public.outfits (user_id, created_at desc) where deleted_at is null;
create index if not exists trips_user_vivos_idx
  on public.trips (user_id, created_at desc) where deleted_at is null;

-- OJO (trap recurrente, ya mordió con avatar_judge en 0073 y trip_item_swap en
-- 0074): todo tipo de evento nuevo DEBE agregarse a este CHECK o el insert
-- falla EN SILENCIO — el código no revisa el error del insert de events.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed',
    'colorimetria_edit','critic_review','avatar_generated','style_vetoes_edit',
    'trip_look_vote','another_look','hint_seen','avatar_judge','trip_item_swap',
    'item_deleted','outfit_deleted','trip_deleted'
  ])
);
