-- 0174 · errores: lo que le salió mal a alguien, en un solo lugar.
--
-- Pedido de Roberto (2026-10-14), tras el viaje que Vercel cortó a los 60 s:
-- "cada vez que salga algún error, tengamos esos logs y veamos por qué pasa".
-- Hasta hoy los errores vivían en cuatro sitios (ai_calls con ok=false,
-- events generation_failed/avatar_fallo, los logs de Vercel y, del lado del
-- navegador, en ninguno) y casi ninguno decía quién ni en qué pantalla.
--
-- Esta tabla guarda lo que NO deja rastro en otro lado:
--   · origen 'navegador': lo que vio la persona — una llamada que tronó o se
--     cortó, la pantalla de "algo se me atoró", la maleta que no salió. Es el
--     único lugar que ve un corte por tiempo: el servidor muere sin escribir.
--   · origen 'servidor': los frenos de cuota y gasto ("por hoy ya no").
-- Lo que ya vive en events y ai_calls NO se copia: /admin/errores lo lee de
-- ahí (la regla de siempre: el ciclo de vida lo cuenta su tabla).
create table if not exists public.errores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- set null y no cascade: si alguien borra su cuenta, que el error haya
  -- pasado sigue siendo cierto. Ninguna columna guarda datos de la persona.
  user_id uuid references auth.users(id) on delete set null,
  origen text not null check (origen in ('navegador', 'servidor')),
  -- Agrupa: 'http:/api/trip:504', 'viaje:crear', 'freno:looks'…
  clave text not null check (char_length(clave) <= 120),
  pantalla text check (char_length(pantalla) <= 200),
  mensaje text check (char_length(mensaje) <= 300),
  tecnico text check (char_length(tecnico) <= 500),
  version text check (char_length(version) <= 40)
);

create index if not exists errores_created_idx on public.errores (created_at desc);

alter table public.errores enable row level security;

-- Cada quien escribe y lee SUS errores (el navegador reporta por /api/errores
-- con la sesión de la persona, y la ruta cuenta los de la última hora para
-- frenar un bucle); el admin los lee todos.
drop policy if exists "errores: insertar los propios" on public.errores;
create policy "errores: insertar los propios" on public.errores
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "errores: leer los propios" on public.errores;
create policy "errores: leer los propios" on public.errores
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "errores: admin lee" on public.errores;
create policy "errores: admin lee" on public.errores
  for select to authenticated using (public.is_admin());

-- Qué se hizo con cada tipo de error. Una fila por clave; sin fila = sin
-- revisar. Si después de marcarlo vuelve a pasar, la pantalla lo reabre.
create table if not exists public.errores_estado (
  clave text primary key check (char_length(clave) <= 120),
  estado text not null check (estado in ('sin_revisar', 'visto', 'arreglado')),
  nota text check (char_length(nota) <= 300),
  actualizado timestamptz not null default now()
);

alter table public.errores_estado enable row level security;

drop policy if exists "errores_estado: admin" on public.errores_estado;
create policy "errores_estado: admin" on public.errores_estado
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
