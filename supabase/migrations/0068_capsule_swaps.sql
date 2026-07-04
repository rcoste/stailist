-- Camino A: rechazar/afinar prendas de la cápsula sin dejarla coja (issue #89).
-- Capa de swaps sobre la cápsula ideal (capsule_target queda INMUTABLE): por cada
-- slot rechazado, la alternativa vigente + cuántas ideales se han rechazado (cap 2)
-- + la razón opcional. Se sobrepone al target al leer. Nullable, aditiva, reversible.
alter table public.profiles
  add column if not exists capsule_swaps jsonb;

comment on column public.profiles.capsule_swaps is
  'Record<indice, { item: CapsuleItem, rejectedCount: number, reason?: VetoReason }>. Overlay sobre capsule_target; el target no se muta.';
