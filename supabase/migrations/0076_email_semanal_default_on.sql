-- Auto-enrolar usuarios NUEVOS al correo semanal (decisión de Roberto 2026-07-15).
-- El perfil se crea por trigger (0001_initial.sql) sin especificar email_semanal,
-- así que aplica el default de la columna. Cambiar el default de 'off' → 'semanal'
-- enrola a todo perfil nuevo; los perfiles EXISTENTES no se tocan (siguen con su
-- valor actual). La baja de un clic y el prompt de "me lo puse" siguen dando salida.
alter table public.profiles
  alter column email_semanal set default 'semanal';
