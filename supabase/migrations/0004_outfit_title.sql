-- El motor genera un nombre con personalidad para cada outfit ("Limpio y sin
-- esfuerzo") pero solo persistíamos la explicación. El historial y el reload
-- del wow lo necesitan.
alter table public.outfits add column if not exists title text;
