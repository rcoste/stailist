-- Vetos de estilo (issue #2): hard NOs que el motor de outfits respeta. El
-- usuario declara prendas/colores/detalles que NUNCA quiere; el motor los filtra
-- del clóset + los mete como regla dura en el prompt + el juez los rechaza.
-- chips = ids del catálogo; free = texto libre.

alter table public.profiles add column if not exists style_vetoes jsonb
  not null default '{"chips":[],"free":[]}'::jsonb;

-- Evento para medir adopción (mismo patrón que mig 0026/0031: un tipo nuevo no
-- listado rompería el insert entero → logging silenciosamente roto).
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed',
    'colorimetria_edit','critic_review','avatar_generated','style_vetoes_edit'
  ])
);
