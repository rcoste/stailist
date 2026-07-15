-- Señal de rechazo por prenda en la maleta (swap "no me late — cámbiala"):
-- evento trip_item_swap {ideal, from, to}. Es el primer rechazo granular real
-- del producto — alimenta el flywheel de reject+regen (motor #4).
--
-- OJO (trap recurrente, ya nos pasó con avatar_judge en 0073): todo tipo de
-- evento nuevo DEBE agregarse aquí o el insert falla en silencio (el código
-- no revisa el error del insert de events).
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed',
    'colorimetria_edit','critic_review','avatar_generated','style_vetoes_edit',
    'trip_look_vote','another_look','hint_seen','avatar_judge','trip_item_swap'
  ])
);
