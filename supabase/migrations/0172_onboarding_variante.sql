-- LA PRUEBA A/B DEL ONBOARDING CON FOTOS (2026-10-12).
--
-- Roberto, tras leer la campaña: quien sube su ropa vuelve (4 de 12) y quien
-- no, no (1 de 24); la lista de básicos es un paso caro (2.4 min) con el que
-- se arma un primer look que nadie vota. La apuesta: en vez de la lista,
-- pedir 3 fotos de outfits que usas y armar el primer look con ESA ropa.
--
-- Se prueba a la mitad de la gente (lib/onboarding-variante.ts decide por el
-- id, al arrancar el onboarding) y se guarda aquí para que el admin compare:
-- 'basicos' = la lista de siempre; 'fotos' = las 3 fotos. Las cuentas de
-- antes de la prueba quedan en null y se leen como 'basicos'.

alter table public.profiles
  add column if not exists onboarding_variante text
    check (onboarding_variante in ('basicos', 'fotos'));

comment on column public.profiles.onboarding_variante is
  'Prueba A/B del 2026-10-12: basicos (lista de siempre) o fotos (3 fotos de outfits). null = antes de la prueba.';
