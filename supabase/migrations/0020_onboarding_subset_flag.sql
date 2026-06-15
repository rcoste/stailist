-- Separa "biblioteca completa" de "subset del onboarding". El catálogo puede
-- crecer mucho, pero el wow-moment inicial solo debe mostrar un subset curado
-- para que el TTV siga corto. El resto se agrega después desde el clóset
-- ("biblioteca completa").
--
-- Default true = comportamiento actual intacto (todo lo existente sigue en el
-- onboarding). Las prendas nuevas de la biblioteca entran con false. La curación
-- fina del subset (bajar lo existente) se hace en una migración aparte.
alter table public.archetypes
  add column if not exists onboarding_subset boolean not null default true;
