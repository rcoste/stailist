-- 0161 · profiles.como_nos_conocio: lo que la persona DICE que la trajo.
--
-- Nació del assessment de Aesty (2026-09-16), que lo pregunta en su onboarding.
-- profiles.origen (0158) ya guarda las etiquetas del link, pero sólo ve lo que
-- trae etiqueta: un anuncio. Quien llega porque una amiga le pasó el nombre, o
-- lo vio en un video y lo escribió a mano, entra como "directo" — y con la
-- campaña corriendo desde el 14 esa es justo la mitad que no se puede separar
-- del anuncio. Las dos columnas se leen juntas en /admin/adquisicion.
--
-- 'omitido' existe para no volver a preguntar a quien la saltó. Sin valor = no
-- ha pasado por la pantalla (cuentas de antes de esto).
--
-- La escribe la propia persona sobre su fila (RLS "own profile update"), igual
-- que origen: mentir aquí no le da nada a nadie. El CHECK impide texto libre.
-- Aditiva y nullable: el código viejo la ignora.
alter table public.profiles add column if not exists como_nos_conocio text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_como_nos_conocio_valores') then
    alter table public.profiles
      add constraint profiles_como_nos_conocio_valores
      check (como_nos_conocio is null or como_nos_conocio in (
        'recomendacion', 'instagram', 'tiktok', 'facebook', 'google', 'otro', 'omitido'
      ));
  end if;
end $$;

comment on column public.profiles.como_nos_conocio is
  'Lo que la persona dijo que la trajo (pantalla /onboarding/conocio). Complementa origen, que sólo ve etiquetas de link. Ver lib/como-nos-conocio.ts.';
