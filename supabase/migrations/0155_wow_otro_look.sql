-- 0155 · wow_otro_look: la primera huella de "quiero otro" en el primer look.
--
-- El wow tenía un botón "otro look" que regresaba al picker de los 3 sin dejar
-- rastro: los 5 `another_look` de la base son de Hoy (traen razón). Roberto,
-- 2026-09-08: "siento que mucha gente le va a empezar a picar lo de otro look
-- y en vez de avanzar van a regresar" — y no había forma de saber si era el 5%
-- o el 50%. Desde v0.2.312.0 el botón se va y pedir otro vive bajo el 👎
-- (voto primero, alternativas después); este evento cuenta cada vez que
-- alguien elige uno de los otros dos. `data`: {de, a} (ids de outfit).
--
-- Idempotente: reescribe el CHECK entero con el valor nuevo dentro (mismo
-- patrón que 0152).
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
    'wow_otro_look'
  ])
);
