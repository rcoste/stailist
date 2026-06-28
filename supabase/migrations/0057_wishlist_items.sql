-- Cartera · Fase 3a: el Wishlist. Candidatos que el usuario evalúa comprar
-- (foto tomada en tienda / online), con su veredicto de color (Fase 2) guardado.
-- También recibirá sugerencias de "te falta" (cápsula) más adelante.
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_path text not null,                     -- ruta en bucket privado 'prendas'
  color_hex text,                               -- color dominante detectado
  verdict text,                                 -- 'va' | 'no-ideal' | 'parecido'
  source text not null default 'upload',        -- 'upload' | 'capsule' | 'gap'
  name text,
  created_at timestamptz not null default now()
);

alter table public.wishlist_items enable row level security;

create policy "own wishlist" on public.wishlist_items
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admin reads wishlist" on public.wishlist_items
  for select to authenticated
  using (is_admin());

create index wishlist_items_user_created_idx
  on public.wishlist_items (user_id, created_at desc);
