-- EL CORREO "¿CON QUIÉN VAS?" (2026-10-16). Un día después de armar un viaje,
-- si todavía no empieza, se le recuerda a la persona que puede invitar a quien
-- viaja con ella (app/v/[token], migración 0176). UNA vez por viaje: esta
-- marca es la que lo garantiza, y también la que deja medir si el correo
-- sirvió (viajes con correo → cuántos crearon su link → cuántos se unieron).
alter table public.trips add column if not exists correo_invitar_enviado_at timestamptz;
