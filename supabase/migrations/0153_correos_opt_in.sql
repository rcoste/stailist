-- CORREOS: OPT-IN (bloque B2 de la auditoría, decisión de Roberto 2026-09-06)
--
-- La 0076 (2026-07-15) puso `email_semanal = 'semanal'` por default: todo
-- perfil nuevo entraba suscrito al correo semanal y al reenganche de 48 h, y
-- la salida era la baja de un clic. Con la beta cerrada —27 personas que
-- Roberto invitó una por una— eso era razonable. Con el registro abierto es
-- mandarle correo comercial a desconocidos que nunca lo pidieron, que en
-- México no se puede.
--
-- Vuelve el default a 'off'. Nadie recibe correos sin haber tocado "sí": se
-- pregunta una vez en el home tras el primer 👍 (components/correo-opt-in-card)
-- y siempre se puede cambiar en Perfil › cuenta.
--
-- Los perfiles EXISTENTES no se tocan: quien ya está en 'semanal' lo eligió
-- (o lo aceptó al no darse de baja) y cambiárselo sin avisar sería el error
-- simétrico.
alter table public.profiles
  alter column email_semanal set default 'off';
