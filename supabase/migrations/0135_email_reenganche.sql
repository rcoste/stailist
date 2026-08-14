-- El reenganche de 48h necesita su PROPIA marca de envío.
--
-- Por qué no reusar `email_semanal_last_sent`: esa columna es la idempotencia
-- del semanal (nadie recibe doble si el cron se reintenta) y lleva funcionando
-- desde 0072. Escribirle desde un segundo correo la rompería en silencio — el
-- semanal creería que ya salió esta semana y se saltaría a esa persona.
--
-- El NOMBRE dice la regla: `sent_at`, no `last_sent`. Este correo se manda UNA
-- SOLA VEZ por persona, para siempre (decisión de Roberto, 2026-08-14): es un
-- empujón, no una campaña. Si un correo no la trajo de vuelta, el segundo
-- tampoco — solo se vuelve spam y quema la reputación del remitente, que con
-- una base de 13 personas se cuida sola de a una queja.
--
-- Sirve además para medir sin instrumentación extra: quien tenga actividad
-- POSTERIOR a esta fecha, volvió.
alter table public.profiles
  add column if not exists email_reenganche_sent_at timestamptz;

comment on column public.profiles.email_reenganche_sent_at is
  'Cuándo salió el correo de reenganche de 48h. Null = nunca; se escribe una sola vez.';
