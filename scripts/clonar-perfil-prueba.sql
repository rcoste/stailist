-- Clona el clóset y el avatar de roberto@kublau.com a un perfil de PRUEBA,
-- y regresa ese perfil al inicio del onboarding.
--
-- PARA QUÉ
-- El A/B del recetario necesita un perfil hecho con el onboarding ACTUAL: el
-- deck de hombre se rehizo entero (v4), hubo canje de cartas, y los pares de
-- corte se añadieron después de que todo el mundo ya estaba dentro. El perfil
-- real de Roberto tiene tags del 27 de julio y fit_pref en null, así que medir
-- con él es medir un motor alimentado con datos viejos.
--
-- Y el cl_set se CLONA (idea suya) para comparar manzanas con manzanas: sus 127
-- prendas de verdad, no un sorteo del catálogo. Nadie puede juzgar un look
-- armado con ropa que no conoce.
--
-- QUÉ SE PIERDE (aprobado por él): las 30 prendas, 3 outfits y 16 eventos que
-- tenía el perfil de prueba. El respaldo del estado previo queda en
-- docs_para_claude/respaldos/.
--
-- LO QUE NO SE TOCA: roberto@kublau.com. Este script solo LEE de ahí.
--
-- Uso: node scripts/db.mjs scripts/clonar-perfil-prueba.sql

begin;

-- Los dos perfiles, para no repetir el subselect en cada paso.
create temporary table _ids as
select
  (select id from public.profiles where email = 'roberto@kublau.com') as origen,
  (select id from public.profiles where email = 'roberto@playrobix.com') as destino;

-- Aborta si falta cualquiera de los dos: sin esto, un email mal escrito
-- borraría el perfil equivocado y clonaría desde null.
do $$
declare o uuid; d uuid;
begin
  select origen, destino into o, d from _ids;
  if o is null then raise exception 'No encontré roberto@kublau.com'; end if;
  if d is null then raise exception 'No encontré roberto@playrobix.com'; end if;
  if o = d then raise exception 'Origen y destino son el mismo perfil'; end if;
end $$;

-- 1. Limpiar el destino. Borrado DURO a propósito: el deleted_at deja las
--    prendas fuera de las lecturas pero seguirían contando en el clóset del
--    motor si algún día se filtra mal, y aquí el punto es partir de cero.
delete from public.events   where user_id = (select destino from _ids);
delete from public.outfits  where user_id = (select destino from _ids);
delete from public.items    where user_id = (select destino from _ids);

-- 2. Clonar el clóset. Se copia también render_path/photo_path: apuntan a
--    objetos del bucket privado que ambos perfiles pueden leer vía RLS de admin,
--    y regenerar 127 renders costaría horas para ver exactamente lo mismo.
insert into public.items (user_id, source, archetype_id, attrs, photo_path, render_status, render_path, created_at)
select (select destino from _ids), source, archetype_id, attrs, photo_path, render_status, render_path, now()
from public.items
where user_id = (select origen from _ids) and deleted_at is null;

-- 3. El perfil: avatar y cuerpo se clonan (el avatar es lo que pidió); todo lo
--    que produce el onboarding se limpia para que el flujo se haga de verdad.
--    El GÉNERO y la EDAD se conservan a propósito: son antesalas que van antes
--    del paso 0 y volver a pedirlas no aporta nada al experimento.
update public.profiles p
set avatar_path      = o.avatar_path,
    body_build       = o.body_build,
    body_volume      = o.body_volume,
    body_type        = o.body_type,
    height_cm        = o.height_cm,
    gender           = o.gender,
    -- Lo que el onboarding vuelve a producir:
    onboarding_step  = 0,
    -- taste_tags y journey_state son NOT NULL con default '[]' / '{}': se
    -- vacían, no se anulan. (Poner null aquí aborta la transacción entera — que
    -- es justo lo que se quiere de un NOT NULL, pero hay que escribirlo bien.)
    taste_tags       = '[]'::jsonb,
    style_archetype  = null,
    palette_season   = null,
    palette_flow     = null,
    palette_quiz     = null,
    fit_pref         = null,
    style_questions  = null,
    -- Derivados que quedarían inconsistentes con un clóset y gustos nuevos:
    capsule_target   = null,
    capsule_match    = null,
    capsule_outfits  = null,
    capsule_outfits_sig = null,
    journey_state    = '{}'::jsonb,
    last_objective   = null,
    updated_at       = now()
from public.profiles o
where p.id = (select destino from _ids)
  and o.id = (select origen from _ids);

commit;

-- Verificación: debe salir el destino con las mismas prendas que el origen,
-- avatar puesto y paso 0.
select p.email, p.onboarding_step, p.gender, (p.avatar_path is not null) as avatar,
       p.taste_tags is null as sin_tags, p.fit_pref,
       (select count(*) from public.items i where i.user_id = p.id and i.deleted_at is null) as prendas
from public.profiles p
where p.email in ('roberto@kublau.com', 'roberto@playrobix.com')
order by p.email;
