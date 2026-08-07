-- EL EVAL: la suite de evaluación del motor, estilo frontier-lab.
--
-- QUÉ ES (idea de Roberto): "así como los labs tienen sus criterios de
-- evaluación y van viendo cuando sacan un nuevo modelo cómo mejora comparado
-- con los pasados — que nuestro motor se mida contra el motor pasado". Una
-- corrida de eval genera el pool congelado de briefs con el motor VIGENTE y lo
-- califican los jueces automáticos (reglas de código + rúbrica de texto +
-- rúbrica de visión), SIN votación humana. El resultado se guarda con la
-- versión del prompt y el modelo, y la lista de corridas es la curva: ¿el
-- motor de hoy es mejor que el de hace un mes?
--
-- EN QUÉ SE DISTINGUE DEL COMPARADOR (y por qué no es la misma tabla):
--   comparador  = A contra B, ciego, voto humano, decide un CAMBIO.
--   eval        = una sola variante (producción), jueces automáticos, mide el
--                 NIVEL. Es la banda de medir; el comparador es la balanza.
--
-- LA DEFENSA ANTI-GOODHART vive aquí como columnas: cada corrida congela las
-- versiones de las rúbricas con las que se calificó, y `marcas` guarda la
-- calibración humana (una muestra chica votada por Roberto) que re-mide si la
-- rúbrica sigue viendo como él. Un juez contra el que se optimiza deja de
-- medir — la calibración es cómo nos enteramos a tiempo.

create table if not exists public.eval_corridas (
  id uuid primary key default gen_random_uuid(),
  creada timestamptz not null default now(),
  -- Quién corre el eval (admin).
  user_id uuid not null references auth.users(id) on delete cascade,
  -- De quién es el clóset. Hoy es el mismo admin; el día que el eval corra
  -- sobre los guardarropas de stylists de la biblioteca (fase 2, para medir
  -- distintos estilos), aquí vivirá esa diferencia.
  closet_user_id uuid not null references auth.users(id) on delete cascade,
  -- Lo CONGELADO: qué motor se midió y con qué varas. Sin esto, la lista de
  -- corridas no es una curva — es una bolsa de números incomparables.
  prompt_version text not null,
  pool_version text not null,
  modelo_generador text not null,
  modelo_juez text not null,
  rubrica_version text not null,
  rubrica_vision_version text not null,
  -- Si el perfil del clóset traía señal de estilo al abrir la corrida: la
  -- dimensión "estilo" solo promedia cuando esto es true (sin señal, el juez
  -- pone 3 neutro y promediarlo diluiría a las corridas que sí miden).
  con_estilo boolean not null default false,
  estado text not null default 'corriendo' check (estado in ('corriendo', 'lista', 'cerrada')),
  nota text
);

-- Un brief del pool resuelto por el motor, con sus looks y sus notas.
create table if not exists public.eval_briefs (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.eval_corridas(id) on delete cascade,
  n int not null,
  -- El brief congelado (mismo shape que el comparador: BriefMotor).
  brief jsonb not null,
  -- Los looks FINALES del pipeline de producción (post-juez, piso de 2).
  -- null = todavía no se genera.
  looks jsonb,
  -- Qué hizo el juez de producción con cada candidato (ok/reparado/rechazado):
  -- de aquí sale la tasa de reparación — el dato que dirá cuándo el juez de
  -- producción ya no repara nada y se puede quitar (las rueditas de la bici).
  reviews jsonb,
  error text,
  costo_gen_usd numeric(10, 6),
  ms_gen int,
  -- Las notas de los jueces, POR LOOK y en el orden de `looks`:
  -- [{violaciones: [...], texto: NotaRubrica, vision: NotaRubrica}].
  -- null = todavía no se califica. Un elemento puede traer solo parte (un juez
  -- que falló se reintenta sin tirar al otro).
  notas jsonb,
  costo_notas_usd numeric(10, 6),
  -- LA CALIBRACIÓN humana: {"<índice de look>": "arriba" | "abajo"}. Se anota
  -- sobre una muestra, después de que los jueces ya calificaron — mide el
  -- acuerdo rúbrica-contra-humano, nunca entra al marcador automático.
  marcas jsonb,
  comentarios jsonb,
  unique (corrida_id, n)
);

create index if not exists eval_briefs_corrida on public.eval_briefs (corrida_id);

alter table public.eval_corridas enable row level security;
alter table public.eval_briefs enable row level security;

create policy "eval_corridas admin" on public.eval_corridas
  for all using (public.is_admin()) with check (public.is_admin());
create policy "eval_briefs admin" on public.eval_briefs
  for all using (public.is_admin()) with check (public.is_admin());
