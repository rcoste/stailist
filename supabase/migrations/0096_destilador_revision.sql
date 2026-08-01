-- Segunda pasada del destilador: separar "no es de este estilo" de "no es lo mío".
--
-- EL PROBLEMA QUE ARREGLA
-- La primera curaduría pedía dos juicios distintos con un solo botón: si la foto
-- es del estilo (taxonomía) y si se ve bien (ojo). Son preguntas distintas y la
-- persona contestó la que podía contestar — si se lo pondría. El resultado se
-- midió contra un juez que solo sabe taxonomía: 35% de acuerdo en smart-casual,
-- con 17 de 26 fotos rechazadas que SÍ eran del estilo. Smart-casual quedó con
-- 3 aprobadas, que no alcanzan ni para inventar un patrón.
--
-- Con el sesgo metido en la taxonomía, el recetario deja de describir el estilo
-- y describe el guardarropa de una persona: sirve para ella y falla para todas
-- las demás. El sesgo va en la CALIDAD (qué está bien puesto), no en qué cuenta
-- como el estilo.

-- Por qué no se rechazó, en la segunda vuelta. Solo se llena en las fotos donde
-- humano y taxonomía discreparon.
alter table public.referencias
  add column if not exists revision text
  check (revision is null or revision in (
    'no-es-lo-mio',      -- es del estilo pero no es su registro → SÍ destila
    'mal-ejecutada',     -- del estilo pero mal puesto → no destila
    'no-es-del-estilo'   -- el juez se equivocó → no destila
  ));

-- El veredicto del juez de taxonomía. La creó `scripts/juez-estilo.mjs` al
-- vuelo, así que no estaba versionada aquí y —peor— se quedó con RLS activo
-- (default de Supabase) y CERO políticas: ilegible desde la app, sin que nada
-- lo avisara. El create es defensivo por si se corre en un entorno limpio.
create table if not exists public.referencias_juez (
  referencia_id uuid primary key references public.referencias(id) on delete cascade,
  es_del_estilo boolean not null,
  ejecucion int not null,
  observado text,
  creado_en timestamptz not null default now()
);

alter table public.referencias_juez enable row level security;

drop policy if exists "referencias_juez solo admin" on public.referencias_juez;
create policy "referencias_juez solo admin" on public.referencias_juez for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
