-- 0163 · la pantalla de la campaña: los dos datos que la base no tenía.
--
-- /admin/adquisicion arranca en "abrió la app". Para leer una campaña de
-- anuncios faltaban dos puntas del embudo:
--
-- 1. LO QUE PASA ANTES DE ENTRAR: cuánta gente pidió su código. Si la caída
--    está entre pedirlo y entrar (el correo tarda, el navegador de Instagram
--    pierde la pantalla), hoy es invisible. `login_intentos` no sirve: se borra
--    cada noche (limpieza, 1 día) y guarda el correo. Aquí van sólo CONTADORES
--    por día y campaña, sin correo ni IP: sobreviven a la limpieza y no son
--    datos personales. Una persona cuenta una vez al día aunque pida tres
--    códigos. "nuevos" = el correo no tenía cuenta con la que se hubiera
--    entrado alguna vez; "recurrentes" = sí (alguien que vuelve a iniciar
--    sesión desde un anuncio).
--
-- 2. LO QUE SÓLO SABE GOOGLE: clics, costo y cuántos registros cuenta él. Se
--    capturan a mano desde /admin/campana, uno por día y campaña, hasta que
--    valga la pena conectar la API de Google Ads. `registros_google` existe
--    para reconciliar: si Google ve muchos menos que el panel, la cookie se
--    está perdiendo entre navegadores y se decide con el panel, no con Google.
--
-- Las dos tablas sólo se leen y escriben por Postgres directo (lib/db.ts)
-- desde código que exige admin o desde la acción del login. RLS prendido y
-- sin políticas: por la API de Supabase no las ve nadie.

create table if not exists public.campana_codigos (
  dia date not null,
  fuente text not null,
  campana text not null,
  nuevos integer not null default 0,
  recurrentes integer not null default 0,
  primary key (dia, fuente, campana)
);
alter table public.campana_codigos enable row level security;

comment on table public.campana_codigos is
  'Peticiones de código de login por día (CDMX) y origen del anuncio. Sólo contadores, sin correo. Una persona cuenta una vez al día. Ver lib/campana-codigos.ts.';

create table if not exists public.campana_gasto (
  dia date not null,
  campana text not null,
  clics integer not null default 0,
  costo_mxn numeric(12, 2) not null default 0,
  registros_google integer,
  nota text,
  actualizado timestamptz not null default now(),
  primary key (dia, campana)
);
alter table public.campana_gasto enable row level security;

comment on table public.campana_gasto is
  'Lo que reporta Google Ads por día y campaña (utm_campaign), capturado a mano en /admin/campana. registros_google sirve para reconciliar contra el panel.';
