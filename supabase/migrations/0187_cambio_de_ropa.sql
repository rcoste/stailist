-- 0187 · CUÁNTAS PRENDAS BASE LLEVA UNA MALETA (2026-10-21).
--
-- La maleta contaba suéteres como "tops" y una de 8 días salía con 5 camisas y
-- playeras. Las 14 maletas vivas traían de 3 a 6 prendas base, durara el viaje
-- 2 días o 27. Ahora la base (lo pegado a la piel) es una por día, con dos
-- datos de la persona (lib/trip.ts capsuleFloor):
--
--   · profiles.cambio_ropa — cómo es con la ropa. 'seguido' = se cambia al
--     llegar del vuelo o antes de cenar: ~25% más base. Se pregunta UNA vez,
--     en la maleta, y se guarda. null = no ha contestado (una por día).
--   · trips.lavado — si va a poder lavar en ESE viaje. Sólo se pregunta cuando
--     ni a una por día le cabe el equipaje. null = no se preguntó.
--
-- Las dos van por las políticas que ya existen (own profile update, own trips).

alter table public.profiles
  add column if not exists cambio_ropa text check (cambio_ropa in ('repito', 'seguido'));

alter table public.trips
  add column if not exists lavado boolean;
