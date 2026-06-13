-- Género del clóset: lo elige la usuaria al inicio del onboarding. Filtra qué
-- básicos y qué looks de swipe ve. Null hasta que elige (el gate la manda a
-- la pantalla de género). 'unisex' no aplica aquí: una persona elige uno.
alter table public.profiles
  add column if not exists gender text
  check (gender in ('hombre','mujer'));
