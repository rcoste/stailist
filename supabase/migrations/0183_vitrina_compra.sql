-- "LA COMPRÉ" EN LA VITRINA DE UNIQLO (2026-10-21). La compra era lo único que
-- la prueba no podía ver sin preguntar por WhatsApp: ahora un toque mete esa
-- prenda al clóset (con su foto de Uniqlo) y deja este evento.
--   tienda_compra: data = trip_id, index, entrada (mercado:producto:color),
--                  tienda, precio, moneda, con_foto.
-- Lista copiada de la vigente (0182) + el tipo nuevo.
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
    'ig_interes_visto','ig_interes_si','ig_interes_no',
    'vitrina_vista','tienda_click',
    'tienda_compra'
  ])
);
