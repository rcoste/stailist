-- Nuevo tipo de evento: 'colorimetria_edit' — cuando la usuaria corrige la
-- estación que el ensemble (Claude+Gemini) le propuso. Es la métrica directa de
-- qué tan bien jala el análisis automático de colorimetría.
alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check check (type in (
  'vote_up','vote_down','worn',
  'onboarding_step','first_outfit_ttv','generation_timing','pwa_prompt_shown','pwa_installed',
  'colorimetria_edit'
));
