-- El modo "ver como" del admin necesita leer los viajes del usuario objetivo.
-- trips era la ÚNICA tabla de datos de usuario sin policy de lectura admin
-- (profiles/items/outfits/events la tienen desde 0015; wishlist desde 0057).
-- Aditiva: solo admins ganan lectura, nadie pierde nada.
drop policy if exists "admin reads trips" on public.trips;
create policy "admin reads trips" on public.trips
  for select using (public.is_admin());
