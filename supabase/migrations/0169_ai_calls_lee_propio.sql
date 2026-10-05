-- 0169 · cada quien puede leer SUS recibos de IA. Sin esto, los topes no existen.
--
-- lib/cuotas.ts decide si alguien puede gastar contando sus filas de ai_calls
-- con la sesión de la persona. La 0133 sólo dejaba leer a admins, así que para
-- cualquier cuenta normal la consulta devolvía cero filas y TODOS los frenos por
-- persona (120 fotos, 20 looks, 15 try-ons, 5 avatares y el tope de dinero)
-- decían "no ha gastado nada". Nadie lo vio porque las pruebas a mano se hacían
-- con cuentas admin, que sí leen. Salió a la luz el 2026-10-04: una cuenta nueva
-- gastó ~19 USD en un día con el tope en 5.
--
-- Lo que se abre es mínimo: tarea, modelo y costo de las llamadas PROPIAS. El
-- costo de las demás personas sigue siendo sólo de admins.

drop policy if exists "ai_calls lee propio" on public.ai_calls;
create policy "ai_calls lee propio" on public.ai_calls
  for select using (auth.uid() = user_id);
