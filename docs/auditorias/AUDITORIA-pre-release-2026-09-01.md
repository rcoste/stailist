# Auditoría pre-release — stailist 0.2.299.0 (2026-09-01)

Última revisión antes del release público. Responde al brief de
`BRIEF-pre-release.md`. Método: cuatro auditores en paralelo (seguridad, datos e
instrumentación, código y calidad, producto y release) sobre el repo y la base
de PRODUCCIÓN (solo `SELECT`), más un recorrido a mano de la app en el navegador
—landing, login, onboarding completo desde cero como mujer con la cuenta
`roberto.dev@stailist.app`, home, clóset, diario, perfil, wizard de crear look—
porque el brief advierte que los dos últimos bugs los encontró gente mirando la
app, no la suite.

Cada hallazgo dice **CONFIRMADO** (visto en código, base o pantalla) o
**ESTIMADO**. No se repiten los falsos positivos que el brief ya descartó.

## Veredicto

**No se puede abrir al público tal como está.** No por el motor ni por la
seguridad de los datos —RLS completa, admin con doble check, sin service role en
la app, tests/tipos/build en verde— sino por cuatro cosas que convierten
"cualquiera se registra" en factura, spam y problema legal:

1. **Cero cuotas ni rate limit en las 20 rutas de IA**, y el login crea cuenta
   y manda correo con solo teclear un correo.
2. **No existe aviso de privacidad** (el único link apunta a `#`), no hay forma
   de borrar la cuenta y sus fotos, y los correos van encendidos por default —
   en un producto que guarda fotos de cara y cuerpo y tiene flujo de menores.
3. **La promesa "<2 minutos" está impresa en seis lugares y falla 4× en el 100%
   de los casos medidos** (mediana 7 min 47 s, n=18). El 77% del tiempo es el
   onboarding, no la IA.
4. **El producto se describe a sí mismo como beta cerrada** (landing, login,
   correo de invitación).

Como beta cerrada de 27 personas conocidas, la app está bien construida.

---

## 1. Bloqueantes del release público

### 1.1 Abuso y costo: sin cuotas, sin rate limit, OTP abierto — CONFIRMADO

- Ninguna ruta bajo `app/api/` salvo `/api/permiso` tiene limitador
  (`grep -ri "rate.?limit|cuota|quota"` → solo `app/api/permiso/route.ts:34`,
  y ese es en memoria por instancia). Rutas afectadas: `generate` (`:38`),
  `look-of-day` (`:148`), `analizar-prendas` (`:19`), `avatar/generate`
  (`:282`), `tryon` (`:16`), `espejo` (`:26`), `trip` (`:62`) y el resto.
- Costo medido en `ai_calls`: motor + juez ≈ **$0.049 por look** → una cuenta
  maliciosa con un `for` de 1000 POSTs = ~$49, más minutos de función Vercel
  (`maxDuration` 60–120 s). Avatar, try-on y renders (Gemini imagen) **no dejan
  recibo**, así que su costo real ni se ve (ver §3.3).
- El único candado de alta es el trigger `enforce_allowlist_on_signup`
  (`supabase/migrations/0003_enforce_allowlist.sql:20-23`) + el RPC
  `is_email_allowed` (`app/login/actions.ts:40-50`). Al quitarlos,
  `signInWithOtp({ shouldCreateUser: true })` (`actions.ts:52-55`) crea
  `auth.users` **y** `profiles` (trigger `handle_new_user`,
  `0001_initial.sql:52-66`) antes de verificar nada: cada correo tecleado es una
  fila y un correo de Postmark desde stailist.co. Los perfiles en paso 0 de hoy
  son exactamente eso. Cooldown de reenvío solo en cliente
  (`login-form.tsx:92`, 60 s).
- Buckets: los 5 tienen `file_size_limit` y `allowed_mime_types` en `null`.
  Uploads sin validar tamaño ni magic bytes en 8 rutas
  (`analizar-prenda/route.ts:43`, `analizar-prendas:40`, `analizar-cuerpo:50`,
  `espejo:52`, `espejo/prendas:50`, `render-prenda:59`,
  `estilo-referencia:78-102` —guarda el archivo con el `contentType` que declaró
  el cliente—, `contar-personas:29`). El único techo es el de Vercel (4.5 MB).

**Fix.** Tope por usuario y día leído de `ai_calls` (ya tiene `user_id`,
`tarea`, `costo_usd`): p. ej. 30 looks/día, 10 avatares/día, $1/día → 429 con
mensaje amable. Rate limit de OTP por IP y correo (WAF de Vercel o contador en
DB) + captcha (Turnstile) en login; o crear el perfil al **verificar** el
código, no al pedirlo. Helper único de imagen (`lib/image-file.ts` existe):
lista blanca jpeg/png/webp, ~3 MB, magic bytes (reusar `mediaTypeOf` de
`avatar/generate/route.ts:181`). `file_size_limit` + `allowed_mime_types` en
los 5 buckets.

### 1.2 Legal y datos personales — CONFIRMADO

- `components/landing/landing.tsx:833`: `<a href="#">Aviso de privacidad</a>`.
  Verificado en vivo en stailist.co. No hay ruta `/privacidad`, `/terminos` ni
  `/legal` en el build.
- **Borrar cuenta: no hay UI.** `lib/delete-actions.ts` solo borra outfits y
  viajes (suave). El único camino es `scripts/reset-usuario.ts` (terminal), que
  además conserva la cuenta. El texto del permiso parental promete "pedir que
  borremos sus datos escribiendo a hola@stailist.co"
  (`app/api/permiso/route.ts:75-82`): la vía es manual.
- **Correos opt-out por default**: `0076_email_semanal_default_on.sql` pone
  `email_semanal='semanal'` a todo perfil nuevo; semanal (lunes) y reenganche
  48 h salen a todo `onboarding_step >= 5`. Hay baja de un clic
  (`app/api/email/baja/route.ts`) pero sin fecha ni evento: no se puede saber
  cuántas bajas reales hay (13 de los 15 `off` son altas anteriores al default).
- **Edad inmutable** una vez puesta (`app/onboarding/edad/actions.ts:20-23`) y
  sin edición en Perfil: quien se equivoque de rango queda atrapado hasta que
  Roberto lo corrija a mano.
- Menores: el gate está bien blindado (trigger `0082`, `photosGate` en las 9
  rutas que reciben fotos, fail-closed). Token UUID v4 no adivinable, no
  expira. Hoy 1 menor, verificado.

**Fix.** Página `app/privacidad` (qué datos, para qué, dónde —Supabase—, qué
modelos de IA los ven, retención, cómo borrar, contacto) enlazada desde landing,
login y edad, añadida a `proxy.ts:isPublic`; "borrar mi cuenta" en Perfil
(server action que reuse `reset-usuario` + `auth.admin.deleteUser` + purga de
Storage); default `email_semanal='off'` o checkbox de opt-in; edición del rango
de edad con re-disparo del consentimiento si pasa a menor.

### 1.3 La promesa de 2 minutos vs 7 min 47 s — CONFIRMADO

Reconstrucción con `onboarding_step` (min `created_at` por paso) y
`profiles.created_at`, sin admin ni cuentas dev, solo quien cerró el onboarding
en < 2 h. **n = 18.**

| Tramo | Qué incluye | Mediana |
|---|---|---|
| alta → paso 1 (gustos) | correo + OTP + género + edad + 13–27 swipes | **143 s** |
| paso 1 → 2 (colorimetría) | reveal de estilo, 2 pares de corte, quiz 6 preguntas, reveal de paleta, acentos | **105 s** |
| paso 2 → 3 (básicos) | checklist (eligen 6–37 prendas; mediana 17) | **113 s** |
| paso 3 → 4 (objetivo) | pantalla "tu primer look" | 9 s |
| paso 4 → 5 (generación) | wizard de 2 pasos del wow + motor | **47 s** (el modelo tarda 13–30 s) |
| **Total** | | **467 s** (mín 243 s, máx 838 s) |

Nadie ha bajado de 4 minutos. **Onboarding declarativo = 361 s = 77 %; la
generación = 10 %.** Bajar el motor a 0 s deja el TTV en 7 min.

Conteo en código del camino mínimo (usando todos los escapes): **≈24 pantallas
y ≈45 taps**; ≈60+ sin escapes. La spec (`docs/designs/mvp-onboarding-90s.md`)
tenía 4 pasos y ~30 taps. Lo que se agregó después y la spec no tenía: género,
edad, reveal de estilo (llamada a IA), 2 pares de corte, intro de venta de
colorimetría + reveal, acentos, 7 pestañas de básicos (57 tarjetas mujer / 53
hombre en vez de 15), wizard de 2 pasos dentro del wow ("¿cuándo es?" y "¿cómo
está el clima?" con diálogo de geolocalización), elegir 1 de 3.

Visto en el recorrido a mano (CONFIRMADO en pantalla):
- El checklist, una vez cubierto arriba+abajo+zapatos, pinta como **CTA
  primario "¿tienes sacos? →"** y deja "ya, ármalo" como link gris
  (`app/onboarding/closet/checklist.tsx:114-132`, `:361-369`). El botón más
  visible te mantiene marcando; el que genera está escondido.
- Tras los 2 pares de corte, la pantalla del reveal ("TU ESTILO · Ecléctica sin
  miedo · Ahora, cómo te queda") **reaparece ~1.5 s** mientras
  `getCalibrationQuestions()` resuelve (`swipe-deck.tsx:124-136` pone
  `setPares(false)` antes del `await`; el render cae en `if (archetype)`
  `:377`). Un tap ahí repite los pares.
- El swipe muestra "1 de 27" y el escape ("con estas ya te leo — seguir") solo
  aparece a partir de la carta 13. Bien, pero 27 cartas × (decisión + 220 ms de
  animación, `swipe-deck.tsx:198-205`) no son los "30 s" del journey. (Medí 1.4 s
  de bloqueo por carta en dev, pero la imagen optimizada en prod pesa 83 KB y
  llega en 0.5 s: el bloqueo es artefacto de dev, no lo cuento.)
- La generación real tardó **13.3 s de servidor / 16 s percibidos** y entregó
  2 looks (no 3) con 4 básicos. Las frases de espera con datos reales funcionan.
- Persistencia por paso: CONFIRMADA (al reabrir `/` volví a `/onboarding/closet`).

Con sombrero de stylist, lo que **sí** cambia el primer look: género, swipes,
pares de corte (`fit_pref` entra a 8 de 10 recetas), colorimetría (near-face),
básicos. Lo que **no** y podría irse tras el wow: edad para 18–54
(`lib/edad.ts:41-50`: solo 13–17 y 55+ aportan línea), reveal de estilo, intro de
venta de colorimetría, acentos (el motor asume "medio" y la semilla de swipes ni
viaja: `paso-acentos.tsx:12-13`), la pantalla de objetivo (confirma una sola
opción; el CTA del clóset ya dice "armar mi primer look"), y los 2 pasos del
wizard del wow (el "cuándo" ya sale del reloj, `weather-picker.tsx:326-328`).
Estimación propia: 6–7 pantallas y 2–4 minutos menos.

**Y el instrumento está roto (ver §3.1):** el TTV se mide desde
`profiles.created_at`, que es cuando pidió el código. Lo comprobé en vivo: mi
corrida con la cuenta dev registró `first_outfit_ttv = 6 927 351 s` (80 días).

**Fix inmediato:** bajar la promesa en los 6 lugares (`landing.tsx:126-127,193`,
`login/page.tsx:39`, `layout.tsx:27`, `manifest.ts:10`, `invitacion.ts:42,56`)
hasta que el TTV medido la sostenga. **Fix de fondo:** recortar el onboarding
como arriba y hacer de "ya, ármalo" el CTA primario en cuanto se cubre el
mínimo.

### 1.4 El producto se presenta como cerrado — CONFIRMADO

- Landing: "Beta privada · solo por invitación" (`waitlist-form.tsx:117-122`),
  "Beta privada. Si aún no tienes invitación, te anoto en la lista."
  (`landing.tsx:817`). El CTA dice "Armar mi primer look" y entrega "Te anoté
  en la lista." (`waitlist-form.tsx:101` → `:66`).
- Login sin allowlist: "Por ahora la beta es por invitación. ¿Quieres entrar?
  Pídele tu lugar a Roberto." (`login-form.tsx:49-52`).
- Correo de invitación: "te invitaron a la beta" (`lib/invitacion.ts:49`).

---

## 2. Altos (no bloquean solos, pero duelen la primera semana)

### 2.1 Pantallas de error y 404 en inglés — CONFIRMADO en navegador
`find app -name 'error.tsx' -o -name 'global-error.tsx' -o -name 'not-found.tsx'`
→ 0. `/pagina-que-no-existe` muestra el "404 · This page could not be found."
de Next, sin logo ni camino de vuelta. Cualquier excepción en render muestra
"Application error…" en inglés (`next.config.ts:51-54` documenta un caso real
con `<Image>`). Fix: `app/error.tsx`, `app/global-error.tsx` (con
`<html lang="es">`), `app/not-found.tsx`, y `loading.tsx` en `/hoy` y `/closet`.

### 2.2 `next` 16.2.9 con DoS conocido en Server Actions — CONFIRMADO
`npm audit --omit=dev`: 4 high. GHSA-m99w-x7hq-7vfj (DoS en Server Actions)
aplica (7 archivos `"use server"` con IA). GHSA-6gpp-xcg3-4w24 (bypass de
proxy con i18n) NO aplica. Fix: `next@16.2.11` + `npm audit fix` (nanoid);
correr suite y build.

### 2.3 El stream de `/api/generate` nunca se cierra — CONFIRMADO
`app/api/generate/route.ts:124-133`: `cerrar` pone `cerrado = true` y luego se
llama a sí misma, que regresa en la primera línea; `controller.close()` no
existe en el archivo. El cliente sobrevive porque corta al leer `{done}`
(`wow-client.tsx:139-149`), pero cada invocación queda viva hasta que el cliente
desconecta o vence `maxDuration = 60`. Introducido en `ec6f1b5` (2026-08-09)
tapando un "Controller is already closed". Fix: `controller.close()` dentro del
`try`.

### 2.4 Cuentas de prueba con contraseña en producción, una admin — CONFIRMADO
`roberto.dev@stailist.app` tiene `is_admin = true`; `claude.dev@stailist.app`
está en paso 5. El gate `NODE_ENV` de `app/login/dev-actions.ts:12-22` solo
tapa el botón: la API de Supabase Auth (`/auth/v1/token?grant_type=password`)
es pública con la anon key. La contraseña es fuerte (`Dev-<uuid>`), riesgo real
bajo, pero es un admin con un segundo factor de autenticación que el producto no
diseñó. Fix: quitar `is_admin` a la cuenta dev (o borrar ambas de prod y usar
base local), o desactivar el proveedor email+password en Supabase Auth.

### 2.5 Cachés compartidas escribibles por cualquier usuario — CONFIRMADO
Políticas `using/with check (true)` para `authenticated`: `catalog_renders`
insert (`0061_catalog_renders.sql:23-25`), `destino_imagenes` insert+update
(`0134_destino_imagenes.sql:24-28,56-60`) y los buckets públicos `catalog`
(insert) y `destinos` (insert+update sin restricción de ruta). Con supabase-js y
la anon key, un usuario sube una imagen a `destinos/tokio.webp` y todos la ven
en su viaje. Fix: escribir esas cachés solo desde servidor (`/api/destino-imagen`
y `/api/render-item` ya existen) y quitar las policies de escritura al cliente.

### 2.6 El TTV, los eventos y el costo: tres instrumentos que mienten
Ver §3. Resumen: el KPI #1 se mide mal; 23 inserts a `events` no leen `error`;
añadir prenda, crear viaje, favorito, try-on, avatar, login no emiten evento;
el costo de IA registrado ($2.58 en 19 días) es ~¼ del real porque ninguna
imagen deja recibo.

### 2.7 Onboarding: fricción por diseño
Detallada en §1.3. Además: `app/onboarding/wow` pide permiso de geolocalización
en el primer minuto; con el permiso denegado muestra un aviso técnico ("tu
navegador tiene la ubicación bloqueada… actívala en sus ajustes") y una segunda
pantalla de 5 bandas de temperatura + "¿va a llover?".

### 2.8 Design system: el "guardrail duro" tiene 1 300 valores sueltos — CONFIRMADO
`grep '\b[a-z-]+-\[[0-9.]+px\]'` en app de usuario → **1 287** clases con px
arbitrarios (`text-[11px]` ×133, `text-[13px]` ×114, `text-[15px]` ×70,
`text-[12.5px]` ×51, `text-[10px]` ×51, medios píxeles inventados…); **226**
textos por debajo de los 12 px que DESIGN.md fija como mínimo. Peores:
`weather-picker.tsx` 156, `trip-wizard.tsx` 120, `trip-result.tsx` 59,
`capsule-list.tsx` 52, `espejo-flow.tsx` 45, `closet-grid.tsx` 42,
`swipe-deck.tsx` 41. Color: `"#E5E1DD"` como swatch de respaldo en **17
copias** (`generate/route.ts:261`, `look-of-day:821,837`, `closet/page.tsx:169`,
`wow/page.tsx:155`, `biblioteca-picker.tsx:277,355`, `checklist.tsx:231,300`,
`espejo-flow.tsx:1592`, `closet-picks.ts:54`…) —`app/hoy/page.tsx:18-19` lo
reemplazó por `--c-line` solo ahí—; 23 `rgb(20 20 20 / .5)` de scrim en 17
archivos (candidato a token `--c-scrim`); `public/sw.js:5` usa la paleta v1
muerta. **Bien:** 0 colores Tailwind por defecto, veto ámbar/naranja respetado.
Decisión de Roberto: ampliar la escala con tokens en DESIGN.md + `globals.css`
en el mismo commit, o reemplazar. Lo que no puede quedar es el estado actual.

### 2.9 Lint en rojo y escondido; 33 errores del React Compiler — CONFIRMADO
`npm run lint` → 46 427 problemas, 99.9 % de `.claude/worktrees/` y
`claude-design-handoffs-stailist/` que `eslint.config.mjs:9-15` no ignora
(vitest sí). Detrás quedan **40 errores reales**: `app/hoy/hoy-client.tsx:642-656`
lee `lastInput.current` durante el render (10×; con React Compiler puede mostrar
el plan de la generación anterior); `setState` síncrono en efectos en 12
archivos; `Date.now()` en render de server components (`admin/page.tsx`,
`perfil/page.tsx:110`). Fix: 1 línea en `globalIgnores`, después atacar los 40.

### 2.10 Sin metadatos para compartir — CONFIRMADO
`app/layout.tsx:25-30` solo `title` y `description`. 0 `openGraph`, `twitter`,
`metadataBase`, `opengraph-image`, `robots.ts`, `sitemap.ts`. Compartir
stailist.co en WhatsApp no muestra imagen ni título propio.

### 2.11 Accesibilidad básica
20 botones de solo ícono sin `aria-label` en app de usuario
(`historial-look-detail.tsx:243,259`, `history-list.tsx:529`,
`paso-acentos.tsx:56`, `swipe-deck.tsx:431`, `pasaporte-share.tsx:85,96,105`,
`trip-wizard.tsx:350,735`, `weather-picker.tsx:1002`…). `viewport` con
`userScalable: false` (`layout.tsx:36-38`, WCAG 1.4.4; iOS lo ignora igual).

---

## 3. Datos e instrumentación (contra la base de producción)

### 3.1 El TTV se mide desde que pide el código — CONFIRMADO
`app/api/generate/route.ts:337-339`: `ttvSeconds = now − profile.created_at`, y
`profiles.created_at` lo pone el trigger al insertar en `auth.users`, es decir
al **teclear el correo**. 5 de 23 mediciones son basura (roberto 65 días,
alberto 59, nuri 4.7, cyortega 6.4 h, tatianacoste 5.3 h) y las 18 restantes
incluyen el viaje al buzón. `/admin/page.tsx:244` las promedia sin filtrar.
Fix: `onboarding_started_at` al entrar por primera vez a `/onboarding/gustos`;
excluir > 2 h del promedio.

### 3.2 Eventos que se pierden en silencio y acciones sin evento — CONFIRMADO
- 23 inserts a `events` sueltos; `lib/veto-actions.ts:42-46`,
  `lib/delete-actions.ts:39-44`, `lib/avatar-actions.ts:83`, `lib/hints.ts:35`,
  `lib/intros.ts:51`, `app/perfil/actions.ts:184`, `lib/trip-actions.ts:438,650`
  no leen `error`. Datos: 2 perfiles con vetos y 0 `style_vetoes_edit`; 5
  outfits borrados y 0 `outfit_deleted`.
- Sin evento: añadir prenda (1026 filas, 388 fotos de 14 personas), crear viaje
  (9), looks de viaje (11), favorito (28), try-on (74), cápsula (14 perfiles),
  wishlist (30), render (384), avatar subido, login, género, edad, escape del
  swipe, baja de correo. Tipos en el CHECK sin emisor: `pwa_prompt_shown`,
  `pwa_installed`.
- Fix: helper único `registrarEvento()` que loguee `error`, y una migración con
  `session_open`, `onboarding_started`, `item_added`, `trip_created`,
  `outfit_favorited`, `tryon_generated`, `capsule_generated`, `wishlist_added`,
  `render_generated`, `avatar_uploaded`, `email_unsubscribed`,
  `swipe_escape_used`.

### 3.3 El costo de IA que se puede citar es ~¼ del real — CONFIRMADO + ESTIMADO
`ai_calls` (desde 2026-08-13): 291 llamadas, 0 fallos, **$2.58**; juez $1.76
(2.8× el motor), motor $0.63, visión $0.10. Primera semana: Val $0.88, Ricardo
$0.56. **Pero** 15 llamadas en 14 archivos van por SDK directo sin recibo
(`analizar-cuerpo:58`, `avatar/generate:234`, `trip/itinerario:44`,
`estilo-referencia:129`, `engine/archetype.ts:38`, `capsule-target:198`,
`capsule-match:170`, `capsule-swap:46`, `trip-capsule:68`,
`trip-outfits:232,484`, `trip-substitutes:21`, `anchor-fit:52`,
`style-questions:23`, `gemini-imagen.ts:95`), declaradas en
`lib/cobertura-recibos.ts` —la memoria decía 9—, y **ninguna imagen** deja
recibo: 250 imágenes desde 08-13 (5 avatares, 25 try-ons, 118 renders de
prenda, 96 de catálogo, 6 destinos). ESTIMADO a ~$0.04/imagen: ~$10, ~4× lo
registrado. Val costaría $2–3/semana, no $0.88. Antes de abrir: tarifa por
imagen en `lib/proveedores` y cerrar los 14 exentos.

### 3.4 Integridad — CONFIRMADO
- 23 looks vivos (`source='daily'`, 4 usuarios, ninguno de hoy/futuro) apuntan a
  prendas con `deleted_at`. Las lecturas por ID no filtran:
  `lib/ultimo-look.ts:73` (card del home), `app/perfil/pasaporte/page.tsx:48`,
  `app/api/cron/reenganche/route.ts:129-131` (el correo puede nombrar una prenda
  borrada), `historial/page.tsx:47`, `hoy/page.tsx:88`, `look-of-day:795`,
  `wow/page.tsx:84`, `tryon.ts:161`. El motor sí filtra (`contexto.ts:67`,
  `closet-picks`, `capsule-data`, `revisar-closet`).
- `app/admin/page.tsx:143` cuenta trips borrados (9 vs 7). 15 lecturas de
  `trips` por id en `lib/trip-actions.ts` sin filtro, inalcanzables porque
  `/viaje/[id]` da 404 antes.
- 1 item `source='archetype'` con `archetype_id NULL` (`638824a8-…`, par de
  traje de ricardo); 2 items `photo` sin ninguna imagen (pantalones de franela
  de roberto). 0 huérfanos de `user_id` en 6 tablas; 0 `item_ids` inexistentes.
- Los 11 borrados "sin evento" del brief son anteriores a la migración 0078
  (histórico); desde entonces 20 = 20.

### 3.5 Migraciones — CONFIRMADO
No hay tabla de control: `scripts/db.mjs:21-29` ejecuta y no anota. Los 151
archivos coinciden con el catálogo (tablas, columnas, índices, políticas,
buckets). **Drift inverso**: `referencias.de_noche`, `referencias.ocasiones`,
`referencias.registro` existen en la base, las lee `lib/destilador.ts:60,107` y
ninguna migración las declara — un entorno recreado desde el repo rompe el
destilador. Numeración duplicada `0060_*`.

### 3.6 Estado real del experimento — CONFIRMADO
Sin admin ni cuentas dev: **24 personas**, 22 entraron. Volvieron un segundo día
distinto **9 (41 %)**; D1 5; semana 1 8; > día 7: 7; > día 30: 2 reales.
Nunca más de 3 personas reales activas en una semana. Votos: 18 👍 / 11 👎
sobre 29 de 154 looks `daily` (**19 % de los looks recibe voto**, 62 % positivo
cuando lo hay). Tatiana (3 cuentas) 4 👍 / 2 👎; **Toño no aparece en ninguna
tabla ni en la allowlist**. `worn`: 14 (9 del botón muerto, 5 por fit check,
los 5 de cuentas @kublau). Fit checks reales: 7 de 5 personas. El único
abandono a media alta está en el paso 2 (básicos). Correos: 12 con semanal
activo, envío del 08-31 a 11; sin histórico de envíos (`lib/email.ts:60`
descarta el `MessageID`), sin rebotes registrados.

---

## 4. Medios y bajos

- **Cabeceras**: solo HSTS (lo pone Vercel). Sin `X-Frame-Options`/CSP
  `frame-ancestors` → `/api/permiso` es clickjackeable (form clásico sin
  CSRF). Fix en `next.config.ts` `headers()`.
- **RPC SECURITY DEFINER ejecutables por `anon`**: `is_email_allowed` (oráculo
  de correos invitados), `join_waitlist` (sin límite), y 5 funciones internas
  (`is_admin`, `enforce_allowlist`, `handle_new_user`, `guard_minor_consent_cols`,
  `rls_auto_enable`) con `EXECUTE` a `anon` que nadie necesita.
- `/api/email/baja` valida el token con `[0-9a-f-]{36}` en vez de
  `isConsentToken` (`lib/consentimiento.ts:9`); sin rate limit.
- **Vocabulario duplicado con semánticas distintas**: dos `FORMALIDADES`
  (`lib/capsule.ts:21` `casual|formal-casual|formal` vs `lib/formalidad.ts:32`
  `casual|semiformal|formal|gala|playa`). Es la misma deriva que CLAUDE.md
  describe para `prenda-campos`.
- `lib/gemini-imagen.ts:12,20` hardcodea dos modelos `*-image`; el test los
  excluye a propósito pero CLAUDE.md dice "nunca" sin esa salvedad.
- **Vistos en pantalla**: "+1 LOOKS" en esenciales (plural fijo); "Clasico" sin
  acento en Perfil › estilo; ocasiones en Title Case ("Cena Con Amigos", "Una
  Boda") y títulos de looks viejos en Title Case ("Traje Completo, Cero Dudas")
  contra el sistema en minúscula; el diario dice "lo que te has puesto, día por
  día" y lista looks generados, no puestos (el botón "me lo puse" murió); la
  landing promete 'Sin "eres temporada tal"' y el reveal titula "TU ESTACIÓN ·
  invierno" en 36 px (`season-reveal.tsx:131-147`); la landing describe el paso
  3 como elegir ocasión (oficina/día/evento/cita) que el onboarding ya no tiene;
  card "creado el mié 19" sin mes a 13 días de distancia.
- **Copy fuera de voz**: `wow-client.tsx:46` "falta la API key de Anthropic"
  (tecnicismo y falso: el motor corre en Gemini); "Se cortó la conexión" también
  cuando la generación terminó con 0 looks (`wow-client.tsx:145-160`);
  `edad-picker.tsx:68` "Stailist" con mayúscula; "estilista" vs "stylist" en la
  misma sesión; `public/sw.js:4` emoji + paleta v1.
- **Docs que mienten** (doc → afirmación → realidad): USER-JOURNEY dice "magic
  link" (es OTP de 6 dígitos), "~15 fotos" (27/25), "15 básicos" (57/53), "prompt
  v24" (`PROMPT_VERSION = "v73"`), "análisis con Claude visión" (Gemini), "cero
  usuarios reales / faltan Tatiana y Toño" (27 perfiles, Tatiana con 3 cuentas),
  "⬜ PWA por verificar" (construido y cableado: `manifest.ts`, `sw.js`,
  `PwaInstall` en `layout.tsx:55`, `notifyFirstLike()` en wow y hoy). La spec
  `mvp-onboarding-90s.md` dice `status: ACTIVE` y describe un flujo que ya no
  existe. `components/onboarding-progress.tsx:2` habla de burdeos.
  `components/email-optin.tsx` es código muerto (`notifyWorn()` sin llamadores)
  pero sigue montado en `layout.tsx:56`.
- `package.json` version 0.2.265 vs `VERSION` 0.2.299.0: nada lo lee, solo el
  banner de npm. `public/` trackea 889 PNG / 196 MB. Sin `README`.
- **Sin kill switch ni alertas**: `/admin/ia` y `/admin/actividad` son pull;
  `lib/senales-vivas.ts:19-21` lo admite ("NO es monitoreo de verdad"). Un 402
  de Gemini/Anthropic llega como "El stylist está ocupado" para siempre. Fix
  barato: env var `MOTOR_PAUSADO` en `pipeline.ts` + un correo por Postmark
  cuando `ai_calls.ok = false` pase de N en 1 h.
- **Trajes en el onboarding** (TODOS "El traje entra completo o no entra"):
  quien tiene el saco sin el pantalón recibe un pantalón que no posee y el motor
  puede usarlo en su primer look. Con sombrero de stylist es el peor error
  posible.
- **Catálogo de onboarding, sombrero de stylist** (ESTIMADO, confianza media):
  0 accesorios de 51 en biblioteca (confirmado). Para un primer look de diario
  alcanza para ambos géneros; el hueco pega después (la regla de acentos del
  motor pide piezas chicas que el clóset recién creado no tiene). El set de
  hombre lee como el clóset de Roberto; el de mujer lee Pinterest/Gen-Z (top
  corset, crop top, jeans baggy, 4 tacones) y para el perfil declarado de
  Tatiana puede no representarla. Medible cruzando qué arquetipos marcan las 14
  mujeres reales.

---

## 5. Lo que está bien (para no re-auditar)

- **RLS: 26/26 tablas con `rowsecurity=true` y políticas; la vista con
  `security_invoker`.** Storage `prendas` y `referencias` privados por carpeta
  `auth.uid()`; política RESTRICTIVE de menores en insert y update.
- **Service role: la app NO la usa** (0 resultados en `app`, `lib`,
  `components`, `proxy.ts`). Lo que no es RLS va por `lib/db.ts` en 7 sitios,
  siempre `where id = $1` del usuario de sesión o tras `requireAdmin()`. 100 %
  parametrizado.
- **Auth en las 31 rutas de API**: 24 con `getUser()` → 401; 5 admin con
  `requireAdmin()`; crons con `CRON_SECRET` en igualdad estricta y fail-closed;
  3 públicas por diseño sin fuga.
- **Admin** por columna `is_admin`, `app/admin/layout.tsx:11` + cada action;
  "ver como" con cookie httpOnly 2 h, solo GET, y RLS impide escribir en filas
  ajenas. Sin escape encontrado.
- **Secretos**: 0 en repo e historia; `.env.local` y `CLAUDE.local.md`
  ignorados.
- **Redirecciones** validadas (`lib/return-to.ts:29-33`); sin SSRF (los
  `fetch(url)` reciben signed URLs propias); sin `dangerouslySetInnerHTML`.
- **Tests 1592/1592, `tsc` 0 errores, `build` 0 warnings.**
- **Motor sin duplicación**: solo `generate` y `look-of-day` importan
  `contexto`/`pipeline`; vocabulario de prendas centralizado en
  `prenda-campos.tsx` (salvo el par `FORMALIDADES`).
- **Voz**: muestra de 40 strings del equipo, 0 rupturas; errores de red y de IA
  en tono; Open-Meteo con timeout y fallback "sin clima".
- **Persistencia por paso** confirmada en el recorrido; generación en 13–16 s.

---

## 6. Orden sugerido

**Antes de abrir (S = horas, M = 1–2 días):**
1. Cuota de IA por usuario/día + rate limit de OTP + captcha (M).
2. Aviso de privacidad + borrar cuenta + correos opt-in (M; el texto legal es de
   Roberto).
3. Bajar la promesa de 2 minutos en 6 lugares y quitar el copy de beta cerrada
   (S).
4. `next@16.2.11`; `controller.close()` en generate; `error.tsx`/`not-found.tsx`
   (S).
5. Quitar `is_admin` a la cuenta dev; cerrar policies de `catalog_renders` y
   `destinos`; límites en buckets; validación de imagen en 8 rutas (S–M).
6. Kill switch `MOTOR_PAUSADO` + alerta por Postmark (S).

**La misma semana:**
7. Instrumento del TTV + helper de eventos + `item_added`/`session_open` (M).
8. Tarifa por imagen y recibos en los 14 exentos (M).
9. Recorte del onboarding: "ya, ármalo" primario, acentos y objetivo fuera del
   camino, wizard del wow sustituido por reloj + geoloc (M–L). Medir el TTV
   antes y después.
10. Design system: decidir tokens vs reemplazo de los 1 300 px (L).

---

## Notas de método

- Lo que **no** pude probar: el prompt de instalación PWA tras el primer 👍 (el
  navegador headless no emite `beforeinstallprompt`; además mi voto cayó en 👎 por
  un selector que tomó el primer botón), el flujo de fotos (sin cámara), el
  try-on/avatar (cuesta y no era el objetivo).
- **Efectos de la prueba en producción**: la cuenta `roberto.dev@stailist.app`
  quedó con género mujer, rango de edad 35–44 (inmutable por diseño), paleta
  invierno, 5 básicos, 2 looks (`Denim de camisa blanca`, `Contraste urbano`,
  prompt v73) y un `vote_down`. Es la cuenta de prueba local; no toqué ninguna
  cuenta real.
- Una vez, en medio del onboarding local, el navegador saltó solo a
  `https://stailist.co/`. No lo pude reproducir, el servidor local no registró
  ninguna redirección y no encontré código que navegue al dominio de
  producción (`location.href/assign/replace`, `window.open`: 0). No lo atribuyo
  a la app.
- El bloqueo de ~1.4 s por carta del swipe que medí es de dev (optimización de
  imagen en caliente); en prod la imagen optimizada llega en 0.5 s. El código
  bloquea 220 ms.
