# Plan de ataque post-auditoría (2026-09-01)

Responde a `AUDITORIA-pre-release-2026-09-01.md`. Siete bloques, cada uno es
un PR propio con su versión y su entrada de CHANGELOG. Los bloques 1, 2 y 5
tocan base, dinero o auth → van con el ship completo (review con agentes); el
resto con el ship ligero.

Regla del plan: **un bloque no arranca hasta que el anterior está en prod y
verificado en la app**, salvo donde se marca "en paralelo".


> **Decisiones de Roberto (2026-09-06).** Topes de B1 aprobados (20/5/15/120,
> $5 por persona como backstop). Correos **opt-in**. Texto legal: lo redacta
> Claude y lo revisa Roberto. **B3 (recorte del onboarding) CANCELADO**: Roberto
> lo ha recorrido varias veces y lo ve bien —"va generando valor"—; se queda
> como está. Objeción registrada: la mediana medida es 7 min 47 s contra la
> promesa de 2, así que la promesa no vuelve al producto. **B5 será apertura
> total**, no por lotes; los topes de B1 y el cron de vigilancia son la red.
> B0 (#311) y B1 (#312) hechos, pendientes de merge.

## Mapa

```
B0 arreglos de un día ──┬──> B1 blindaje abuso/costo ──┐
                        ├──> B4 instrumento honesto ───┼──> B3 recorte onboarding ──> B5 abrir ──> B6 deuda
                        └──> B2 legal y cuenta ────────┘        (medido con B4)
```

B1, B2 y B4 son independientes entre sí y pueden ir en paralelo si hay tiempo;
B3 necesita B4 (para medir antes/después); B5 necesita B1, B2, B4 y al menos la
primera mitad de B3.

---

## B0 — Arreglos de un día, sin decisiones (ship ligero)

Todo lo que es claramente correcto y no requiere que Roberto decida nada.

| # | Qué | Dónde | Hallazgo |
|---|---|---|---|
| 1 | `next@16.2.11` + `npm audit fix`; correr suite y build | `package.json` | 2.2 |
| 2 | `controller.close()` en `cerrar()` | `app/api/generate/route.ts:124-133` | 2.3 |
| 3 | `error.tsx`, `global-error.tsx` (`<html lang="es">`), `not-found.tsx` en voz; `loading.tsx` en `/hoy` y `/closet` | `app/` | 2.1 |
| 4 | Quitar `is_admin` a `roberto.dev@stailist.app` (SQL a mano, no migración) | base | 2.4 |
| 5 | `globalIgnores` de `.claude/**`, `claude-design-handoffs-stailist/**`, `design_handoff_crear_un_look/**` para que el lint muestre los 40 errores reales | `eslint.config.mjs` | 2.9 |
| 6 | Cabeceras: `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | `next.config.ts` | 4 |
| 7 | Copy: "falta la API key de Anthropic" → mensaje neutro; "0 looks" ≠ "se cortó la conexión"; "Stailist" → "stailist"; "+1 LOOKS" → singular; "Clasico" → "Clásico"; ocasiones y títulos viejos a minúscula; diario "lo que te has puesto" → "tus looks, día por día" | `wow-client.tsx`, `hoy-client.tsx`, `edad-picker.tsx`, esenciales, `perfil/estilo`, `historial` | 4 |
| 8 | Bajar la promesa "<2 minutos" en los 6 lugares a "en unos minutos" (se vuelve a subir cuando B3 la sostenga medida) | `landing.tsx:126,193`, `login/page.tsx:39`, `layout.tsx:27`, `manifest.ts:10`, `invitacion.ts:42,56` | 1.3 |
| 9 | Quitar el link muerto "Aviso de privacidad" (vuelve en B2 con página real) | `landing.tsx:833` | 1.2 |
| 10 | `app/admin/page.tsx:143` filtrar trips borrados; `lib/ultimo-look.ts:73` y cron reenganche filtrar prendas borradas; `email/baja` con `isConsentToken` | varios | 3.4, 4 |
| 11 | `package.json` version = VERSION; borrar `components/email-optin.tsx` y su montaje | raíz, `layout.tsx:56` | 4 |

Esfuerzo: 1 sesión. Verificación: abrir la app, forzar un 404 y un error de
render, ver la landing.

---

## B1 — Blindaje contra abuso y costo (ship completo)

Sin esto, abrir es firmar una factura abierta.

| # | Qué | Cómo | Hallazgo |
|---|---|---|---|
| 1 | **Recibo para toda llamada de IA**, incluidas imágenes | Tarifa por imagen en `lib/proveedores/precios.ts` (precio de lista Gemini imagen); `lib/gemini-imagen.ts` escribe en `ai_calls`; los 14 caminos con SDK directo pasan por `lib/proveedores` (empezar por los 7 que más cuestan: cápsula y viaje) | 3.3 |
| 2 | **Cuota por usuario y día** | Helper `verificarCuota(userId, tarea)` que cuenta en `ai_calls` las últimas 24 h y devuelve 429 con mensaje en voz ("por hoy ya te armé N looks — mañana seguimos"). Topes iniciales propuestos: 20 looks, 5 avatares, 15 try-ons, 40 fotos analizadas, $1.50/día por usuario. Aplicado en las 20 rutas de IA | 1.1 |
| 3 | **Tope global diario** (freno de mano automático) | Si `sum(costo_usd)` del día supera $X (propuesta: $15), el motor responde "el stylist está de descanso" y manda un correo a Roberto | 4 |
| 4 | **Kill switch manual** | Env var `MOTOR_PAUSADO=1` leída en `pipeline.ts` y rutas de imagen | 4 |
| 5 | **Alerta de fallos** | Cron (o `after()` en `lib/proveedores`) que manda correo por Postmark cuando `ai_calls.ok=false` pasa de 5 en una hora, o cuando el proveedor devuelve 402/429 sostenido | 4 |
| 6 | **Validación de imagen única** | `lib/image-file.ts`: lista blanca jpeg/png/webp, ≤3 MB, magic bytes (reusar `mediaTypeOf`); aplicada en las 8 rutas | 1.1 |
| 7 | **Buckets** con `file_size_limit` 3 MB y `allowed_mime_types` | migración | 1.1 |
| 8 | **Cachés compartidas** solo escribibles desde servidor | Quitar policies `authenticated` de `catalog_renders`, `destino_imagenes`, buckets `catalog` y `destinos`; escribir con cliente service-role SOLO en `/api/destino-imagen` y `/api/render-item` | 2.5 |
| 9 | **Rate limit de OTP** | Tabla `login_intentos` (ip, correo, ventana) o regla WAF de Vercel: máx. 3 códigos por correo/hora y 10 por IP/hora; verificar además el límite de Supabase Auth en el dashboard | 1.1 |
| 10 | Revocar `EXECUTE` a `anon` en las 5 funciones internas | migración | 4 |

Esfuerzo: 2–3 sesiones. Verificación: script que dispara 25 generaciones con
la cuenta dev y confirma el 429 en la 21; `/admin/ia` mostrando recibos de
imágenes; intento de subir un SVG rechazado.

**Decisión de Roberto:** los topes (20/5/15/40, $1.50 y $15). Propongo esos
porque Val, la usuaria más activa, hizo 21 looks en su primera semana (3/día).

---

## B2 — Legal y dueño de sus datos (ship completo: toca auth y borrado)

| # | Qué | Cómo | Hallazgo |
|---|---|---|---|
| 1 | Página `/privacidad` | Yo redacto el borrador en voz de la casa (qué datos, para qué, dónde viven —Supabase, región—, qué modelos de IA los ven, cuánto tiempo, cómo borrar, contacto, menores). Roberto lo aprueba o lo pasa por abogado. Pública en `proxy.ts`, enlazada desde landing, login y la pantalla de edad | 1.2 |
| 2 | Página `/terminos` corta | Igual que arriba | 1.2 |
| 3 | **"Borrar mi cuenta"** en Perfil › cuenta | Server action con confirmación de dos pasos: purga Storage (`prendas/{uid}`, `referencias/{uid}`), filas propias, y `auth.admin.deleteUser`. Reusar la lógica de `scripts/reset-usuario.ts` | 1.2 |
| 4 | Correos **opt-in** | Default `email_semanal='off'` en altas nuevas + un toggle en el wow tras el primer 👍 ("¿te mando un look cada lunes?") y en Perfil › cuenta | 1.2 |
| 5 | Editar rango de edad en Perfil | Server action por `withDb`; si pasa a 13–17 re-dispara el consentimiento y bloquea fotos | 1.2 |
| 6 | Registrar la baja de correo con fecha y evento | `email/baja/route.ts` | 3.2 |

Esfuerzo: 1–2 sesiones + el texto legal. Verificación: crear una cuenta de
prueba, subir una foto, borrarla y confirmar en Storage y en la base que no
queda nada.

**Decisiones de Roberto:** aprobar el texto legal; opt-in vs opt-out.
Contraargumento al opt-in: pierdes suscriptores (hoy 12 de 27). A favor: es lo
legal en México para correo comercial, y quien acepta es señal más limpia para
el correo semanal.

---

## B4 — Instrumento honesto (ship ligero; en paralelo con B1/B2)

Va antes de B3 porque sin esto no se puede medir si el recorte funcionó.

| # | Qué | Cómo | Hallazgo |
|---|---|---|---|
| 1 | TTV desde que abre la app | Columna `profiles.onboarding_started_at` escrita al entrar por primera vez a `/onboarding/genero`; `first_outfit_ttv` la usa; el admin excluye valores > 2 h y muestra mediana, no promedio | 3.1 |
| 2 | Helper único `registrarEvento()` | Loguea `error`; en dev lo lanza; reemplaza los 23 inserts sueltos | 3.2 |
| 3 | Eventos que faltan | Migración al CHECK + emisores: `session_open`, `onboarding_started`, `item_added` (source, vía, n), `trip_created`, `trip_outfits_generated`, `outfit_favorited`, `tryon_generated`, `capsule_generated`, `wishlist_added`, `render_generated`, `avatar_uploaded`, `email_unsubscribed`, `swipe_escape_used`; y `onboarding_step` para género y edad | 3.2 |
| 4 | Tabla de migraciones aplicadas + migración que declare `referencias.de_noche/ocasiones/registro` | `scripts/db.mjs` anota; migración nueva | 3.5 |
| 5 | Embudo por pantalla en `/admin` (tiempo mediano por tramo, como la tabla de la auditoría) | `app/admin/page.tsx` | 1.3 |

Esfuerzo: 1 sesión.

---

## B3 — Recorte del onboarding: la promesa (ship ligero, medido)

El 77 % del TTV es onboarding. Este es el bloque de producto y el que más
cambia lo que ve una desconocida.

**Mi propuesta de qué se mueve y por qué (sombrero de stylist + código):**

| # | Cambio | Por qué | Ahorro estimado |
|---|---|---|---|
| 1 | "ya, ármalo" pasa a **CTA primario** en cuanto se cubre arriba+abajo+zapatos; "¿tienes sacos?" queda como link secundario | Hoy el botón más visible te mantiene marcando | 30–60 s |
| 2 | La pantalla de **objetivo desaparece**: el CTA del clóset ya dice "armar mi primer look" y fija `diario` | Confirma una única opción | 9 s + 1 pantalla |
| 3 | El **wizard del wow no pregunta**: momento sale del reloj (`momentoSugerido`), clima de la geolocalización en segundo plano con fallback "templado"; el banner del look permite corregir después | La spec decía "clima: cero pasos agregados" | 30–45 s + 2 pantallas |
| 4 | **Acentos sale del camino** → primera vez en Perfil o tras el primer look; el motor asume "medio" (ya lo hace) | No cambia el primer look | 15 s + 1 pantalla |
| 5 | **Edad sale del camino** para quien no sube fotos: se pide al primer upload de foto (ahí es donde importa el gate de menores) | Solo 13–17 y 55+ aportan línea al motor | 10 s + 1 pantalla |
| 6 | **Intro de venta de colorimetría fuera** (se va directo a la pregunta 1; el "ahora no" se queda como link) | Una pantalla de marketing dentro del onboarding | 10 s |
| 7 | Fix del **reveal que reaparece** tras los pares | Bug visible | — |
| 8 | Swipes: **escape visible desde la carta 10** como botón, no link | Hoy aparece en la 13 y en gris | 10–30 s |
| 9 | Reveal de estilo se **queda** (es el momento de deleite) y pares de corte se **quedan** (entran a 8 de 10 recetas) | Sí cambian el look | — |

Lo que NO propongo tocar: género, swipes (con escape), colorimetría (6
preguntas), básicos, pares de corte.

Estimación propia: de ~24 pantallas a ~16 y de 7m47s a **4–5 min**. No llega a
2 min; llegar a 2 requiere replantear los básicos (57 tarjetas) y eso es otra
conversación. Por eso B0 baja la promesa a "en unos minutos".

**Medición:** TTV mediano (con el instrumento de B4) de las siguientes 10 altas
vs las 18 históricas. Si baja de 5 min, la promesa se puede reescribir con el
número real.

Esfuerzo: 2 sesiones. **Decisión de Roberto:** cuáles de los 8 cambios entran.
Cada uno es reversible por separado.

---

## B5 — Abrir la puerta (ship completo: toca auth)

Solo cuando B1, B2 y B4 están en prod y B3 al menos con los cambios 1–3.

| # | Qué | Cómo |
|---|---|---|
| 1 | Quitar el trigger `enforce_allowlist_on_signup` y el RPC en `sendCode`; o (alternativa gradual) que `join_waitlist` auto-invite en lotes de N/día | migración + `app/login/actions.ts` |
| 2 | Perfil creado al **verificar** el código, no al pedirlo; cron que borra `onboarding_step=0` con más de 7 días | migración `handle_new_user` → `verifyCode` |
| 3 | Landing pública: CTA a `/login`, fuera "Beta privada"; `not_allowed` del login desaparece | `components/landing/*`, `login-form.tsx` |
| 4 | Metadatos para compartir: `metadataBase`, `openGraph`, `opengraph-image` 1200×630 en B&N, `robots.ts` (bloquear `/admin`, `/api`, rutas privadas) | `app/layout.tsx`, `app/` |
| 5 | Correo de invitación deja de decir "beta" | `lib/invitacion.ts` |
| 6 | `README.md` mínimo (el repo es público) | raíz |

Esfuerzo: 1 sesión. **Decisión de Roberto:** abierto total vs auto-invitación
por lotes. Recomiendo **lotes la primera semana** (p. ej. 20/día) porque con los
topes de B1 el riesgo de costo está acotado, pero el de reputación no: si el
primer día entran 200 personas y algo falla, no hay quién las atienda.
Contraargumento: los lotes retrasan la señal. Con 3 usuarias activas por semana
hoy, 20/día ya es 50× el ritmo actual.

---

## B6 — Deuda que no bloquea (después de abrir, ship ligero)

Replanteado con Roberto el 2026-09-07, punto por punto, contra el código y la
base de producción. Lo que se cayó y por qué queda anotado para que nadie lo
"recupere" por leer la auditoría original.

En orden de lo que más ve la usuaria:

1. **Docs que mienten**: reescribir USER-JOURNEY contra el código (flujo real
   de 9 pantallas, OTP, 27 cartas, 57 básicos de mujer, motor v73 en Gemini,
   PWA ✅); marcar la spec original como histórica; CLAUDE.md con la salvedad
   de los modelos `*-image`. Va primero porque es lo único de la lista que
   cobra cada vez que alguien retoma el proyecto.
2. **Corte como dimensión de cada segmento** (antes "toggle de cortes
   cruzados"). Decisión de Roberto: oversize/slim NO es "corte de hombre" ni
   "de mujer"; cada segmento tiene los tres cortes (entallado/recto/holgado)
   y la oxford holgada que pidió Val es una "camisa oxford oversize" del
   catálogo de MUJER, no un toggle al de hombre. Medido en la base
   (2026-09-07): mujer 62/43/27 y 121 sin corte; hombre 10/81/4 y 104 sin
   corte; unisex 1/9/1. Tres tareas: (a) rellenar el corte de los 225
   arquetipos sin marcar; (b) variantes holgado y entallado de los básicos
   clave de hombre; (c) mostrar el corte al elegir en biblioteca y checklist.
3. **Catálogo de básicos de mujer: sólo análisis, sin quitar nada** (Roberto,
   2026-09-07). Cruzar qué arquetipos marcan las 14 mujeres reales vs los 57
   del onboarding. Verificado que sí hay tank top ("Camiseta de tirantes"),
   crop top y top corset. El rediseño propuesto (chaleco, vestido camisero,
   cárdigan, lino, sandalias) sigue APARCADO por Roberto.
4. **Design system**: decidir tokens nuevos vs reemplazo de los 1 287 px
   arbitrarios; los 226 textos <12 px primero.
5. **40 errores de lint**: los 10 `ref` en render de `hoy-client.tsx` primero.
6. **Dos escalas de formalidad con el mismo nombre** (antes "FORMALIDADES
   duplicado"). NO se fusionan: la de la PRENDA (casual / casual-formal /
   formal, `lib/capsule.ts`, repetida como chips en
   `components/prenda-campos.tsx`) y la del EVENTO (casual / semiformal /
   formal / gala / playa, `lib/formalidad.ts`) son conceptos distintos con
   sombrero de stylist. El puente de 5→3 lo hace a mano `lib/engine/alcance.ts`
   y nada lo protege. Arreglo: renombrar para que no choquen
   (`FORMALIDAD_PRENDA` / `FORMALIDAD_EVENTO`), derivar los chips de la
   constante, y un test que fije el puente.
7. **Restos de la paleta vieja**: `public/sw.js` (la página "sin conexión"
   usa fondo y tinta del rebrand anterior; nadie la ve desde junio);
   `#E5E1DD` → `var(--c-line)` en 22 sitios de 18 archivos (4 en rutas del
   servidor → constante en `lib/`); token `--c-scrim` para el velo de los
   sheets. Invisible al ojo, pero viola "cero hex en componentes".
8. **Datos rotos** (3 registros, ninguno visible en la app): `638824a8` es el
   pantalón de traje de Ricardo, generado a partir del saco, con render y en
   1 look; `source='archetype'` sin `archetype_id` porque nació del render del
   saco, no de la biblioteca → corregir el `source`. Los 2 pantalones de
   franela sin imagen son de Roberto (25-26 ago, 0 looks, probablemente del
   clóset de referencia): foto suya o render generado ($0.13 c/u) — pendiente
   su decisión.

**Fuera del bloque, con evidencia:**
- ~~Trajes en onboarding~~: no es problema (Roberto, 2026-09-06). Trajes = las
  dos piezas; sólo saco va en Sacos.
- ~~20 `aria-label` + `userScalable`~~: el hallazgo 2.11 no se sostiene. 6 de
  los 9 botones citados tienen texto visible ("seguir", "atrás", "compartir
  mi pasaporte"); un conteo automático sobre toda la app de usuario da 0
  botones de sólo ícono sin etiqueta. El bloqueo del zoom es a propósito
  (fix #14 del PWA, tradeoff documentado en `app/layout.tsx`).

---

## Calendario propuesto

| Semana | Bloques | Sale en prod |
|---|---|---|
| 1 | B0, luego B1 + B4 en paralelo | app sin errores en inglés, promesa honesta, IA con cuotas y recibos completos, TTV medido bien |
| 2 | B2 + B3 | privacidad, borrar cuenta, opt-in; onboarding recortado y medido en las siguientes altas |
| 3 | B5 (lotes) | puerta abierta 20/día; B6.1 y B6.2 en la misma semana |
| 4+ | B6 | deuda |

Cada bloque termina con: prod verificado abriendo la app, CHANGELOG con el
porqué, y la fila correspondiente de la auditoría marcada como cerrada.
