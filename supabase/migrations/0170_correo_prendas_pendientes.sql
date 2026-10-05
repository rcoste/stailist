-- 0170 · cuándo se le avisó a alguien que ya se puede seguir puliendo su clóset.
--
-- Las prendas que entran sin imagen limpia por el tope del día (ver
-- lib/renders-pendientes.ts) se pulen cuando la persona vuelve. Al día
-- siguiente se le manda UN correo avisándole (app/api/cron/prendas-pendientes).
-- Esta columna evita mandarlo dos veces por la misma tanda. No va en `events`
-- a propósito: el reenganche de 48h mide la última actividad con esa tabla, y
-- una marca nuestra ahí contaría como si la persona hubiera entrado.

alter table public.profiles
  add column if not exists email_pendientes_sent_at timestamptz;

comment on column public.profiles.email_pendientes_sent_at is
  'Último aviso de "ya puedo seguir con tus prendas" (renders pendientes por el tope diario).';
