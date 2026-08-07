-- La dimensión COLOR de la rúbrica (r8/rv3) necesita su bandera, por la misma
-- razón que `con_estilo`: si el perfil no tiene colorimetría, el juez pone 3
-- neutro y promediar ese 3 diría "3.00" con cara de medición sin haber medido
-- nada — y ensuciaría la comparación contra las corridas que sí la midieron.
alter table public.eval_corridas
  add column if not exists con_color boolean not null default false;
