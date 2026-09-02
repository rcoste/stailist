# Brief para la auditoría pre-release

Escrito el 2026-09-01 al cerrar la sesión de build, para que la auditoría no
gaste su presupuesto re-descubriendo lo que ya se midió. **Son datos, no
conclusiones**: la auditoría saca las suyas.

Versión en prod al escribir esto: **0.2.299.0** (`917dc28`), en stailist.co.

## Lo que se midió hoy contra la base de PRODUCCIÓN

El `DATABASE_URL` de `.env.local` ES producción. Se consulta con
`node scripts/db.mjs -c "<sql>"`. Todo lo de abajo es de 2026-09-01.

### Gente
- **27 perfiles**: 14 mujer, 10 hombre, 3 sin género.
- Los 3 sin género están en `onboarding_step = 0` con 0 prendas y 0 looks: se
  dieron de alta y nunca entraron.

### Volumen por tabla
| tabla | filas |
|---|---|
| `items` (prendas) | 1012 |
| `events` | 610 |
| `outfits` | 172 |
| `profiles` | 27 |
| `trips` | 9 |

### Instrumentación: el 76% de `events` NO son acciones
`onboarding_step` 144 · `generation_timing` 88 · `critic_review` 86 ·
`hint_seen` 78 · `avatar_judge` 65 = **461 de 610**.
Y **añadir prendas —la acción más común del producto— no escribe ningún
evento** (1012 filas en `items`, 0 en `events`). Los looks: 172 outfits contra
88 `generation_timing`. Los viajes: 9, sin evento.

### Cómo entra la ropa
El **87% de las prendas (879 de 1012) llega en tandas de 6+ en un solo
minuto**; 13 tandas de 20+ suman 384 prendas.

### Catálogo por segmento (el "catálogo sexista" que reportó una usuaria era falso)
| | pantalones/jeans | faldas | sacos |
|---|---|---|---|
| hombre | 33 | — | 12 |
| mujer | **35** | 18 | **13** |
El subset de onboarding: 49 prendas para mujer, 45 para hombre.

### Borrados: la tabla y el evento NO coinciden
21 `items` con `deleted_at` contra 10 eventos `item_deleted` (11 borrados sin
evento). 2 trips borrados = 2 eventos. 5 outfits borrados.

### TTV — el criterio de éxito #1, fallando
La promesa del MVP es **primer outfit en <2 min**. Medido:
Andy **8m31** · Islam **11m20** · Val **11m**. Tres de tres, en la misma
dirección. Se mide con el evento `first_outfit_ttv`.

## Falsos positivos ya descartados (no volver a levantarlos)
- **`profile.gender ?? "hombre"`** en 7 consultas. Parece un default masculino
  peligroso; **no lo es**: `requireStep` ([lib/auth.ts:159]) redirige a la
  pantalla de género antes de tocar esas líneas, y los 3 perfiles sin género
  nunca pasaron del paso 0. Código defensivo inalcanzable.
- **"El negro relleno está reservado a 'generar'"** — era un comentario en
  `capsule-list.tsx`, y era falso: hay 152 botones `bg-accent`+`text-on-accent`
  fuera de admin. Ya corregido en 0.2.298.0.

## Dónde vive el contexto que la auditoría debe leer
- `CLAUDE.md` — la idea, el enemigo a vencer, las reglas de los dos sombreros.
- `docs/USER-JOURNEY.md` — el flujo de valor y el estado de la build.
- `docs/improvement-loop-del-motor.md` — **leer antes de tocar el motor**.
- `CHANGELOG.md` — las últimas 3 entradas son de hoy y traen su porqué.
- `TODOS.md` — trabajo diferido, cada ítem con su "por qué ahora no".

## Lo que quedó abierto
- **Toggle de cortes cruzados en la biblioteca** (`TODOS.md`): hoy una mujer no
  puede añadir una prenda del segmento hombre. Caso real, sin construir.
- La instrumentación no cubre la acción más común (ver arriba). El feed de
  `/admin/actividad` lo esquiva cruzando tablas, pero el hueco sigue.

## Advertencia de método
Los dos bugs que se arreglaron hoy **los encontró gente mirando la app, no la
suite**: 1592 tests en verde y ninguno vio ni el clima de la hora equivocada ni
el botón pintado de `disabled`. Una auditoría que sólo lea código y corra tests
va a repetir ese punto ciego. Hay que abrir la app.
