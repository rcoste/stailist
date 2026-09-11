-- 0159 · borrado programado de la cuenta: 30 días para arrepentirse.
--
-- Roberto, 2026-09-10. Hasta hoy, "borrar mi cuenta" borraba todo en el
-- instante: un tap impulsivo costaba un clóset entero (Andy armó 81 prendas).
-- Ahora el botón PROGRAMA el borrado: la cuenta se desactiva y la limpieza
-- diaria (app/api/cron/limpieza) la borra entera cuando llega esta fecha. Si la
-- persona entra antes, elige recuperarla (app/cuenta/programada).
--
-- Mientras la columna tenga fecha, la cuenta está BLOQUEADA: ninguna pantalla
-- de la app abre (lib/auth.ts), los correos automáticos la saltan, y sus datos
-- no se usan para nada — es el periodo que la ley pide entre pedir el borrado y
-- borrar.
--
-- Aditiva y nullable: el código viejo la ignora.
alter table public.profiles add column if not exists borrado_programado_para timestamptz;

comment on column public.profiles.borrado_programado_para is
  'Si tiene fecha, la persona pidió borrar su cuenta: queda bloqueada y la limpieza diaria la borra al llegar esta fecha. Ver lib/borrado-programado.ts.';

-- La limpieza busca las vencidas cada día; casi todas las filas son null.
create index if not exists profiles_borrado_programado_idx
  on public.profiles (borrado_programado_para)
  where borrado_programado_para is not null;

-- Los dos eventos nuevos. Sin esto el insert falla en silencio (la trampa de
-- trip_item_swap): copiar la lista vigente de 0155 y sumar.
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
    'cuenta_borrado_programado','cuenta_recuperada'
  ])
);
