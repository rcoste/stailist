-- MEDIR EL COMPARTIR (2026-10-16). Hasta hoy la app tenía dos botones de
-- compartir (el try-on a pantalla completa y el pasaporte de estilo) y ninguno
-- dejaba rastro: no había forma de saber si alguien mandó algo por WhatsApp.
-- Antes de construir nada para crecer por recomendación hay que poder medirlo.
-- Lista copiada de la vigente en la base (verificada contra pg_constraint) +
-- 'compartido'.
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
    'visita',
    'trip_motivo',
    'compartido'
  ])
);
