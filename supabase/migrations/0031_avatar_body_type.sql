-- Wizard de avatar digital (issue #1). El usuario sube fotos + elige su tipo de
-- cuerpo con bocetos; generamos una base limpia de cuerpo completo para el
-- try-on. El tipo de cuerpo alimenta el prompt de generación y se guarda para
-- el futuro. Además, nuevo tipo de evento 'avatar_generated' para medir cuántos
-- completan el wizard (el CHECK previo lo rechazaría → logging silenciosamente
-- roto, mismo patrón que la mig 0026).

alter table public.profiles add column if not exists body_type text
  check (body_type in ('slim','athletic','average','full'));

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed',
    'colorimetria_edit','critic_review','avatar_generated'
  ])
);
