-- Rango de edad (se pregunta tras el género). Da contexto de life-stage al
-- motor de outfits (señal SUAVE) y habilita el aviso de menores de edad.
-- Rango, no fecha de nacimiento: menos sensible, suficiente para el styling.
-- minor_ack_at: sello de cuándo un menor DECLARÓ tener permiso (check del
-- onboarding). La verificación real del tutor vive en 0081: sin ella, subir
-- fotos queda bloqueado.
alter table public.profiles
  add column if not exists age_range text,
  add column if not exists minor_ack_at timestamptz;

comment on column public.profiles.age_range is
  'Rango de edad declarado (13-17 | 18-24 | 25-34 | 35-44 | 45-54 | 55+). Contexto de life-stage para el motor; señal suave.';
comment on column public.profiles.minor_ack_at is
  'Timestamp en que un menor (13-17) confirmó tener permiso de padres/tutores. Null si no aplica.';
