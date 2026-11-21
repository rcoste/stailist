-- 0189 · AVISOS PUSH (2026-10-30). Preparada apagada; se prende el 5-nov o después.
--
-- LA PREGUNTA QUE CONTESTA: ¿un aviso en el teléfono ("tu look de hoy te
-- espera") hace que la gente vuelva al día siguiente? Hoy nadie recibe nada
-- entre sesión y sesión: los correos son opt-in (2 de 103 aceptaron) y la
-- retención muere al día 3. Son 20 personas con la app instalada; es un
-- experimento barato, no una apuesta.
--
-- QUÉ SE GUARDA
--   · push_subscriptions — una fila por teléfono/navegador que dijo que sí:
--     el endpoint (la dirección técnica que da Apple/Google) y las dos llaves
--     que cifran el mensaje. No lleva nada de la persona más que su id. Se
--     borra con la cuenta (on delete cascade).
--   · profiles.avisos_push — la preferencia de la CUENTA: 'on' al suscribirse,
--     'off' si lo apaga en Perfil (apaga todos sus teléfonos de golpe).
--   · eventos: push_prompt_shown (se le ofreció), push_suscrito (dijo que sí y
--     el navegador dio permiso), push_rechazado (dijo que no, o negó el
--     permiso, o lo apagó: data.via), push_enviado (el cron le mandó uno:
--     data.dispositivos, con_titulo) y push_abierto (entró desde el aviso).
--     Con los últimos dos se lee la tasa de apertura; con los primeros tres,
--     la de aceptación.
--
-- RLS: cada quien ve, crea y borra SOLO sus suscripciones. El cron escribe
-- con DATABASE_URL (sin RLS). El SELECT propio es obligatorio: sin él el
-- upsert por endpoint falla en el SEGUNDO intento (ON CONFLICT necesita leer).

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  -- Envíos que fallaron por algo que no es "la suscripción murió" (404/410,
  -- que se marca en revoked_at de inmediato). Con 3 seguidos se deja de intentar.
  fallos       integer not null default 0,
  revoked_at   timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push propias: leer" on public.push_subscriptions;
create policy "push propias: leer" on public.push_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "push propias: crear" on public.push_subscriptions;
create policy "push propias: crear" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "push propias: actualizar" on public.push_subscriptions;
create policy "push propias: actualizar" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "push propias: borrar" on public.push_subscriptions;
create policy "push propias: borrar" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

alter table public.profiles
  add column if not exists avisos_push text
  check (avisos_push is null or avisos_push in ('on','off'));

-- Lista copiada de la vigente (0188) + los cinco tipos del push.
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
    'trip_item_added','trip_revision',
    'push_prompt_shown','push_suscrito','push_rechazado','push_enviado','push_abierto'
  ])
);
