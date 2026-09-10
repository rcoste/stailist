-- 0157 · ai_trazas: el prompt y el razonamiento de la llamada, para depurar.
--
-- Roberto, 2026-09-09: "me gustaría en el admin tener de alguna manera el
-- prompt que se manda para generar el clóset cápsula, y el reasoning de por
-- qué eligió lo que eligió, esto eventualmente nos puede servir para debug".
--
-- POR QUÉ NO VA EN `ai_calls`: esa tabla dice explícitamente que NO guarda
-- contenido, y la razón sigue siendo buena — es un recibo por llamada, de
-- todo el mundo, y meterle el texto la convertiría en una copia de los datos
-- de la gente para contestar preguntas de ingeniería. Aquí es al revés: el
-- contenido ES el dato, y por eso vive en su propia tabla, con su propia RLS,
-- y sólo para las tareas donde alguien va a leerlo.
--
-- POR QUÉ NO VA DENTRO DE `profiles.capsule_target`: ese jsonb lo lee la
-- persona (RLS de perfil propio) para pintar su pantalla de esenciales. El
-- prompt de sistema es el criterio de stylist del producto entero; meterlo ahí
-- lo haría legible desde el cliente de cualquier cuenta.
--
-- UNA FILA POR (persona, tarea), no un histórico: `capsule_target` se
-- sobreescribe al regenerar, así que una traza vieja quedaría huérfana de la
-- lista que produjo y no se podría juzgar. Lo que se necesita para depurar es
-- "qué prompt y qué razonamiento produjeron la cápsula que estoy viendo".
create table if not exists public.ai_trazas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- `cascade` y no `set null`: sin la persona, su prompt no le sirve a nadie
  -- (a diferencia del costo de ai_calls, que sigue siendo cierto).
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Qué trabajo se estaba haciendo ('capsula-ideal'…). Texto libre, igual que
  -- en ai_calls: un enum obligaría a migrar por cada tarea nueva y el efecto
  -- real sería que nadie instrumente la siguiente.
  tarea text not null,
  modelo text,
  version text,
  -- Lo que se le mandó, tal cual salió. No los ingredientes para reconstruirlo:
  -- el prompt es un template que cambia, y re-renderizarlo con el código de hoy
  -- mentiría sobre lo que recibió la cápsula de ayer.
  prompt_system text,
  prompt_usuario text,
  -- El borrador de trabajo del modelo: por qué eligió lo que eligió. En la
  -- cápsula ya se generaba (campo "plan" del schema, primero a propósito para
  -- que razone antes de comprometerse) y se tiraba a la basura al terminar.
  razonamiento text,
  unique (user_id, tarea)
);

create index if not exists ai_trazas_tarea_idx
  on public.ai_trazas (tarea, created_at desc);

alter table public.ai_trazas enable row level security;

-- ASIMÉTRICAS A PROPÓSITO, y aquí la asimetría es más fuerte que en ai_calls:
--   · la persona INSERTA y ACTUALIZA la suya (la ruta corre con su sesión, y
--     el upsert de regenerar necesita las dos);
--   · la persona NO LA LEE. Es el único caso del proyecto donde alguien
--     escribe una fila que no puede leer, y es deliberado: adentro va el
--     prompt de sistema.
drop policy if exists "ai_trazas insert propio" on public.ai_trazas;
create policy "ai_trazas insert propio" on public.ai_trazas
  for insert with check (auth.uid() = user_id);

drop policy if exists "ai_trazas update propio" on public.ai_trazas;
create policy "ai_trazas update propio" on public.ai_trazas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_trazas admin lee" on public.ai_trazas;
create policy "ai_trazas admin lee" on public.ai_trazas
  for select using (public.is_admin());

comment on table public.ai_trazas is
  'Prompt enviado y razonamiento del modelo, por persona y tarea. Sólo admin lee.';
