-- Consentimiento parental verificable para menores (13-17). El menor da el
-- correo de su papá/mamá/tutor; le mandamos un link con token; el tutor
-- confirma en una página pública. Mientras no confirme, el menor puede usar la
-- app pero NO subir fotos (cara, cuerpo, prendas, referencia).
alter table public.profiles
  add column if not exists minor_parent_email text,
  add column if not exists minor_consent_token uuid,
  add column if not exists minor_consent_verified_at timestamptz;

comment on column public.profiles.minor_parent_email is
  'Correo del padre/madre/tutor de un menor (13-17) al que se envió la solicitud de permiso.';
comment on column public.profiles.minor_consent_token is
  'Token del link de permiso parental (público, un solo consentimiento activo por perfil).';
comment on column public.profiles.minor_consent_verified_at is
  'Cuándo el tutor confirmó el permiso desde el link. Null = pendiente; las fotos quedan bloqueadas.';
