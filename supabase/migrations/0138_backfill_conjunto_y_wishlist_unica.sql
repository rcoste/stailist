-- DOS DEUDAS QUE DEJÓ LA 0137, cazadas por el review adversarial del ship.
--
-- 1) EL LAZO TAMBIÉN PARA LAS PRENDAS QUE YA EXISTEN. La 0137 puso
--    `attrs.conjunto` en los ARQUETIPOS, y las altas copian attrs al insertar —
--    pero las prendas copiadas ANTES de la 0137 se quedaron sin el lazo (hay 4
--    en la base). El estado mixto es el peor de los tres posibles: si esa
--    persona añade ahora la pieza que le falta, la nueva llega CON conjunto y
--    la vieja sin él, los conjuntos no empatan, y la regla `traje-desparejado`
--    del motor le prohíbe su propio traje — exactamente el bug que la 0137
--    existe para arreglar. El backfill hereda el lazo del arquetipo a toda
--    prenda suya que no lo tenga. Las prendas de foto no se tocan (no tienen
--    archetype_id; su lazo lo pone la persona en la carga).
--
-- 2) LA WISHLIST NO PUEDE TENER DOS FILAS DE LA MISMA PRENDA. El toggle hace
--    select-luego-insert sin candado; dos taps rápidos ven los dos "no existe"
--    e insertan doble — y con dos filas, `maybeSingle()` truena, `existing`
--    queda null y cada toggle futuro INSERTA OTRA: la prenda queda pegada en
--    la wishlist para siempre. La tarjeta de traje duplica la ventana (dos
--    round-trips por tap). Hoy no hay duplicados (verificado antes de
--    escribir esto), así que el índice único entra limpio y convierte la
--    carrera en un error visible que la UI ya revierte.

-- 1 ─────────────────────────────────────────────────────────────────────────
update items i
set attrs = i.attrs || jsonb_build_object('conjunto', a.attrs->>'conjunto')
from archetypes a
where i.archetype_id = a.id
  and a.attrs ? 'conjunto'
  and not (i.attrs ? 'conjunto');

-- 2 ─────────────────────────────────────────────────────────────────────────
create unique index if not exists wishlist_items_user_source_key_unica
  on wishlist_items (user_id, source, capsule_key)
  where capsule_key is not null;
