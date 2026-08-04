-- El juicio CIEGO de Roberto sobre el A/B del recetario.
--
-- PARA QUÉ
-- El recetario (v28+) reconstruyó el motor sobre 616 fotos destiladas y NINGÚN
-- usuario real lo ha visto: los 155 outfits con votos son todos de v27 para
-- atrás (13 👍, 3 👎, 12 puestos). La pregunta "¿esto suma o resta?" no la puede
-- contestar la IA revisora —ya se le cachó marcando tenis donde había
-- sandalias— ni yo, que escribí las dos versiones.
--
-- POR QUÉ A CIEGAS
-- Si se ve cuál es la versión nueva, el juicio deja de ser sobre los looks. Por
-- eso la pantalla no dice qué lado es cuál, y el orden izquierda/derecha se
-- sortea por par: sin eso, tres pares bastan para deducir el patrón y el resto
-- de la revisión ya no mide nada.
--
-- `par_n` es el número del par en la pantalla. La correspondencia par → brazo
-- vive fuera de esta tabla, para que ni una consulta descuidada la revele antes
-- de tiempo.
create table if not exists public.ab_veredictos (
  par_n int primary key,
  -- 'izq' | 'der' | 'igual' — qué lado le pareció mejor. Deliberadamente NO se
  -- guarda como "con/sin recetario": eso se resuelve al analizar, cruzando con
  -- el sorteo. Guardar aquí el brazo haría que la tabla misma delate el ciego.
  eleccion text check (eleccion is null or eleccion in ('izq', 'der', 'igual')),
  comentario text,
  updated_at timestamptz not null default now()
);

alter table public.ab_veredictos enable row level security;

create policy "ab_veredictos admin" on public.ab_veredictos
  for all
  using (public.is_admin())
  with check (public.is_admin());
