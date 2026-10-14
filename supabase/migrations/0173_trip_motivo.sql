-- 0173 · trip_motivo: lo que la persona dice de una pieza de su maleta.
--
-- Bloque B del viaje (2026-10-14): "tengo uno parecido", "no lo necesito en
-- este viaje", "no me gusta esta pieza" y "ninguna de las dos me va" guardan
-- un evento con la pieza, la acción, el motivo y lo que escribió. Roberto:
-- "es importante que guardemos todo eso, nos sirve de feedback".
--
-- Sin esto el insert falla en silencio (la trampa de trip_item_swap y de
-- 0160): se vio al probarlo en local, el log decía "violates check constraint
-- events_type_check". Lista copiada de la vigente en la base + 'trip_motivo'.
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
    'trip_motivo'
  ])
);
