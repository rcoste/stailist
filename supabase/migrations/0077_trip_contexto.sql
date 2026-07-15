-- Texto libre del viaje: "¿algo especial de este viaje?" (un partido, una boda,
-- hiking, "me gusta viajar cómodo"). Mismo lever que el "¿algo en mente?" de Hoy.
-- Afina la cápsula y los looks; se persiste para que la regeneración de looks
-- lo siga usando. Opcional (nullable).
alter table public.trips
  add column if not exists contexto text;
