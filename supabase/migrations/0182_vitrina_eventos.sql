-- LA VITRINA DE UNIQLO EN LA MALETA (2026-10-20). Prueba de 6 semanas: bajo
-- cada pieza que te falta para un viaje a EE. UU., Japón o Corea, hasta dos
-- prendas reales de Uniqlo del país de destino, con precio y enlace. Dos
-- eventos para leerla el 7 y el 24 de noviembre (docs/designs/vitrina-de-tienda.md):
--   vitrina_vista: se pintó una franja (data: clave, entradas, tienda, desde);
--                  se cuenta DISTINCT por cuenta, clave y día, nunca por filas.
--   tienda_click:  se tocó el enlace a la tienda (data: clave, entrada, tienda, desde).
-- Lista copiada de la vigente (0178) + los dos tipos nuevos. Sin tabla nueva: la
-- caché de respuestas vive en la Data Cache de Next, no en la base.
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
    'vitrina_vista','tienda_click'
  ])
);
