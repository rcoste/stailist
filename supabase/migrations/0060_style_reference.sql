-- Estilo de referencia: el usuario sube una foto de alguien cuyo estilo le gusta;
-- guardamos un resumen de estilo (+ tags + path de la foto en bucket privado) para
-- inspirar la generación de outfits (vibe/silueta, NO colores). JSONB para no
-- multiplicar columnas: { summary, tags, image_path }.
alter table profiles add column if not exists style_reference jsonb;
