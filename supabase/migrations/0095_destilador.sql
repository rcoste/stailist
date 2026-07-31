-- El destilador: curaduría de las fotos de referencia con las que se destila
-- cómo se lleva cada estilo (lib/engine/recetario.ts).
--
-- POR QUÉ EN LA BASE Y NO EN UN ARCHIVO LOCAL
-- La primera versión guardaba los juicios en un JSON del disco, porque la
-- herramienta corría solo en local. Pero la curaduría son ~90 fotos por tanda y
-- se hace en ratos muertos —desde el celular, fuera de casa—, así que tiene que
-- sincronizar entre dispositivos. Un archivo local no sincroniza.
--
-- Las FOTOS viven en el bucket privado `referencias` (no público): son de
-- terceros, cosechadas de Pinterest. Privado + URL firmada las hace visibles
-- solo para quien está curando, que es lo mismo que un board privado. Público
-- sería redistribuirlas, y eso no.

insert into storage.buckets (id, name, public)
values ('referencias', 'referencias', false)
on conflict (id) do nothing;

-- Solo admins tocan este bucket. No hay caso de uso de usuaria final.
drop policy if exists "referencias admin lee" on storage.objects;
create policy "referencias admin lee" on storage.objects for select
  using (
    bucket_id = 'referencias'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

drop policy if exists "referencias admin escribe" on storage.objects;
create policy "referencias admin escribe" on storage.objects for insert
  with check (
    bucket_id = 'referencias'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

create table if not exists public.referencias (
  id uuid primary key default gen_random_uuid(),
  -- Los tres campos que identifican la foto: qué estilo ilustra, para qué
  -- género, y dónde está el archivo en el bucket.
  estilo text not null,
  genero text not null check (genero in ('hombre', 'mujer')),
  path text not null unique,

  -- El juicio. `sirve` null = pendiente, y ese es el estado inicial a propósito:
  -- permite contar cuánto falta sin inventar un campo de "revisada".
  sirve boolean,
  -- Por qué no sirve. Alimenta la lista de "lo que arruina el estilo" del
  -- recetario, así que vale más que un simple descarte.
  motivo text,
  -- "Así me vestiría yo" — se guarda SEPARADO de `sirve` a propósito: filtrar
  -- por gusto personal produce el clóset de una persona, no el estilo.
  mio boolean not null default false,
  nota text,

  juzgada_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referencias_estilo_idx
  on public.referencias (genero, estilo, sirve);

alter table public.referencias enable row level security;

-- Herramienta interna: solo admins, lectura y escritura.
drop policy if exists "referencias solo admin" on public.referencias;
create policy "referencias solo admin" on public.referencias for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
