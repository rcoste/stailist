-- 0158 · profiles.origen: de dónde llegó cada persona.
--
-- Roberto, 2026-09-10: arranca Google Ads el lunes 14 y TikTok después. Hasta
-- hoy nada guardaba de qué anuncio llegó alguien, así que el panel podía decir
-- quién se fue pero no si lo trajo un anuncio. Lo que Google reporta no basta:
-- en iPhone pierde una parte de las conversiones, y sobre todo no sabe si la
-- persona VOLVIÓ — que es la pregunta que decide si la campaña sirve.
--
-- QUÉ GUARDA: las etiquetas del link (utm_*, gclid/gbraid/wbraid, ttclid,
-- fbclid), el dominio del que venía (sin la página exacta), la primera página
-- que abrió y cuándo. Lo arma proxy.ts en una cookie de primera parte al
-- llegar y lo copia aquí /onboarding/genero la primera vez que se abre la app
-- (ver lib/origen.ts para las reglas de qué visita gana).
--
-- POR QUÉ UNA COLUMNA Y NO UNA TABLA: es un dato por cuenta, se lee siempre
-- junto al perfil, y se borra con él (borrar cuenta ya recorre profiles). La
-- escribe la propia persona sobre su fila (RLS "own profile update"): falsear
-- su propio origen no le da nada a nadie.
--
-- Aditiva y nullable: el código viejo la ignora, así que puede aplicarse antes
-- del merge sin romper nada.
alter table public.profiles add column if not exists origen jsonb;

-- TOPE DE TAMAÑO. La fila la escribe la propia persona (RLS), así que sin esto
-- cualquiera podía guardar megas en su perfil por la API de Supabase y
-- /admin/adquisicion los leería todos. Lo que arma lib/origen.ts no pasa de
-- ~1.8 KB; 4 KB deja margen. En bloque DO para poder re-aplicar el archivo.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_origen_tamano') then
    alter table public.profiles
      add constraint profiles_origen_tamano
      check (origen is null or pg_column_size(origen) <= 4096);
  end if;
end $$;

comment on column public.profiles.origen is
  'De dónde llegó (utm, gclid, ttclid, dominio de referencia, primera página). Lo escribe /onboarding/genero desde la cookie st_origen. Ver lib/origen.ts.';
