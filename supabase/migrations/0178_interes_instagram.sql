-- PRUEBA DE INTERÉS: "¿TE ARMAMOS TU CLÓSET DESDE INSTAGRAM?" (2026-10-16).
-- Tarjeta honesta en el Clóset ("lo estamos preparando") para quien tiene
-- menos de 10 prendas propias. No construye el servicio: mide si la gente lo
-- quiere. Regla escrita antes de verla: se lee con 30 personas que la vieron;
-- 1 de cada 5 o más toca "avísame" = hay interés; menos de 1 de cada 10 = se
-- descarta. El usuario de Instagram (opcional) sólo se guarda con permiso.
-- Lista copiada de la vigente (0175) + los tres tipos nuevos.
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
    'compartido',
    'ig_interes_visto','ig_interes_si','ig_interes_no'
  ])
);
