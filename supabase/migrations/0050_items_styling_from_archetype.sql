-- Propaga los atributos de styling (largo/corte/manga) del arquetipo ya
-- enriquecido (0049) hacia los items que YA están en clósets — esos copiaron
-- attrs al agregarse, antes del backfill. Merge aditivo, solo source=archetype.
update public.items i
set attrs = i.attrs || (
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from jsonb_each(a.attrs) as e(k, v)
  where k in ('largo', 'corte', 'manga')
)
from public.archetypes a
where i.archetype_id = a.id
  and i.source = 'archetype'
  and i.deleted_at is null;
