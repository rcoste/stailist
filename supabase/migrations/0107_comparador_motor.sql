-- El comparador de MOTORES: dos variantes del motor arman looks sobre el mismo
-- día y el mismo clóset, Roberto vota a ciegas cuál quedó mejor, y al final se
-- revela qué era cada una con un veredicto contra una regla escrita ANTES de
-- votar.
--
-- UNA VARIANTE = {modelo + versión de prompt + reglas encendidas}. Comparar
-- modelos es solo un caso de lo mismo. El pipeline que corre es EXACTAMENTE el
-- de producción (lib/engine/contexto.ts + lib/engine/pipeline.ts) — los tres
-- bugs de arnés del 5 de agosto salieron de scripts que imitaban al motor en
-- vez de llamarlo.
--
-- DOS TAMAÑOS, con papeles distintos a propósito:
--   'vistazo'   (6 pares)    encontrar defectos y sacar reglas. NUNCA declara
--                            ganador — solo "hay algo roto" o "sube a veredicto".
--   'veredicto' (20-40)      decidir, con la regla estadística PRE-REGISTRADA
--                            en la columna `regla` antes del primer voto.
--
-- EL CIEGO: los lados se muestran como "Look A / Look B" con orden sembrado por
-- par (determinista, para que recargar no cambie las columnas). El voto se
-- guarda ya RESUELTO a la clave de la variante (el servidor deshace el barajeo),
-- nunca como "izquierda/derecha".
--
-- LOS PARES REPETIDOS (repite_de): en veredicto, ~10% de los pares se repiten
-- con el orden INVERTIDO y sin volver a generar (mismos looks). Miden la
-- consistencia del juez humano: si el voto no sobrevive al espejo, el veredicto
-- entero vale menos y hay que saberlo.

create table if not exists public.comparador_motor_corridas (
  id uuid primary key default gen_random_uuid(),
  creada timestamptz not null default now(),
  -- Quién corre el experimento (admin).
  user_id uuid not null references auth.users(id) on delete cascade,
  -- De quién es el clóset sobre el que se arman los looks.
  closet_user_id uuid not null references auth.users(id) on delete cascade,
  tamano text not null check (tamano in ('vistazo', 'veredicto')),
  -- Exactamente 2: [{clave, etiqueta, modeloId?, opciones?}, ...]. Se congelan
  -- aquí (no se leen del catálogo al calificar) para que editar el catálogo
  -- mañana no reescriba lo que significó una corrida de hoy.
  variantes jsonb not null,
  -- La versión del prompt del día de la corrida, para leer resultados viejos.
  prompt_version text not null,
  -- La regla PRE-REGISTRADA (obligatoria en veredicto, la valida la acción):
  -- qué cuenta como ganar y qué pasa si no gana. Se escribe ANTES de votar;
  -- explicar la derrota después de verla es justo lo que el pre-registro mata.
  regla text,
  estado text not null default 'corriendo' check (estado in ('corriendo', 'juzgando', 'cerrada')),
  nota text
);

-- Un par: un brief (día + clima + ocasión) que las dos variantes resuelven.
create table if not exists public.comparador_motor_pares (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.comparador_motor_corridas(id) on delete cascade,
  n int not null,
  -- {etiqueta, objective, momento, weather: {temp_c, condition} | null}
  brief jsonb not null,
  -- Par espejo: reusa los lados del par original con el orden invertido.
  repite_de uuid references public.comparador_motor_pares(id) on delete cascade,
  -- El voto YA RESUELTO: la clave de la variante ganadora, o 'empate'.
  -- null = sin votar. Se resuelve en el servidor deshaciendo el barajeo.
  voto text,
  -- Defectos etiquetados por lado: {"<clave de variante>": ["clima", ...]}.
  -- Es la cosecha del vistazo: cada defecto confirmado es candidato a regla
  -- de lib/engine/reglas-ejecucion.ts.
  defectos jsonb,
  nota text
);

-- Un lado: lo que UNA variante armó para UN par, con su recibo.
create table if not exists public.comparador_motor_lados (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.comparador_motor_corridas(id) on delete cascade,
  par_id uuid not null references public.comparador_motor_pares(id) on delete cascade,
  -- La clave de la variante (de corrida.variantes).
  variante text not null,
  -- Los looks FINALES (post-juez, con piso de 2): lo que el usuario habría visto.
  looks jsonb,
  -- Qué hizo el juez con cada candidato (ok/reparado/rechazado + razón).
  reviews jsonb,
  error text,
  -- El recibo agregado de la generación + sus jueces.
  tokens_entrada int,
  tokens_salida int,
  costo_usd numeric(10, 6),
  ms int,
  unique (par_id, variante)
);

create index if not exists comparador_motor_pares_corrida
  on public.comparador_motor_pares (corrida_id);
create index if not exists comparador_motor_lados_corrida
  on public.comparador_motor_lados (corrida_id);
create index if not exists comparador_motor_lados_par
  on public.comparador_motor_lados (par_id);

alter table public.comparador_motor_corridas enable row level security;
alter table public.comparador_motor_pares enable row level security;
alter table public.comparador_motor_lados enable row level security;

create policy "comparador_motor_corridas admin" on public.comparador_motor_corridas
  for all using (public.is_admin()) with check (public.is_admin());
create policy "comparador_motor_pares admin" on public.comparador_motor_pares
  for all using (public.is_admin()) with check (public.is_admin());
create policy "comparador_motor_lados admin" on public.comparador_motor_lados
  for all using (public.is_admin()) with check (public.is_admin());
