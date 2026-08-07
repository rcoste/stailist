-- EL BENCHMARK: guardar una versión del prompt para poder CORRERLA después.
--
-- Roberto: "eventualmente sí tenemos que guardar los códigos para cuando
-- saquemos la versión 49 y así hacer comparaciones… como los frontier labs, ver
-- si sale mejor el 48 contra el 49".
--
-- POR QUÉ NO SE PUEDE ESPERAR: el prompt vive en el código, y dos versiones no
-- se pueden cargar a la vez en el mismo proceso. Cuando el código vaya en v49,
-- v48 seguirá en un commit de git pero ya no habrá forma de EJECUTARLO junto a
-- la nueva. Congelarlo hoy es barato; reconstruirlo después es arqueología.
--
-- QUÉ SE GUARDA: el `system` (estático) y el mensaje de usuario YA RENDERIZADO
-- para cada brief del pool. Con eso y el schema —que se reconstruye del clóset—
-- la llamada es reproducible exactamente.
--
-- LO QUE ATA EL SNAPSHOT, y por eso está en la clave única: la versión, el
-- CLÓSET y el POOL. Un congelado sobre otro clóset no compara lo mismo, y el
-- unique impide guardarlo dos veces por error.
create table if not exists public.prompts_congelados (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  version text not null,
  pool_version text not null,
  closet_user_id uuid not null references auth.users(id) on delete cascade,
  -- El modelo con el que corría esa versión: parte de lo que se compara.
  modelo text not null,
  system text not null,
  -- [{ etiqueta, texto }] — el mensaje de usuario renderizado por brief.
  briefs jsonb not null,
  nota text,
  unique (version, closet_user_id, pool_version)
);

alter table public.prompts_congelados enable row level security;
create policy "prompts_congelados admin" on public.prompts_congelados
  for all using (public.is_admin()) with check (public.is_admin());
