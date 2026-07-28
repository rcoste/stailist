-- Visitas a la pestaña "estilo" del perfil.
--
-- Por qué: los dos campos de esa pantalla (referencia de estilo y tus palabras)
-- llevan semanas sin que nadie los llene, y hay DOS explicaciones que no podemos
-- distinguir con lo que medimos hoy: que la petición no convenza, o que nadie
-- llegue nunca a esa pestaña. Sin este dato, cualquier rediseño se estrena con
-- las mismas cero personas. Es la medición más barata que separa las dos.
--
-- Se registra una vez por montaje de la pestaña (no por render). En modo "ver
-- como" del admin no entra: el proxy bloquea los POST, así que la acción ni
-- corre — las visitas del admin no ensucian el dato.
--
-- OJO (trampa recurrente, ya mordió con avatar_judge en 0073, trip_item_swap en
-- 0074 y de nuevo en 0078): todo tipo de evento nuevo DEBE agregarse a este
-- CHECK o el insert falla EN SILENCIO — el código no revisa el error del insert
-- de events.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed',
    'colorimetria_edit','critic_review','avatar_generated','style_vetoes_edit',
    'trip_look_vote','another_look','hint_seen','avatar_judge','trip_item_swap',
    'item_deleted','outfit_deleted','trip_deleted','perfil_estilo_view'
  ])
);
