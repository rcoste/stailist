-- Modo viaje v1.1: los OUTFITS que la maleta hace. La cápsula del viaje te dice
-- qué empacar; esto te dice qué ponerte. Looks concretos por ocasión, armados
-- solo con lo que de verdad llevas (lo que tienes + los "parecido" aceptados),
-- generados aparte (en la página del viaje, no al crearlo) para reflejar tus
-- decisiones de empaque y no exceder el límite de 60s de la generación.
-- Forma: [{ ocasion, titulo, porque, prendas: [nombre, ...] }] o null (sin armar).
alter table public.trips add column if not exists outfits jsonb;
