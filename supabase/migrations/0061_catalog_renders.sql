-- Biblioteca general de prendas ideales rendereadas bajo demanda. Cuando un usuario
-- pide "ver cómo se ve" una prenda sugerida sin imagen, se genera con IA y aterriza
-- aquí: bucket PÚBLICO (lectura para todos; los usuarios logueados solo AGREGAN
-- combos nuevos, no sobrescriben) + tabla registro de qué combos existen, para que
-- la cápsula los muestre al instante a quien venga después. Sin service-role: la
-- escritura es una política acotada SOLO a este bucket.
insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', true)
on conflict (id) do nothing;

create policy "catalog public read" on storage.objects
  for select using (bucket_id = 'catalog');
create policy "catalog auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'catalog');

create table if not exists public.catalog_renders (
  key text primary key,
  path text not null,
  created_at timestamptz not null default now()
);
alter table public.catalog_renders enable row level security;
create policy "catalog_renders read" on public.catalog_renders
  for select to authenticated using (true);
create policy "catalog_renders insert" on public.catalog_renders
  for insert to authenticated with check (true);
