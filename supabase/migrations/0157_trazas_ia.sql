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
  razonamiento text
);

-- SÓLO SE INSERTA, NUNCA SE ACTUALIZA, y no por gusto: la primera versión de
-- esta tabla tenía `unique (user_id, tarea)` y hacía upsert, para quedarse
-- únicamente con la traza de la cápsula viva. La RLS lo rechazó, y la razón es
-- una trampa que vale la pena dejar escrita:
--
--   ON CONFLICT DO UPDATE necesita LEER la fila en conflicto, así que exige
--   política de SELECT además de la de UPDATE.
--
-- Y aquí la persona NO puede leer —adentro va el prompt de sistema, que es el
-- criterio del producto—. O sea que el upsert era incompatible con el punto
-- entero de la tabla: la primera generación habría pasado y las regeneraciones
-- habrían fallado en silencio. Se probó contra la base antes de shipear.
--
-- Sin la llave única, la más nueva de cada persona es la que manda (el panel
-- ordena por fecha). Guardar el histórico deja de ser un problema y se vuelve
-- un extra: se puede ver cómo derivó el prompt entre una regeneración y otra.
create index if not exists ai_trazas_tarea_idx
  on public.ai_trazas (tarea, created_at desc);
create index if not exists ai_trazas_usuario_idx
  on public.ai_trazas (user_id, tarea, created_at desc);

alter table public.ai_trazas enable row level security;

-- ASIMÉTRICAS A PROPÓSITO, y aquí la asimetría es más fuerte que en ai_calls:
-- la persona INSERTA una fila que NO puede leer. Es el único caso así en el
-- proyecto y es deliberado.
drop policy if exists "ai_trazas insert propio" on public.ai_trazas;
create policy "ai_trazas insert propio" on public.ai_trazas
  for insert with check (auth.uid() = user_id);

drop policy if exists "ai_trazas admin lee" on public.ai_trazas;
create policy "ai_trazas admin lee" on public.ai_trazas
  for select using (public.is_admin());

comment on table public.ai_trazas is
  'Prompt enviado y razonamiento del modelo, por persona y tarea. Sólo admin lee.';
