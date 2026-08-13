-- EL RECIBO DE CADA LLAMADA DE IA.
--
-- POR QUÉ, y no es telemetría por si acaso: el 2026-08-12, discutiendo cuánto
-- se podía exprimir la ventana de espera del fit check para meter una pregunta,
-- la respuesta honesta fue "no tengo el número". `lib/proveedores` YA calcula
-- ms, tokens y costo en cada llamada —el tipo `Recibo` existe desde que se
-- construyó la puerta común— y ese recibo se tiraba a la basura al terminar el
-- request. O sea que el dato se producía y no se guardaba.
--
-- Sin esta tabla, tres preguntas se contestan de oído: cuánto tarda de verdad
-- cada tarea (para diseñar esperas), qué cuesta cada una (el proyecto ya se ha
-- llevado sustos de costo) y con qué frecuencia truena un proveedor.
--
-- NO GUARDA CONTENIDO: ni el prompt, ni la respuesta, ni la imagen. Es un
-- recibo, no un registro de lo que la persona subió — guardar el texto haría
-- de esta tabla una copia de los datos de todo el mundo para responder
-- preguntas de ingeniería.

create table if not exists public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- De quién fue la llamada. `set null` y no `cascade`: si alguien se borra, el
  -- costo y el tiempo que ya se gastaron siguen siendo ciertos.
  user_id uuid references auth.users(id) on delete set null,
  -- Qué trabajo se estaba haciendo ('espejo', 'motor', 'vision'…). Texto libre
  -- a propósito: un enum obligaría a una migración por cada tarea nueva y la
  -- consecuencia real sería que nadie instrumente la siguiente.
  tarea text not null,
  proveedor text not null,
  modelo text not null,
  /** La versión del prompt, cuando la tarea la tiene. Sin esto no se puede
      comparar el tiempo de v3 contra el de v4. */
  version text,
  ms integer not null,
  tokens_entrada integer,
  tokens_salida integer,
  costo_usd numeric(12, 6),
  -- Falso = la llamada tronó. Se guarda igual: cuánto tarda en fallar y con qué
  -- frecuencia es justo lo que no se puede reconstruir después.
  ok boolean not null default true
);

-- La consulta de siempre es "cómo va ESTA tarea últimamente".
create index if not exists ai_calls_tarea_idx
  on public.ai_calls (tarea, created_at desc);

alter table public.ai_calls enable row level security;

-- DOS POLÍTICAS ASIMÉTRICAS, y la asimetría es el punto:
--   · cualquiera autenticado INSERTA su propio recibo (la ruta corre con la
--     sesión de la persona, no con la service key);
--   · sólo un admin LEE, porque esto es instrumentación del sistema y no algo
--     que la persona vaya a ver en su perfil.
-- Sin la de insert, la ruta fallaría en silencio y la tabla quedaría vacía
-- para siempre. Sin el límite de lectura, el costo por llamada de todos sería
-- legible desde el cliente.
create policy "ai_calls insert propio" on public.ai_calls
  for insert with check (auth.uid() = user_id);
create policy "ai_calls admin lee" on public.ai_calls
  for select using (public.is_admin());

comment on table public.ai_calls is
  'Recibo por llamada de IA: tarea, modelo, ms, tokens y costo. Sin contenido.';
