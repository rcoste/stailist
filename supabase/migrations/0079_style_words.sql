-- "Tu estilo en tus palabras" (v24, coherencia de señal): texto libre opcional
-- del perfil donde la persona describe su estilo con sus propias palabras.
-- Es la señal más directa que existe; entra a todos los motores como contexto.
alter table public.profiles
  add column if not exists style_words text;

comment on column public.profiles.style_words is
  'Estilo descrito por la persona en texto libre (<=280 chars, opcional). Entra a todos los motores.';
