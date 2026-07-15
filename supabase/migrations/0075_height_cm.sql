-- Altura opcional (avatar A3): mejora las proporciones del avatar y los
-- try-ons. Se captura en el paso "cuerpo" del wizard de avatar; opcional.
alter table public.profiles
  add column if not exists height_cm integer
  check (height_cm is null or (height_cm between 100 and 230));
