-- LOS "TRAJE …" QUE EN REALIDAD SON UN SACO.
--
-- De dónde salieron: el lector de UNA prenda devuelve una sola por diseño —"si
-- hay varias, elige la principal"— y hasta v0.2.155.0 las demás se perdían en
-- silencio. Una foto del traje puesto entrando por esa puerta dejaba el saco
-- leído como prenda principal, el pantalón desaparecido, y un nombre que dice
-- "traje" para algo que es sólo el saco.
--
-- El daño real no es cosmético: el motor recibe el nombre y ya leyó una vez un
-- "Traje marino de lana" como traje completo, armando el look SIN pantalón. La
-- categoría ('saco') sí estaba bien y hoy también va al prompt, así que esto
-- termina de cerrar esa puerta.
--
-- SÓLO RENOMBRA. No crea el pantalón que falta, y es a propósito: no sabemos si
-- esa persona tiene ese pantalón ni cómo es, y no hay foto suya. Inventarle una
-- prenda al clóset es exactamente el problema que este proyecto lleva días
-- persiguiendo. El pantalón lo da de alta quien lo tenga —desde la biblioteca
-- hay "Pantalón de traje azul marino" y 4 colores más— y luego lo ata al saco
-- desde la ficha.
--
-- IDEMPOTENTE: el WHERE exige que el nombre empiece por "Traje", así que en
-- cuanto se renombra deja de coincidir. Re-correrla no hace nada.
update public.items i
   set attrs = jsonb_set(
         i.attrs,
         '{nombre}',
         to_jsonb('Saco de ' || lower(left(i.attrs->>'nombre', 1)) || substr(i.attrs->>'nombre', 2))
       )
  from (select id, category from public.archetypes) a
 where i.deleted_at is null
   and i.attrs->>'nombre' ~* '^traje\M'
   -- "Traje de baño" NO es un traje de sastre: se queda como está.
   and i.attrs->>'nombre' !~* 'de ba[ñn]o'
   and coalesce(i.attrs->>'categoria', a.category) = 'saco'
   and a.id = i.archetype_id;

-- Las prendas de foto no tienen arquetipo, así que el join de arriba las deja
-- fuera: van en su propia sentencia con la categoría que ellas mismas declaran.
update public.items
   set attrs = jsonb_set(
         attrs,
         '{nombre}',
         to_jsonb('Saco de ' || lower(left(attrs->>'nombre', 1)) || substr(attrs->>'nombre', 2))
       )
 where deleted_at is null
   and archetype_id is null
   and attrs->>'nombre' ~* '^traje\M'
   and attrs->>'nombre' !~* 'de ba[ñn]o'
   and attrs->>'categoria' = 'saco';
