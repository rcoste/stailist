-- Cinturones de seguridad del comparador de motores, salidos de la revisión
-- pre-landing del mismo PR que creó las tablas (0107 ya estaba aplicada en la
-- base, por eso van como migración aparte y no como edición).
--
-- Todo aquí es ADITIVO y consistente con los datos existentes (una corrida de
-- prueba con exactamente 2 variantes).

-- 1. El código hace variantes[0].clave / variantes[1].clave sin guardas y la
--    columna solo decía "exactamente 2" en un comentario. Ahora lo dice la base.
alter table public.comparador_motor_corridas
  add constraint comparador_motor_variantes_son_dos
  check (jsonb_typeof(variantes) = 'array' and jsonb_array_length(variantes) = 2);

-- 2. comparador_motor_lados.corrida_id está denormalizada (se escribe desde el
--    request junto con par_id). La ruta ya verifica que el par pertenezca a la
--    corrida; este FK compuesto hace que una mezcla tampoco PUEDA escribirse.
alter table public.comparador_motor_pares
  add constraint comparador_motor_pares_id_corrida unique (id, corrida_id);
alter table public.comparador_motor_lados
  add constraint comparador_motor_lados_par_corrida
  foreign key (par_id, corrida_id)
  references public.comparador_motor_pares (id, corrida_id) on delete cascade;

-- 3. El modelo RESUELTO de cada lado, congelado. prompt_version ya se congela
--    en la corrida, pero la variante "produccion" resuelve su modelo en tiempo
--    de llamada (lib/models.ts) y el juez también: un cambio de modelos a media
--    corrida —pueden pasar días entre bloques— mezclaría dos motores en el
--    mismo marcador y sin estas columnas sería indetectable después.
alter table public.comparador_motor_lados
  add column if not exists modelo_generador text,
  add column if not exists modelo_juez text;

-- 4. Índices para los FK con cascade que no tenían (footgun clásico de
--    Postgres: borrar el registro padre barre la tabla hija sin índice).
create index if not exists comparador_motor_corridas_closet_user
  on public.comparador_motor_corridas (closet_user_id);
create index if not exists comparador_motor_corridas_user
  on public.comparador_motor_corridas (user_id);
create index if not exists comparador_motor_pares_repite_de
  on public.comparador_motor_pares (repite_de);
