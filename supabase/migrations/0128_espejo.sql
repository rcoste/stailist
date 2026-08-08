-- "¿ME VEO BIEN?" — LA FOTO DE CÓMO ME VESTÍ HOY.
--
-- Idea de Roberto: subir a diario una foto de cómo salió vestido y que la app
-- se la mire — colorimetría, clima y un ajuste — y se la guarde en su diario.
--
-- Dos cosas hacen falta y ninguna existe:
--
-- 1) DÓNDE VIVE LA FOTO. Los 177 outfits de la base los generó la app
--    (source daily/viaje/capsula): NADA ha entrado nunca desde la vida real,
--    así que la tabla no tiene dónde poner una foto de la persona. `tryon_path`
--    NO sirve: ése es el render del avatar probándose un look, justo lo
--    contrario de una foto real.
--
-- 2) EL EVENTO. `events.type` es un CHECK cerrado — una trampa ya conocida en
--    este repo (el `trip_item_swap` se estrelló contra ella). Sin añadirlo, el
--    registro falla en silencio y el módulo nace sin poder medirse, que es
--    exactamente lo que no puede pasar con una función cuya única pregunta
--    abierta es si la gente vuelve al día siguiente.
--
-- `source` NO necesita migración: no tiene CHECK, así que 'espejo' entra libre.

alter table public.outfits
  add column if not exists photo_path text;

comment on column public.outfits.photo_path is
  'Foto que la persona subió de cómo se vistió (source=espejo). Bucket privado "prendas", carpeta del usuario. Distinta de tryon_path, que es el render del avatar.';

-- El evento del módulo. Idempotente: reescribe el CHECK entero con el valor
-- nuevo dentro, así que re-correrlo deja lo mismo.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed','colorimetria_edit',
    'critic_review','avatar_generated','style_vetoes_edit','trip_look_vote',
    'another_look','hint_seen','avatar_judge','trip_item_swap','item_deleted',
    'outfit_deleted','trip_deleted','perfil_estilo_view','intro_seen',
    'avatar_fallo',
    -- Nuevo: subió una foto de cómo se vistió.
    'espejo_subido'
  ])
);
