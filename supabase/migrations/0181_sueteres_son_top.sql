-- UN SUÉTER ES UN TOP, NO UN ABRIGO (2026-10-20).
--
-- La lectura de fotos mandaba "cárdigan" y "suéter grueso" a 'abrigo', y el
-- armado de esenciales y maletas los pide como 'top'. Resultado: 40 prendas de
-- punto guardadas como abrigo, que no cubrían los suéteres de una maleta ni
-- aparecían en "lo elijo de mi clóset". El prompt de visión ya dice que
-- 'abrigo' es sólo la capa exterior (lib/vision-prendas.ts, lib/vision-prenda.ts).
--
-- Esto alinea los datos que ya existen. Idempotente.

-- Los dos básicos del catálogo que eran cárdigans en 'abrigo'.
update public.archetypes
set category = 'top'
where category = 'abrigo'
  and name ~* '^(su[eé]ter|cardig|c[aá]rdigan|jersey|cuello alto|cuello tortuga)';

-- Las prendas subidas por foto (las 38 se corrigieron a mano el 2026-10-20;
-- esto deja constancia y atrapa cualquiera que haya entrado mientras tanto).
update public.items
set attrs = jsonb_set(attrs, '{categoria}', '"top"')
where deleted_at is null
  and archetype_id is null
  and attrs->>'categoria' = 'abrigo'
  and attrs->>'nombre' ~* '^(su[eé]ter|cardig|c[aá]rdigan|jersey|cuello alto|cuello tortuga)';
