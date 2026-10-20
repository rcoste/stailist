-- 0183 · LA MEDICIÓN EN SECO DE LA VITRINA DE UNIQLO (2026-10-21).
--
-- La vitrina (v0.2.402, docs/designs/vitrina-de-tienda.md) elige dos prendas
-- de Uniqlo por cada pieza que te falta en la maleta, sin IA: término de
-- búsqueda + segmento + color + calificación. Roberto preguntó cómo saber si
-- esas elecciones son correctas, y vio dos que no lo eran (pantalones de
-- sudadera para "sweater" en Corea; un vestido de lino de verano para un
-- vestido midi rubí de noviembre). Esto es la banda de medir de esa pregunta:
--
--   · una CORRIDA toma los huecos reales ("falta" en capsule_match de los
--     viajes vivos), pide a la API de Uniqlo los 20 candidatos por mercado con
--     LA MISMA consulta que usa la vitrina, y anota cuáles dos eligió;
--   · un JUEZ barato (Haiku 5.5, lib/models.ts) contesta por candidato si es
--     la pieza que pide el hueco, con su recibo;
--   · ROBERTO califica sí/no por candidato en /admin/vitrina-medicion.
--
-- De ahí salen tres números: cuántas elecciones de la vitrina aprobó Roberto,
-- el acuerdo juez↔Roberto (si es alto, el juez puede vigilar solo la próxima
-- vez), y el TECHO: cuántos huecos tenían al menos un candidato correcto entre
-- los 20 — si el techo es bajo, el problema es la consulta, no la elección.
--
-- SIN DATOS DE CUENTA EN PANTALLA: cada hueco guarda el id del viaje (para
-- poder repetir la corrida sobre los mismos huecos) pero la pantalla enseña
-- sólo el índice del viaje dentro de la corrida y el del hueco. Escribe el
-- script por DATABASE_URL (sin RLS); la pantalla lee y vota como admin.

create table if not exists public.vitrina_medicion_corridas (
  id uuid primary key default gen_random_uuid(),
  creada timestamptz not null default now(),
  -- Lo congelado: con qué juez y qué versión de su prompt se calificó.
  modelo_juez text not null,
  version_juez text not null,
  mercados text[] not null,
  n_huecos int not null default 0,
  n_candidatos int not null default 0,
  nota text
);

create table if not exists public.vitrina_medicion_huecos (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.vitrina_medicion_corridas(id) on delete cascade,
  -- Índice del hueco dentro de la corrida (1..n): es lo que ve la pantalla.
  n int not null,
  -- Índice del viaje dentro de la corrida (1..k): agrupa sin revelar la cuenta.
  viaje_n int not null,
  -- Para repetir la corrida sobre los mismos huecos. NUNCA se enseña.
  trip_id uuid,
  -- Índice de la pieza en capsule_target.items.
  item_index int not null,
  segmento text not null check (segmento in ('hombre', 'mujer')),
  -- La pieza pedida, tal cual la cápsula (CapsuleItem).
  nombre text not null,
  tipo text not null,
  color_familia text not null,
  temporada text,
  formalidad text,
  visual text,
  porque text,
  -- El término en inglés con que la vitrina buscó (terminoDe); null = la
  -- vitrina no sabe buscar este tipo y no enseña nada.
  termino text,
  unique (corrida_id, n)
);

create index if not exists vitrina_medicion_huecos_corrida on public.vitrina_medicion_huecos (corrida_id);

create table if not exists public.vitrina_medicion_candidatos (
  id uuid primary key default gen_random_uuid(),
  hueco_id uuid not null references public.vitrina_medicion_huecos(id) on delete cascade,
  mercado text not null check (mercado in ('us', 'jp', 'kr')),
  -- Posición en la respuesta de la API (0..19): el orden en que Uniqlo los dio.
  orden int not null,
  product_id text not null,
  nombre text not null,
  -- El color que se enseña: el de la familia si lo hay; si no, el primero del
  -- producto (y motivo = 'sin-color').
  color text,
  display_code text,
  genero text,
  precio numeric(12, 2),
  precio_texto text,
  foto text,
  url text,
  rating numeric(3, 2),
  -- true = una de las dos que la vitrina enseña en producción.
  elegida boolean not null default false,
  -- Por qué NO la eligió (null si la eligió): genero | sin-precio | sin-color |
  -- sin-foto | rating (pasó todos los filtros pero no quedó entre las dos).
  motivo text,
  -- El juez: ¿es la pieza que pide el hueco? null = todavía no se juzga.
  juez boolean,
  juez_linea text,
  juez_costo_usd numeric(10, 6),
  juez_ms int,
  juez_error text,
  -- Roberto: su veredicto y cuándo.
  roberto boolean,
  roberto_el timestamptz,
  unique (hueco_id, mercado, orden)
);

create index if not exists vitrina_medicion_candidatos_hueco on public.vitrina_medicion_candidatos (hueco_id);

alter table public.vitrina_medicion_corridas enable row level security;
alter table public.vitrina_medicion_huecos enable row level security;
alter table public.vitrina_medicion_candidatos enable row level security;

drop policy if exists "vitrina_medicion_corridas: admin" on public.vitrina_medicion_corridas;
create policy "vitrina_medicion_corridas: admin" on public.vitrina_medicion_corridas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "vitrina_medicion_huecos: admin" on public.vitrina_medicion_huecos;
create policy "vitrina_medicion_huecos: admin" on public.vitrina_medicion_huecos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "vitrina_medicion_candidatos: admin" on public.vitrina_medicion_candidatos;
create policy "vitrina_medicion_candidatos: admin" on public.vitrina_medicion_candidatos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
