-- Intros de módulo vistas ("tus esenciales" es la primera).
--
-- Por qué medirlo: la intro existe para enseñar una idea que la persona no
-- traía (pocas piezas que combinan rinden más que un clóset lleno). Si resulta
-- que todo el mundo le da a "ver mis esenciales" en dos segundos, la explicación
-- no se está leyendo y hay que replantearla, no alargarla.
--
-- OJO (la trampa de siempre, ya mordió con avatar_judge en 0073, trip_item_swap
-- en 0074 y de nuevo en 0078 y 0090): todo tipo de evento nuevo DEBE agregarse a
-- este CHECK o el insert falla EN SILENCIO — el código no revisa el error del
-- insert de events.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed',
    'colorimetria_edit','critic_review','avatar_generated','style_vetoes_edit',
    'trip_look_vote','another_look','hint_seen','avatar_judge','trip_item_swap',
    'item_deleted','outfit_deleted','trip_deleted','perfil_estilo_view',
    'intro_seen'
  ])
);
