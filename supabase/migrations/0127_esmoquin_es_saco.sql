-- LOS "ESMOQUIN …" QUE TAMBIÉN SON UN SACO.
--
-- La misma clase de bug que arregló 0126, y que esa migración no cazó porque
-- filtraba por nombres que empiezan con "Traje": una prenda guardada —bien—
-- como `saco`, pero nombrada como el conjunto entero. Roberto: "¿puedes cambiar
-- el nombre del smoking?".
--
-- Por qué importa más allá de la estética: el nombre llega al motor, y un ítem
-- llamado "Esmoquin negro" en categoría saco es exactamente el patrón que hizo
-- que un "Traje marino de lana" se leyera como traje completo y saliera un look
-- SIN pantalón. La categoría ya va al prompt; el nombre deja de contradecirla.
--
-- El pantalón del esmoquin NO se toca: "Pantalón de esmoquin negro" ya dice lo
-- que es.
--
-- IDEMPOTENTE: el filtro exige que el nombre NO empiece ya por "Saco", así que
-- en cuanto se renombra deja de coincidir.
update public.items i
   set attrs = jsonb_set(
         i.attrs,
         '{nombre}',
         to_jsonb('Saco de ' || lower(left(i.attrs->>'nombre', 1)) || substr(i.attrs->>'nombre', 2))
       )
  from (select id, category from public.archetypes) a
 where i.deleted_at is null
   and i.attrs->>'nombre' ~* '^(esmoquin|smoking|tuxedo)\M'
   and coalesce(i.attrs->>'categoria', a.category) = 'saco'
   and a.id = i.archetype_id;

-- Las prendas de foto no tienen arquetipo: van aparte, con su propia categoría.
update public.items
   set attrs = jsonb_set(
         attrs,
         '{nombre}',
         to_jsonb('Saco de ' || lower(left(attrs->>'nombre', 1)) || substr(attrs->>'nombre', 2))
       )
 where deleted_at is null
   and archetype_id is null
   and attrs->>'nombre' ~* '^(esmoquin|smoking|tuxedo)\M'
   and attrs->>'categoria' = 'saco';
