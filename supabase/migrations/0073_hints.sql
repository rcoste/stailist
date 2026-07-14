-- Hints contextuales (walkthrough just-in-time): cada tip se muestra UNA vez.
-- hints_seen = { "<hint_id>": "<iso>" } — en el perfil (cross-device, no por
-- dispositivo). Evento 'hint_seen' para medir si los tips llevan a los módulos.
alter table public.profiles
  add column if not exists hints_seen jsonb not null default '{}'::jsonb;

-- Suma 'hint_seen' y de paso 'avatar_judge': el código lo inserta desde el fix
-- de avatar pero NUNCA estuvo en el constraint → esos eventos se perdían en
-- silencio (0 filas en prod). Bug pre-existente, saldado aquí.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed',
    'colorimetria_edit','critic_review','avatar_generated','style_vetoes_edit',
    'trip_look_vote','another_look','hint_seen','avatar_judge'
  ])
);
