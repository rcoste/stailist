-- Los veredictos de Roberto sobre los looks del barrido.
--
-- PARA QUÉ
-- El barrido produce porcentajes ("15% fuera de la paleta del estilo") que no
-- se pueden accionar hasta saber cuántos son fallo real del motor y cuántos son
-- la IA revisora siendo más literal que la receta. Ese juicio no lo puede dar
-- otra IA —sería calificar su propia tarea— ni yo, que escribí las dos partes.
--
-- POR QUÉ EN LA BASE Y NO EN EL NAVEGADOR
-- La primera idea fue guardar los comentarios en localStorage y que Roberto los
-- pegara en el chat. Dos problemas: se pierden si limpia el navegador o cambia
-- de dispositivo a media revisión, y obligan a un paso manual de copiar/pegar
-- para algo que yo puedo leer directo. Son ~50 juicios escritos a mano: es el
-- dato más caro de esta fase y el más fácil de perder.
--
-- `look_n` es la llave: el número del look dentro de la corrida del barrido, el
-- mismo que se muestra en pantalla. No hay FK a nada — los looks del barrido no
-- son outfits guardados, viven en un JSON del repo.
create table if not exists public.barrido_notas (
  look_n int primary key,
  -- 'acerto' | 'exagero' | null (todavía sin juicio). Texto y no enum: esto es
  -- una herramienta de una fase, y un enum obligaría a una migración para
  -- añadir un tercer veredicto que hoy no sabemos si hará falta.
  veredicto text check (veredicto is null or veredicto in ('acerto', 'exagero')),
  comentario text,
  updated_at timestamptz not null default now()
);

alter table public.barrido_notas enable row level security;

-- Solo admin: es una herramienta interna de revisión, no dato de usuario.
create policy "barrido_notas admin" on public.barrido_notas
  for all
  using (public.is_admin())
  with check (public.is_admin());
