-- 0168 · las marcas del embudo: lo que pasa ANTES de que exista una cuenta.
--
-- El 3 de octubre hubo 17 clics de Google y 0 personas, y no había forma de
-- saber si se fueron sin ver la página o si la vieron y no tocaron el botón:
-- la base sólo se entera de alguien cuando ya tiene sesión, y Analytics tarda
-- un día y no separa por paso. Con la entrada sin correo, además, el borrador
-- que no deja su correo se borra a los 7 días (cron de limpieza) y se lleva sus
-- eventos: el paso más delicado del embudo (la pantalla del correo) dejaría de
-- verse justo cuando más importa.
--
-- Una fila = un sujeto que dio un paso, con el día y la campaña de su cookie de
-- origen. Cuatro pasos:
--   landing       abrió la landing (sujeto = id aleatorio del navegador, sin datos personales)
--   boton         tocó "Armar mi primer look" y se le abrió un borrador (sujeto = id del borrador)
--   correo_visto  llegó a "¿a dónde te lo guardo?" (sujeto = id del borrador)
--   correo_ok     verificó su código ahí (sujeto = id del borrador)
-- La llave (sujeto, paso) hace que cada quien cuente una vez por paso: recargar
-- la página no infla nada. Sin FK a auth.users a propósito: la marca tiene que
-- sobrevivir al borrado del borrador.
--
-- Sólo el servidor la escribe y la lee (Postgres directo, lib/embudo-marcas.ts
-- y lib/admin/campana-datos.ts). RLS prendido y sin políticas, como
-- campana_codigos: por la API de Supabase no la ve nadie.

create table if not exists public.embudo_marcas (
  sujeto text not null check (length(sujeto) between 8 and 64),
  paso text not null check (paso in ('landing', 'boton', 'correo_visto', 'correo_ok')),
  dia date not null,
  fuente text not null,
  campana text not null,
  creado timestamptz not null default now(),
  primary key (sujeto, paso)
);
create index if not exists embudo_marcas_dia_idx on public.embudo_marcas (dia);
alter table public.embudo_marcas enable row level security;
revoke all on public.embudo_marcas from anon, authenticated;

comment on table public.embudo_marcas is
  'Un sujeto (id aleatorio del navegador o id del borrador) por paso del embudo previo a la cuenta, con día CDMX y origen. Sin datos personales. Ver lib/embudo-marcas.ts.';
