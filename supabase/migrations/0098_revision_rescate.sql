-- Cuarta salida de la segunda vuelta: "me equivoqué, sí sirve y sí es lo mío".
--
-- EL HUECO QUE TAPA
-- La segunda vuelta tenía tres salidas y ninguna decía "me equivoqué". La más
-- cercana —"es del estilo pero no es lo mío"— devuelve la foto a la destilación
-- pero de paso escribe mio = false. Quien descartó una foto por error del dedo
-- en el swipe tenía que declarar que no le gusta para poder rescatarla, y eso
-- ensucia justo el campo que existe para separar el estilo del guardarropa de
-- una persona.

alter table public.referencias
  drop constraint if exists referencias_revision_check;

alter table public.referencias
  add constraint referencias_revision_check
  check (revision is null or revision in (
    'me-equivoque',      -- del estilo Y de su gusto → destila, mio = true
    'no-es-lo-mio',      -- es del estilo pero no es su registro → destila, mio = false
    'mal-ejecutada',     -- del estilo pero mal puesto → no destila
    'no-es-del-estilo'   -- el juez se equivocó → no destila
  ));
