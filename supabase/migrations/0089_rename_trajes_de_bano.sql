-- "Short de baño X" → "Traje de baño X".
--
-- Por qué: el nombre empezaba con la palabra de OTRA prenda. El motor emparejó
-- el "Short de baño marino" de Roberto con el "Short de lino marino" de su
-- cápsula — mismo primer sustantivo, mismo color, y ambos categoría 'bottom',
-- así que el guard de zona no los separaba. El fix de verdad es el guard de
-- contexto de uso (0.2.38.0, lib/engine/capsule-match.ts); esto es higiene:
-- quita la trampa léxica de raíz y además es como se dice en español de México.
--
-- Nota: "Traje de baño" colisiona léxicamente con "Traje marino de lana", pero
-- ESA colisión sí está cubierta — un traje es categoría 'saco' y un traje de
-- baño es 'bottom', y el guard de zona nunca deja cruzar categorías. O sea, el
-- renombre mueve la ambigüedad de un eje sin protección a uno protegido.
--
-- El slug NO cambia: es la llave estable y de él cuelga la imagen
-- (/archetypes/short-bano-marino.png). Solo cambia el nombre que se lee.

update public.archetypes set name = 'Traje de baño marino'     where slug = 'short-bano-marino';
update public.archetypes set name = 'Traje de baño negro'      where slug = 'short-bano-negro-h';
update public.archetypes set name = 'Traje de baño estampado'  where slug = 'short-bano-estampado-h';

-- El nombre de una prenda se usa como LLAVE en varios jsonb (match.by, las
-- prendas de un look de viaje o de cápsula, la llave de un look guardado). Si no
-- se migran, la prenda pierde su imagen y el try-on no la resuelve. Se reemplaza
-- el string COMPLETO (con sus comillas) para no tocar texto que solo la mencione
-- de pasada dentro de una explicación.
do $$
declare
  pares text[][] := array[
    ['"Short de baño marino"',    '"Traje de baño marino"'],
    ['"Short de baño negro"',     '"Traje de baño negro"'],
    ['"Short de baño estampado"', '"Traje de baño estampado"']
  ];
  p text[];
begin
  foreach p slice 1 in array pares loop
    update public.trips
      set outfits = replace(outfits::text, p[1], p[2])::jsonb
      where outfits::text like '%' || p[1] || '%';

    update public.profiles
      set capsule_match = replace(capsule_match::text, p[1], p[2])::jsonb
      where capsule_match::text like '%' || p[1] || '%';

    update public.profiles
      set capsule_outfits = replace(capsule_outfits::text, p[1], p[2])::jsonb
      where capsule_outfits::text like '%' || p[1] || '%';

  end loop;

  -- capsule_look_key NO se puede parchar con un replace: es las prendas
  -- ORDENADAS y unidas por "|", y al renombrar cambia el lugar que le toca en
  -- ese orden ("Short…" y "Traje…" no ordenan igual). Un replace dejaría una
  -- llave que ya no coincide con la que calcula capsuleLookKey(), y el look
  -- perdería su corazón y su try-on en silencio. Hoy no hay ninguno (un look
  -- guardado con traje de baño es un caso que en la práctica no pasa), así que
  -- en vez de adivinar, esto REVIENTA si alguna vez aparece — mejor enterarse.
  if exists (
    select 1 from public.outfits
    where source = 'capsula' and capsule_look_key like '%Short de baño%'
  ) then
    raise exception
      'Hay looks guardados cuya llave incluye un traje de baño: hay que recalcular capsule_look_key en JS (prendas renombradas, re-ordenadas y unidas), no con replace.';
  end if;
end $$;

-- Las prendas del usuario guardan una COPIA del nombre en attrs.nombre. Al
-- resolver gana el del arquetipo (arch.name ?? attrs.nombre), así que la copia
-- vieja no se ve, pero deja el dato inconsistente y algún camino futuro podría
-- leerla. Se sincroniza con su arquetipo.
update public.items i
set attrs = jsonb_set(i.attrs, '{nombre}', to_jsonb(a.name))
from public.archetypes a
where a.id = i.archetype_id
  and a.slug in ('short-bano-marino', 'short-bano-negro-h', 'short-bano-estampado-h')
  and i.attrs->>'nombre' is distinct from a.name;
