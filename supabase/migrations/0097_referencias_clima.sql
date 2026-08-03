-- El clima de cada referencia: para qué temperatura está vestido el look.
--
-- POR QUÉ SE ETIQUETA LA FOTO Y NO LA BÚSQUEDA
-- El primer intento fue cosechar "invierno" con la palabra winter en el query
-- de Pinterest. Falló medible: de 22 fotos "winter", solo 7 eran de frío —
-- Pinterest devuelve fotos ETIQUETADAS invierno, no fotos DE invierno. La ropa
-- visible, en cambio, no miente: manga corta y lino es calor, abrigo de lana es
-- frío. Así que el clima se deduce con visión de lo que trae puesto, foto por
-- foto, y la búsqueda deja de cargar con esa responsabilidad.
--
-- null = sin etiquetar todavía (el etiquetador corre aparte de la cosecha).
alter table public.referencias
  add column if not exists clima text
  check (clima is null or clima in ('calor', 'templado', 'frio'));
