-- Segmento del arquetipo: hombre | mujer | unisex. El checklist filtra por
-- esto. Arrancamos solo con hombre (Roberto es el primer usuario); la lista de
-- mujer se activa cuando entre Tatiana, sin tocar schema (solo cambia el filtro).
alter table public.archetypes
  add column if not exists segment text not null default 'unisex'
  check (segment in ('hombre','mujer','unisex'));
