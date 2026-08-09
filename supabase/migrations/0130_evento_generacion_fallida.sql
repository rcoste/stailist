-- POR QUÉ MURIÓ UNA GENERACIÓN, CONSULTABLE.
--
-- El 2026-08-09, una corrida del wow guardó 2 outfits y murió antes de la cola.
-- Se pudo RECONSTRUIR por lo que faltaba —ni critic_review, ni
-- generation_timing, ni la escritura del paso 5— pero el motivo se lo llevó una
-- consola que ya no existe. Diagnosticar por ausencia dice QUE algo se rompió,
-- nunca QUÉ.
--
-- Y esa corrida muerta no fue gratis: dejó a la persona en el paso 4 con looks
-- ya generados, y la pantalla los ignoraba y regeneraba (arreglado en el mismo
-- commit). El evento es lo que deja ver la próxima antes de que alguien la
-- reporte.
--
-- Idempotente: reescribe el CHECK entero con el valor nuevo dentro.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed','colorimetria_edit',
    'critic_review','avatar_generated','style_vetoes_edit','trip_look_vote',
    'another_look','hint_seen','avatar_judge','trip_item_swap','item_deleted',
    'outfit_deleted','trip_deleted','perfil_estilo_view','intro_seen',
    'avatar_fallo','espejo_subido',
    -- Nuevo: el motor tronó a media generación. `data.message` trae el error
    -- recortado; `data.paso`, en qué punto del onboarding estaba.
    'generation_failed'
  ])
);
