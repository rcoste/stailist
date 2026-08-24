-- EL DIAL DE REGISTRO POR PLAN (capa 2 de las tres capas, 2026-08-24).
-- Roberto: "¿cómo se calibran los gustos según los tipos de planes? No podemos
-- generalizar para todos los usuarios sobre lo que yo diga". Cuánto se arregla
-- alguien para una cita es un dial de esa persona: el default es el consenso
-- del catálogo de eventos y esto guarda sólo los pasos que la persona movió.
alter table public.profiles
  add column if not exists registro_por_plan jsonb;

comment on column public.profiles.registro_por_plan is
  'Record<tipoEvento.key, "relajado"|"arreglado">. Ausente/null = consenso. Lo leen el motor y todos los jueces vía lineaTipoEvento (lib/registro-plan.ts).';
