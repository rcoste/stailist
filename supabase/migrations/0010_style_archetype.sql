-- Arquetipo de estilo: el perfil de gustos sintetizado por la IA a partir de
-- los swipes. { nombre, descripcion } en voz amiga cool. Se le revela a la
-- persona ("eres minimalista cálido") y enriquece el contexto del motor.
alter table public.profiles
  add column if not exists style_archetype jsonb;
