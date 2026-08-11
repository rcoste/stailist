-- El look pedido POR ADELANTADO ("el sábado tengo una cena"). La fecha es
-- calendario LOCAL del dispositivo (el cliente la manda en el request): el
-- server corre en UTC y a las 6pm de CDMX ya cree que es mañana.
--
-- Solo se escribe para fechas FUTURAS; null = el flujo de hoy, intacto. El día
-- D, /api/look-of-day encuentra el look con planned_for = fecha_local y lo
-- promueve a look del día (is_look_of_day + look_date). Si esa fecha ya tiene
-- look del día (índice único parcial outfits_look_of_day_idx), el existente
-- gana y el planeado se queda en historial.
alter table public.outfits
  add column if not exists planned_for date;

comment on column public.outfits.planned_for is
  'Fecha calendario local para la que se pidió el look por adelantado. Null = look normal.';

-- La query del día D: por usuario y fecha, solo entre los planeados.
create index if not exists outfits_planned_for_idx
  on public.outfits (user_id, planned_for)
  where planned_for is not null;
