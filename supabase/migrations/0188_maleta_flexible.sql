-- 0188 · LA MALETA FLEXIBLE (2026-10-21).
--
-- Roberto, empacando: "tener más flexibilidad: quitar y poner, o decirte
-- 'esto es lo que empaqué', dame un assessment, y arma los looks a partir de
-- esto". Dos cosas nuevas que se guardan:
--
--   · trips.revision — la revisión de stylist de lo que de verdad lleva (qué
--     está bien, qué sobra, qué falta), con la firma de la maleta revisada:
--     si cambia lo que lleva, la pantalla sabe que la revisión es vieja.
--   · eventos 'trip_item_added' (agregó algo de su clóset que no estaba en el
--     plan) y 'trip_revision' (pidió la revisión), para saber si se usan.
--
-- Va por las políticas que ya existen (own trips). Lista de eventos copiada
-- de la vigente (0183) + los dos tipos nuevos.

alter table public.trips add column if not exists revision jsonb;

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
    'tienda_compra',
    'trip_item_added','trip_revision'
  ])
);
