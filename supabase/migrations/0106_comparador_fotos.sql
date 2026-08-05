-- El comparador, replanteado: se sube una foto y compiten los modelos sobre ELLA.
--
-- POR QUÉ CAMBIA LO DE HACE UN RATO
-- La primera versión comparaba modelos leyendo prendas YA guardadas del clóset.
-- Roberto preguntó lo obvio y correcto: "¿qué es lo que vamos a medir? ¿el yo
-- subir una foto donde salgo con varias prendas y de ahí las extrae, o el de
-- una sola?". La base contestó:
--
--     por dónde entró cada prenda        prendas   borradas después
--     checklist de básicos                 645            9
--     foto con VARIAS prendas              303           16   ← el caso real
--     foto de UNA prenda                     5            1   ← lo que medía
--
-- Estaba midiendo el camino por el que entraron CINCO prendas en toda la base,
-- y no el que trajo 303 y produjo 16 de los 25 borrados. El suéter esmeralda
-- que Roberto no tenía —y que salía en un tercio de sus looks— vino de una foto
-- múltiple leída de más.
--
-- Y ADEMÁS no se podía medir hacia atrás: la foto original nunca se guarda. El
-- flujo la lee en el teléfono, saca las prendas, genera un render limpio de cada
-- una y tira el original. Su idea resuelve las dos cosas de un golpe: un
-- subidor aquí adentro, bajo demanda, sin depender del historial ni de cambiar
-- producción.
--
-- LAS TRES FORMAS DE FALLAR, que es lo que hace distinto a este caso:
--   INVENTAR una prenda que no está   ← la cara: no se detecta desde la app
--   OMITIR   una que sí está
--   LEER MAL una que sí vio           ← lo único que medía la versión anterior
--
-- Las tablas de la versión anterior se van: se crearon hoy mismo y están vacías.
drop table if exists public.comparador_vision_lecturas;
drop table if exists public.comparador_vision;

-- Una corrida: unas fotos, unos modelos.
create table if not exists public.comparador_corridas (
  id uuid primary key default gen_random_uuid(),
  creada timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'una'    = foto de UNA prenda           (prompt de analizar-prenda)
  -- 'varias' = foto con VARIAS o persona vestida (prompt de analizar-prendas)
  modo text not null check (modo in ('una', 'varias')),
  modelos jsonb not null,
  estado text not null default 'corriendo' check (estado in ('corriendo','juzgando','cerrada')),
  nota text
);

-- Las fotos subidas. Se guardan en Storage para poder re-correrlas con un
-- modelo nuevo dentro de tres meses sin volver a fotografiar nada — que es
-- justo lo que hoy no se puede hacer con el historial real.
create table if not exists public.comparador_fotos (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.comparador_corridas(id) on delete cascade,
  path text not null,
  n int not null
);

-- Una lectura: lo que UN modelo vio en UNA foto.
create table if not exists public.comparador_lecturas (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.comparador_corridas(id) on delete cascade,
  foto_id uuid not null references public.comparador_fotos(id) on delete cascade,
  modelo_id text not null,
  -- Modo 'una': el objeto de la prenda. Modo 'varias': el arreglo de prendas.
  salida jsonb,
  error text,
  -- El recibo. Esto es lo que faltaba en el proyecto entero: dos meses sin
  -- saber cuánto cuesta leer una prenda contra armar un look, porque la
  -- factura de Anthropic sólo llega por día y por modelo.
  tokens_entrada int,
  tokens_salida int,
  costo_usd numeric(10, 6),
  ms int,
  -- EL JUICIO de Roberto mirando la foto. Su forma depende del modo:
  --   'una'    → { camposMal: ["material", "color"] }
  --   'varias' → { inventadas: [2], faltaron: 1, camposMal: { "0": ["color"] } }
  -- Va como jsonb y no en columnas porque son dos preguntas distintas y
  -- aplanarlas en una sola tabla haría que cada modo cargara con los campos
  -- del otro, vacíos y confusos.
  veredicto jsonb,
  unique (foto_id, modelo_id)
);

create index if not exists comparador_lecturas_corrida
  on public.comparador_lecturas (corrida_id);
create index if not exists comparador_fotos_corrida
  on public.comparador_fotos (corrida_id);

alter table public.comparador_corridas enable row level security;
alter table public.comparador_fotos enable row level security;
alter table public.comparador_lecturas enable row level security;

create policy "comparador_corridas admin" on public.comparador_corridas
  for all using (public.is_admin()) with check (public.is_admin());
create policy "comparador_fotos admin" on public.comparador_fotos
  for all using (public.is_admin()) with check (public.is_admin());
create policy "comparador_lecturas admin" on public.comparador_lecturas
  for all using (public.is_admin()) with check (public.is_admin());
