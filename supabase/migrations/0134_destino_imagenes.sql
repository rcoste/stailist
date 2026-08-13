-- LA FOTO DE CADA DESTINO DE VIAJE, generada una vez y compartida por todos.
--
-- POR QUÉ POR DESTINO Y NO POR VIAJE: la foto de Kioto no depende de tu viaje,
-- depende de Kioto. Generarla por viaje pagaría Gemini en cada creación y
-- repetiría la misma imagen; por destino se paga UNA VEZ en la vida del
-- producto y el segundo viaje a Osaka la tiene al instante.
--
-- QUÉ CUBRE: solo la cola larga. Los ~19 destinos frecuentes ya tienen foto
-- estática en public/destinos (fórmula B&N congelada, gen-destinos.mjs) y esos
-- NUNCA pasan por aquí — el catálogo estático gana siempre. Esta tabla existe
-- para el Osaka/Kioto/Querétaro que el catálogo no puede enumerar a mano.
--
-- MISMO PATRÓN QUE catalog_renders (0061): bucket público + tabla registro +
-- escritura autenticada acotada al bucket. Sin service-role a propósito — la
-- service key ya dio problemas en prod (memoria del correo semanal) y este
-- flujo no la necesita.

insert into storage.buckets (id, name, public)
values ('destinos', 'destinos', true)
on conflict (id) do nothing;

create policy "destinos public read" on storage.objects
  for select using (bucket_id = 'destinos');
create policy "destinos auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'destinos');
-- update sí hace falta (a diferencia de catalog): un slug con imagen fea se
-- regenera encima con upsert, que en storage es insert + update.
create policy "destinos auth update" on storage.objects
  for update to authenticated using (bucket_id = 'destinos');

create table if not exists public.destino_imagenes (
  -- El slug del lugar normalizado (minúsculas, sin acentos, espacios → guión).
  -- ES la llave a propósito: dos usuarios creando "Osaka" a la vez chocan aquí
  -- y solo uno genera (el otro recibe conflict y se retira).
  slug text primary key,
  -- Cómo lo escribió la persona (para leer la tabla, no para decidir nada).
  lugar text not null,
  -- El sujeto visual que eligió el modelo ("Osaka Castle..."). Se guarda para
  -- poder auditar por qué una foto salió como salió.
  motivo text,
  -- generando → listo | fallo. Un 'generando' viejo (>5 min) se considera
  -- muerto y otro request puede reclamarlo — sin esto, una función cortada a
  -- media generación bloquearía ese destino para siempre.
  status text not null default 'generando'
    check (status in ('generando', 'listo', 'fallo')),
  path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.destino_imagenes enable row level security;

-- Caché compartida entre todos los usuarios: cualquiera autenticado lee y
-- escribe. No hay dato personal aquí — es el nombre de una ciudad y su foto.
create policy "destino_imagenes read" on public.destino_imagenes
  for select to authenticated using (true);
create policy "destino_imagenes insert" on public.destino_imagenes
  for insert to authenticated with check (true);
create policy "destino_imagenes update" on public.destino_imagenes
  for update to authenticated using (true);

comment on table public.destino_imagenes is
  'Foto B&N por destino de viaje (cola larga; el catálogo estático de public/destinos gana). Una generación por slug, compartida.';
