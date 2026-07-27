-- Looks de la cápsula promovidos a outfits reales.
--
-- Por qué: para "verme con este look" (try-on) hace falta una fila en outfits —
-- el try-on se cachea en outfits.tryon_path y la API lo busca por outfit id. Hoy
-- lo único que crea esa fila es el corazón, así que para probarte un look de la
-- cápsula (o del viaje) tenías que favoritearlo, irte al Historial y probártelo
-- ahí. Con esta columna, tocar "verme con este look" crea la fila en silencio
-- (favorited_at null → NO aparece en el Historial) y el try-on queda cacheado.
--
--   capsule_look_key — identidad del look = sus prendas ordenadas y unidas. A
--                      propósito NO es el índice: "rehacer" regenera la lista y
--                      los índices se recorren, así que un favorito guardado por
--                      índice terminaría apuntando a OTRO look. Por contenido,
--                      un look regenerado idéntico reencuentra su fila y uno
--                      distinto simplemente no la toca.
alter table public.outfits add column if not exists capsule_look_key text;

-- Un look de cápsula tiene una sola fila por usuario (idempotente).
create unique index if not exists outfits_capsule_look_idx
  on public.outfits (user_id, capsule_look_key)
  where source = 'capsula';

-- OJO: NO hace falta tipo de evento nuevo. El voto de un look de cápsula se
-- registra como 'vote_up'/'vote_down' CON outfit_id, igual que el look del día
-- — así por fin alimenta la señal de gusto del motor (loadTasteSignal solo lee
-- eventos con outfit asociado). El 'trip_look_vote' del viaje, que no lleva
-- outfit_id, nunca llegó al motor.
