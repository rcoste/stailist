-- Try-on POR LOOK, no solo del primero de cada lado.
--
-- La primera versión rendereaba únicamente el look 0 de cada lado, para no
-- multiplicar costo y espera. Se quedó corta en cuanto llegó el 👍/👎 por
-- look: Roberto ahora juzga los tres, y solo podía ver puesto el primero.
--
-- `tryons` es {"<índice del look>": "<ruta en el bucket>"}. Se migra lo que ya
-- existe (tryon_path era siempre el look 0) para no re-pagar renders hechos.
-- La columna vieja se queda por ahora: borrarla obligaría a un despliegue
-- coordinado y no estorba.
alter table public.comparador_motor_lados
  add column if not exists tryons jsonb;

update public.comparador_motor_lados
   set tryons = jsonb_build_object('0', tryon_path)
 where tryon_path is not null
   and tryons is null;

comment on column public.comparador_motor_lados.tryons is
  'Try-on por look: {"<índice>": "<ruta del bucket privado>"}. Se pide por par (los dos lados del MISMO índice a la vez) para que el ruido del render quede simétrico entre variantes.';
