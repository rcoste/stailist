-- Modo viaje v1.1: feedback sobre los looks del viaje + frescura.
--   1. trip_look_vote — voto 👍/👎 por look del viaje (señal de si la maleta
--      sirve). Va al CHECK de events. De paso agrego 'another_look' (lo inserta
--      el menú "otro día" del motor diario y se estaba cayendo en silencio).
--   2. trips.outfits_stale — los looks se generan con lo que empacas en ese
--      momento; si después cambias una decisión de empaque, quedan viejos. Esta
--      bandera lo marca para invitar a regenerar (no los borra).

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed',
    'colorimetria_edit','critic_review','avatar_generated','style_vetoes_edit',
    'trip_look_vote','another_look'
  ])
);

alter table public.trips add column if not exists outfits_stale boolean not null default false;
