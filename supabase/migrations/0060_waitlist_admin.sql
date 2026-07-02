-- La waitlist (0059) nació sin policies de cliente. Para gestionarla desde el
-- admin (ver quién pidió entrar, invitar con un clic) el admin necesita LEERLA,
-- igual que ya lee la allowlist (0015). Solo lectura: invitar es un INSERT en
-- allowlist (que ya tiene su policy de admin), no se escribe la waitlist desde
-- el cliente. El alta pública sigue por la función SECURITY DEFINER join_waitlist.
create policy "admin reads waitlist" on public.waitlist
  for select using (public.is_admin());
