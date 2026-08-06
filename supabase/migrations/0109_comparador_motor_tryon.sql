-- El try-on del comparador de motores: ver los dos lados de un par puestos en
-- tu avatar, bajo demanda.
--
-- POR QUÉ UNA COLUMNA AQUÍ Y NO UNA FILA EN `outfits`
-- El try-on de producción se cachea en outfits.tryon_path, pero el comparador
-- NO escribe en outfits a propósito: un experimento no debe ensuciar el
-- historial ni restringir lo que el motor de Hoy arma mañana. Así que cada
-- lado guarda su propio render, con la misma semántica (una ruta del bucket
-- privado; null = todavía no se generó).
--
-- SE PIDE POR PAR, NUNCA POR LADO SUELTO: renderear un solo lado dejaría al
-- otro compitiendo con una cuadrícula de prendas, y la comparación mediría
-- el formato de presentación en vez del look.
alter table public.comparador_motor_lados
  add column if not exists tryon_path text;
