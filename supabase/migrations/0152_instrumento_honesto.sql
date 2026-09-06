-- INSTRUMENTO HONESTO (bloque B4 de la auditoría pre-release, 2026-09-06)
--
-- Cuatro cosas que impedían leer el uso real:
--   1. el TTV se medía desde que pedías el código, no desde que abrías la app;
--   2. las acciones más comunes del producto no dejaban evento;
--   3. tres columnas de `referencias` existían en la base y en ninguna migración;
--   4. no había forma de saber qué migraciones estaban aplicadas.

-- ─── 1. DESDE CUÁNDO CORRE EL RELOJ ──────────────────────────────────────────
--
-- `profiles.created_at` lo pone el trigger al insertar en auth.users, o sea al
-- TECLEAR el correo. Entre eso y abrir la app está ir al buzón, y a veces un
-- día entero: 5 de los 23 TTV guardados eran de horas o de meses. El reloj
-- honesto arranca cuando la persona pisa la primera pantalla del onboarding.
alter table public.profiles
  add column if not exists onboarding_started_at timestamptz;

-- ─── 2. LOS EVENTOS QUE FALTABAN ─────────────────────────────────────────────
--
-- Medido: 1026 prendas en `items` y CERO eventos de "añadió una prenda". Igual
-- los viajes (9), favoritos (28), try-ons (74), cápsulas (14), wishlist (30),
-- renders (384). El feed de /admin/actividad lo esquiva cruzando seis tablas,
-- pero cruzar tablas no reconstruye el ORDEN en que pasaron las cosas.
--
-- Lo que NO entra, a propósito: `session_open`. Un evento por cada apertura de
-- la app es exactamente el ruido que el brief de la auditoría señaló (el 76% de
-- `events` ya era instrumentación, no acciones); la actividad se lee mejor por
-- lo que la persona HACE. Y `avatar_uploaded` sobra: `avatar_generated` ya se
-- emite en el mismo sitio.
--
-- Idempotente: reescribe el CHECK entero con los valores nuevos dentro.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type = any (array[
    'vote_up','vote_down','worn','onboarding_step','first_outfit_ttv',
    'generation_timing','pwa_prompt_shown','pwa_installed','colorimetria_edit',
    'critic_review','avatar_generated','style_vetoes_edit','trip_look_vote',
    'another_look','hint_seen','avatar_judge','trip_item_swap','item_deleted',
    'outfit_deleted','trip_deleted','perfil_estilo_view','intro_seen',
    'avatar_fallo','espejo_subido','generation_failed',
    -- Nuevos (B4). `onboarding_started` es el arranque del reloj; los demás
    -- son las acciones que hasta hoy no dejaban huella. `data` trae el detalle
    -- (source y n en item_added, trip_id en los de viaje, cached en tryon).
    'onboarding_started','item_added','trip_created','trip_outfits_generated',
    'outfit_favorited','tryon_generated','capsule_generated','wishlist_added',
    'render_generated','email_unsubscribed'
  ])
);

-- ─── 3. LO QUE ESTABA EN LA BASE SIN MIGRACIÓN ───────────────────────────────
--
-- `lib/destilador.ts` lee estas tres columnas y ninguna migración las declaraba:
-- un entorno recreado desde el repo rompía el destilador sin decir por qué.
-- Se declaran idempotentes para que en producción, donde ya existen, no pase
-- nada.
alter table public.referencias add column if not exists de_noche boolean;
alter table public.referencias add column if not exists ocasiones text[];
alter table public.referencias add column if not exists registro text;

-- ─── 4. QUÉ MIGRACIONES ESTÁN APLICADAS ──────────────────────────────────────
--
-- `scripts/db.mjs` ejecutaba el archivo y no anotaba nada; la única forma de
-- saber qué había en producción era comparar objetos uno a uno. Desde ahora
-- cada archivo aplicado con el script deja su renglón, y las 152 anteriores
-- se dan por aplicadas porque la auditoría verificó una por una que todos sus
-- objetos existen.
create table if not exists public.schema_migrations (
  nombre text primary key,
  aplicada_en timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
-- Sólo el servidor (DATABASE_URL) la toca; ninguna sesión de la app la ve.
insert into public.schema_migrations (nombre) values
  ('0001_initial.sql'),
  ('0002_seed_archetypes.sql'),
  ('0003_enforce_allowlist.sql'),
  ('0004_outfit_title.sql'),
  ('0005_archetypes_segment.sql'),
  ('0006_seed_archetypes_v2.sql'),
  ('0007_seed_archetypes_hombre_v2.sql'),
  ('0008_profile_gender.sql'),
  ('0009_seed_archetypes_mujer.sql'),
  ('0010_style_archetype.sql'),
  ('0011_avatar_tryon.sql'),
  ('0012_palette_flow.sql'),
  ('0013_events_colorimetria_edit.sql'),
  ('0014_archetypes_hombre_expansion.sql'),
  ('0015_admin.sql'),
  ('0016_archetypes_bucket.sql'),
  ('0017_admin_storage_prendas.sql'),
  ('0018_archetypes_mujer_expansion.sql'),
  ('0019_split_gendered_basics.sql'),
  ('0020_onboarding_subset_flag.sql'),
  ('0021_library_expansion_hombre.sql'),
  ('0022_tenis_estilos_chamarra_clasica.sql'),
  ('0023_chelsea_ante.sql'),
  ('0024_library_expansion_mujer.sql'),
  ('0025_outfit_favorito.sql'),
  ('0026_events_critic_review.sql'),
  ('0027_capsule.sql'),
  ('0028_capsule_match.sql'),
  ('0029_capsule_overrides.sql'),
  ('0030_journey_state.sql'),
  ('0031_avatar_body_type.sql'),
  ('0032_style_vetoes.sql'),
  ('0033_trips.sql'),
  ('0034_trip_outfits.sql'),
  ('0035_trip_outfit_feedback.sql'),
  ('0036_library_expansion_v2.sql'),
  ('0037_library_expansion_v3.sql'),
  ('0038_library_expansion_v4.sql'),
  ('0039_library_expansion_mujer.sql'),
  ('0040_library_prendas_mujer.sql'),
  ('0041_variedad_mujer.sql'),
  ('0042_library_hombre_verano.sql'),
  ('0043_color_colorimetria.sql'),
  ('0044_color_hombre_paridad.sql'),
  ('0045_import_carrete.sql'),
  ('0046_silueta.sql'),
  ('0047_silueta_hombre.sql'),
  ('0048_outfit_tip.sql'),
  ('0049_archetype_styling.sql'),
  ('0050_items_styling_from_archetype.sql'),
  ('0051_trip_paradas.sql'),
  ('0052_outfit_gen_status.sql'),
  ('0053_trip_bolsas.sql'),
  ('0054_trip_favorite.sql'),
  ('0055_capsule_outfits.sql'),
  ('0056_prendas_own_folder_update.sql'),
  ('0057_wishlist_items.sql'),
  ('0058_wishlist_tryon.sql'),
  ('0059_waitlist.sql'),
  ('0060_style_reference.sql'),
  ('0060_waitlist_admin.sql'),
  ('0061_catalog_renders.sql'),
  ('0062_style_questions.sql'),
  ('0063_library_genz.sql'),
  ('0064_library_formal.sql'),
  ('0065_library_deportivo_bano.sql'),
  ('0066_wishlist_capsule.sql'),
  ('0067_archetypes_category_check.sql'),
  ('0068_capsule_swaps.sql'),
  ('0069_library_carla.sql'),
  ('0070_prendas_admin_read.sql'),
  ('0071_trips_admin_read.sql'),
  ('0072_email_semanal.sql'),
  ('0073_hints.sql'),
  ('0074_trip_item_swap_event.sql'),
  ('0075_height_cm.sql'),
  ('0076_email_semanal_default_on.sql'),
  ('0077_trip_contexto.sql'),
  ('0078_soft_delete_outfits_trips.sql'),
  ('0079_style_words.sql'),
  ('0080_age_range.sql'),
  ('0081_minor_consent.sql'),
  ('0082_blindaje_consentimiento.sql'),
  ('0083_allowlist_invite.sql'),
  ('0084_closet_mujer_juvenil.sql'),
  ('0085_prendas_juveniles_mujer.sql'),
  ('0086_complexiones_nuevas.sql'),
  ('0087_athleisure_color_mujer.sql'),
  ('0088_capsule_look_outfits.sql'),
  ('0089_rename_trajes_de_bano.sql'),
  ('0090_evento_perfil_estilo_view.sql'),
  ('0091_contexto_de_uso.sql'),
  ('0092_onboarding_formal_mujer.sql'),
  ('0093_wishlist_attrs.sql'),
  ('0094_evento_intro_seen.sql'),
  ('0095_destilador.sql'),
  ('0096_destilador_revision.sql'),
  ('0097_referencias_clima.sql'),
  ('0098_revision_rescate.sql'),
  ('0099_taxonomia_v2.sql'),
  ('0100_referencias_silueta.sql'),
  ('0101_vista_resumen_referencias.sql'),
  ('0102_perfil_corte.sql'),
  ('0103_barrido_notas.sql'),
  ('0104_ab_veredictos.sql'),
  ('0105_comparador.sql'),
  ('0106_comparador_fotos.sql'),
  ('0107_comparador_motor.sql'),
  ('0108_comparador_motor_cinturones.sql'),
  ('0109_comparador_motor_tryon.sql'),
  ('0110_comparador_motor_por_look.sql'),
  ('0111_comparador_comentarios_look.sql'),
  ('0112_comparador_tryon_por_look.sql'),
  ('0113_comparador_defectos_look.sql'),
  ('0114_comparador_votos_look.sql'),
  ('0115_comparador_motor_pool.sql'),
  ('0116_comparador_prefs_look.sql'),
  ('0117_evento_avatar_fallo.sql'),
  ('0118_work_dress_code.sql'),
  ('0119_eval_corridas.sql'),
  ('0120_eval_con_color.sql'),
  ('0121_eval_tryons.sql'),
  ('0122_comparador_notas_rubrica.sql'),
  ('0123_prompts_congelados.sql'),
  ('0124_items_certeza.sql'),
  ('0125_atributos_confirmados.sql'),
  ('0126_traje_es_saco.sql'),
  ('0127_esmoquin_es_saco.sql'),
  ('0128_espejo.sql'),
  ('0129_espejo_resumen.sql'),
  ('0130_evento_generacion_fallida.sql'),
  ('0131_planned_for.sql'),
  ('0132_outfits_plan.sql'),
  ('0133_ai_calls.sql'),
  ('0134_destino_imagenes.sql'),
  ('0135_email_reenganche.sql'),
  ('0136_library_roberto.sql'),
  ('0137_trajes_y_lino_retirado.sql'),
  ('0138_backfill_conjunto_y_wishlist_unica.sql'),
  ('0139_trajes_negro_y_sastre_mujer.sql'),
  ('0140_notas_vision_comparador.sql'),
  ('0141_criticas_juez_stylist.sql'),
  ('0142_veredicto_del_juez.sql'),
  ('0143_grupo_generacion.sql'),
  ('0144_polos_basicos.sql'),
  ('0145_polos_rueda_completa.sql'),
  ('0146_registro_por_plan.sql'),
  ('0147_polos_mujer.sql'),
  ('0148_corbata_negra.sql'),
  ('0149_acento_apetito.sql'),
  ('0150_acento_apetito_fuente.sql'),
  ('0151_cuotas_y_cierres.sql'),
  ('0152_instrumento_honesto.sql')
on conflict (nombre) do nothing;
