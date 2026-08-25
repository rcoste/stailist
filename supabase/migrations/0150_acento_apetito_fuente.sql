-- DE DÓNDE salió el apetito de acentos — porque no todas las fuentes pesan
-- igual. Roberto, sobre la derivación de swipes (2026-08-25): "estás
-- asumiendo algo muy importante a partir de las imágenes de los swipes" —
-- y tiene razón: gustar de la carta "Minimalista" mide afinidad con esa
-- ESTÉTICA completa, no volumen de color. La derivación queda como SEMILLA;
-- la medición real es la pantalla dedicada (mismo look, tres niveles de
-- acento), y el manual siempre gana.
--
-- 'swipes'  = derivado del mazo (semilla, confianza baja)
-- 'elegido' = la persona lo eligió en la pantalla de acentos o en Perfil
alter table public.profiles
  add column if not exists acento_apetito_fuente text
  check (acento_apetito_fuente in ('swipes', 'elegido'));

-- Los 24 backfilleados de 0149 son todos derivados.
update public.profiles
  set acento_apetito_fuente = 'swipes'
  where acento_apetito is not null and acento_apetito_fuente is null;
