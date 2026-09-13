-- 0160 · la visita: saber que alguien ENTRÓ aunque no haya hecho nada.
--
-- Roberto, 2026-09-12: "no entiendo si sí había abierto la app o no… eso puede
-- contar como una acción, y es importante ver eso".
--
-- Hasta hoy, entrar sólo dejaba rastro de rebote: los timings de una
-- generación, un tip cerrado. Quien entraba, miraba y se iba era INVISIBLE —
-- medido en ricardomc888, que el 2026-09-10 entró dos veces y sólo una dejó
-- huella en `events` (la otra únicamente en `auth.sessions`, que no se puede
-- cruzar con el feed). Y justo ese es el patrón que el experimento vino a
-- medir: volver y no hacer nada NO es lo mismo que no volver.
--
-- Una visita por persona y día (hora de CDMX), escrita desde lib/auth.ts al
-- cargar cualquier pantalla de la app. `ultima_visita` es el candado que evita
-- una fila por cada página: sin ella, una sesión normal escribiría decenas.
alter table public.profiles add column if not exists ultima_visita timestamptz;

comment on column public.profiles.ultima_visita is
  'Última vez que la persona abrió la app, con precisión de día (ver lib/visitas.ts). Sirve de candado para escribir un solo evento "visita" al día.';

-- Sin esto el insert falla en silencio (la trampa de trip_item_swap): copiar
-- la lista vigente de 0159 y sumar.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed','colorimetria_edit',
    'critic_review','avatar_generated','style_vetoes_edit','trip_look_vote',
    'another_look','hint_seen','avatar_judge','trip_item_swap','item_deleted',
    'outfit_deleted','trip_deleted','perfil_estilo_view','intro_seen',
    'avatar_fallo','espejo_subido','generation_failed',
    'onboarding_started','item_added','trip_created','trip_outfits_generated',
    'outfit_favorited','tryon_generated','capsule_generated','wishlist_added',
    'render_generated','email_unsubscribed',
    'wow_otro_look',
    'cuenta_borrado_programado','cuenta_recuperada',
    'visita'
  ])
);
