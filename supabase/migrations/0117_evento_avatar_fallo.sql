-- El evento que faltaba: una generación de avatar que NO salió.
--
-- Hasta hoy los fallos eran INVISIBLES. La fila de instrumentación
-- (`avatar_judge`) se escribe al final del camino feliz, así que una
-- generación que moría antes no dejaba rastro: en la tabla solo se veían los
-- éxitos. Con esa foto incompleta, "el avatar tardó muchísimo / falló" no se
-- podía diagnosticar sin salir a interrogar la API de Google a mano — que es
-- exactamente lo que hubo que hacer el 2026-08-06.
--
-- Guarda el motivo real (HTTP 500 de Google, timeout, filtro) y cuánto tardó
-- antes de rendirse.
--
-- El CHECK de `events` es una lista blanca: un tipo nuevo que no se agregue
-- aquí hace que el insert truene en producción y en silencio (el registro es
-- best-effort). Ya pasó con `trip_item_swap`.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed','colorimetria_edit',
    'critic_review','avatar_generated','style_vetoes_edit','trip_look_vote',
    'another_look','hint_seen','avatar_judge','trip_item_swap','item_deleted',
    'outfit_deleted','trip_deleted','perfil_estilo_view','intro_seen',
    'avatar_fallo'
  ])
);
