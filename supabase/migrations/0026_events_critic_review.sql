-- El CHECK de events.type no incluía 'critic_review' (lo agregó el juez en el
-- commit del flywheel). Al insertar un batch con ese tipo, Postgres rechazaba
-- TODA la inserción (incluido generation_timing) y el código lo ignoraba →
-- logging silenciosamente roto. Se agrega el tipo permitido.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up', 'vote_down', 'worn', 'onboarding_step', 'first_outfit_ttv',
    'generation_timing', 'pwa_prompt_shown', 'pwa_installed',
    'colorimetria_edit', 'critic_review'
  ])
);
