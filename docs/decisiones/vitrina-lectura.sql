-- LECTURA DE LA VITRINA DE UNIQLO (docs/designs/vitrina-de-tienda.md).
-- Correr el 2026-11-07 (intermedia) y el 2026-11-24 (final). Cuadrantes:
--   0 vistas y 0 clics  → "sin sujeto" (nadie abrió una maleta con mercado).
--   vistas y 0 clics    → no interesó.
--   ≥1 clic             → interés; la compra se confirma a mano (ella / él).
-- vitrina_vista se cuenta por cuenta, clave y DÍA (DISTINCT), nunca por filas:
-- una card se pinta en cada render y cada regreso a la lista.

-- 1) Resumen: cuentas distintas que vieron y que tocaron, por mercado.
select
  data->>'tienda'                                         as tienda,
  count(distinct user_id) filter (where type = 'vitrina_vista') as cuentas_que_vieron,
  count(distinct (user_id, data->>'clave', created_at::date))
        filter (where type = 'vitrina_vista')             as vistas_cuenta_clave_dia,
  count(distinct user_id) filter (where type = 'tienda_click')  as cuentas_que_tocaron,
  count(*) filter (where type = 'tienda_click')           as clics
from public.events
where type in ('vitrina_vista', 'tienda_click')
  and created_at >= '2026-10-20'
group by 1
order by 1;

-- 2) Por cuenta (sin correo), qué claves vio y cuáles tocó, con la entrada
--    exacta (mercado:productId:color) para cruzar con "compré X".
select
  left(user_id::text, 8)                                  as cuenta,
  data->>'clave'                                          as clave,
  count(distinct created_at::date) filter (where type = 'vitrina_vista') as dias_vista,
  string_agg(distinct data->>'entrada', ' · ')
        filter (where type = 'tienda_click')              as entradas_tocadas,
  max(created_at) filter (where type = 'tienda_click')    as ultimo_clic
from public.events
where type in ('vitrina_vista', 'tienda_click')
  and created_at >= '2026-10-20'
group by 1, 2
order by ultimo_clic desc nulls last, dias_vista desc;

-- 3) Fallos de la API (D4): si hay filas aquí el mismo día del deploy, el
--    cero de arriba es bloqueo, no desinterés.
select created_at::date as dia, clave, count(*) as filas, min(mensaje) as ejemplo
from public.errores
where clave like 'vitrina-uniqlo:%'
group by 1, 2
order by 1 desc, 2;
