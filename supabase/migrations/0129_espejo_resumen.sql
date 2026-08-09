-- LO QUE TRAÍAS PUESTO, EN PALABRAS.
--
-- Roberto, mirando una entrada del diario: "no aparecen todos los thumbnails,
-- solo de dos prendas y no de todas".
--
-- Tenía razón y la causa no era el emparejador. Los thumbnails sólo pueden
-- enseñar prendas que EXISTEN en su clóset: las que se emparejaron y las que
-- sumó. Lo que la foto leyó pero no cayó en ninguna de las dos —su playera y su
-- pantalón caqui— no tiene fila a la que apuntar, así que desaparecía.
--
-- Y lo peor: la app SÍ lo sabía. El consejo empieza describiendo el outfit
-- entero ("chamarra de campo azul marino, playera oscura, pantalón caqui y
-- tenis blancos") y esa lista se tiraba. La entrada del diario terminaba
-- sabiendo menos de lo que la app había leído un segundo antes.
--
-- Con el resumen guardado, la entrada puede decir el outfit completo aunque
-- sólo tenga miniatura de la mitad.
alter table public.outfits
  add column if not exists resumen text;

comment on column public.outfits.resumen is
  'Lo que la persona traía puesto, en una frase (source=espejo). Cubre las prendas que se leyeron pero no existen como fila: sin esto la entrada enseña menos de lo que la app vio.';
