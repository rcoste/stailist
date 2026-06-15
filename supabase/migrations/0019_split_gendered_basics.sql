-- Reclasifica los 6 básicos que tienen corte de género DISTINTO. "Unisex" debe
-- significar la MISMA prenda para ambos (p. ej. tenis blancos): una sola imagen,
-- ambos ven lo mismo. El blazer, las camisas, el suéter, la chamarra de
-- mezclilla y las botas tienen corte masculino vs femenino diferente → no son
-- unisex, son prendas con género.
--
-- Resultado: la versión de hombre se queda (segment 'hombre', su imagen actual);
-- la de mujer se crea como prenda propia (segment 'mujer') apuntando a su imagen
-- <slug>-mujer.png que ya existe en public/archetypes/. Así la mujer la ve en su
-- sección de mujer de forma nativa y se elimina el truco de "misma fila, dos
-- fotos" (helper archetypeImageForGender, borrado en el mismo commit).
-- Idempotente.

update public.archetypes set segment = 'hombre'
 where slug in ('camisa-blanca', 'camisa-mezclilla', 'blazer-azul-marino',
                'sueter-gris', 'chamarra-mezclilla', 'botas-negras')
   and segment = 'unisex';

insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order)
select a.slug || '-mujer', a.name, a.category, 'mujer', a.attrs,
       '/archetypes/' || a.slug || '-mujer.png',
       68 + row_number() over (order by a.sort_order)
  from public.archetypes a
 where a.slug in ('camisa-blanca', 'camisa-mezclilla', 'blazer-azul-marino',
                  'sueter-gris', 'chamarra-mezclilla', 'botas-negras')
   and a.segment = 'hombre'
on conflict (slug) do nothing;
