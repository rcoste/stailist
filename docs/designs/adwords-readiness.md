# Readiness para anuncios (Google Ads, TikTok) — stailist

**Estado:** CONSTRUIDO el 2026-09-10 (rama `ads-readiness`). Reescribe el
análisis del 2026-07-13, cuyo bloqueador #1 (la allowlist) dejó de existir con
el registro abierto (B5, 2026-09-06).
**Decisión de Roberto:** Google Ads arranca el lunes 2026-09-14; TikTok con
video después. Campaña principal enfocada a hombres (decidido por Roberto el 2026-09-10).

## La objeción, registrada

Los datos del 2026-09-10 (sin cuentas de Roberto, dev ni admin): mujeres 12
cuentas, 6 volvieron otro día, **0 activas en 14 días**; hombres 5 cuentas, 2
volvieron, 1 activo. Desde el registro abierto, 2 altas orgánicas. TTV de las
dos últimas: 12 y 10½ min. El muro medido es la recurrencia, no el acceso
(`memory/premisa-del-setup-refutada`), y el tráfico frío retiene peor que los
amigos.

Por qué igual se corre: los 17 usuarios son conocidos y ya no enseñan nada
nuevo; los anuncios son la única fuente de desconocidos. **Es compra de
aprendizaje, no de crecimiento**, y se lee con la columna "volvió en 7 días"
de `/admin/adquisicion`, no con el costo por registro.

**Criterio de parada acordado con Roberto (2026-09-10):** de las primeras 30
personas que lleguen a su primer look, si menos de 6 (20%) vuelven otro día en
su primera semana, se para y no se escala. Referencia: los amigos volvieron 47%.

La hipótesis que la campaña pone a prueba (Roberto): los usuarios de hoy no
volvían porque eran amigos sin el dolor; Val, que sí lo tenía, volvió. Si gente
que BUSCA la solución tampoco llega al 20%, la hipótesis cae y el problema es la
recurrencia del producto, no la audiencia.

## Qué quedó construido

| Pieza | Dónde | Qué hace |
|---|---|---|
| Etiquetas apagadas por ID | `lib/publicidad.ts`, `components/tags-publicidad.tsx` | Google Ads + GA4 + píxel de TikTok. Sin su `NEXT_PUBLIC_*` no carga nada. Sólo en `/`, `/onboarding/objetivo` y `/onboarding/wow` (lista de lo permitido, `ZONA_MEDIDA`): fuera quedan el login y `/onboarding/edad` (campos de correo; la edad, el del tutor), `/onboarding/genero` (va antes de saber si es menor) y, desde la revisión legal del 2026-09-10, los swipes, el quiz de color y el clóset (ahí se contestan gustos y rasgos, y la captura automática de clics de TikTok no se apaga desde el código). El registro espera en su cookie (1 día) y sale en el objetivo. Toda salida de la zona con etiquetas vivas es navegación completa (la landing al login, el wow a la app, y cualquier link) y, como red, recarga si siguen vivas fuera de su zona (el aviso promete que dentro de la app no hay). Una cuenta de 13-17 recibe la cookie `st_menor` al guardar la edad y en cualquier navegador donde siga su onboarding (`app/onboarding/layout.tsx`), y ahí no vuelven a cargar. A TikTok no se le carga ni manda nada si la URL trae algo más que etiquetas de campaña (su píxel lee la URL cruda). Sin storage, falla cerrado. URL limpia (sólo ruta + etiquetas de campaña). Señales de Google y personalización apagadas. Respeta Global Privacy Control y el botón de `/privacidad`. |
| Conversiones | `app/onboarding/edad/actions.ts` (registro), `app/onboarding/wow/*` (primer look) | `registro` se decide al guardar la edad (no antes, para no mandar menores) y lo dispara la pantalla siguiente vía cookie `st_conversion`. `primer_look` cuando llega al menos un look de la primera generación (aunque después se corte la red o truene el juez), o al volver al wow si esos looks ya estaban guardados. Nada de menores; una vez por navegador. |
| Origen por cuenta | `proxy.ts`, `lib/origen.ts`, `app/onboarding/genero/page.tsx`, migración 0158 | Cookie de primera parte `st_origen` con utm/gclid/gbraid/wbraid/ttclid/fbclid y el dominio de referencia; se copia a `profiles.origen` cuando la persona abre la app. El último anuncio gana; el orgánico no borra un anuncio. |
| Panel | `/admin/adquisicion` | Por fuente y campaña: cuentas (H/M), primer look, volvió en 7 días (sólo ventanas cerradas). Últimas 30 cuentas con link a su ficha. |
| Landing segmentada | `app/page.tsx`, `components/landing/landing.tsx` | `stailist.co/?g=hombre` abre la versión de hombre desde el servidor (antes el default mujer le enseñaba una modelo mujer a un hombre que venía de un anuncio de hombre). Título, descripción y canonical para Google. |
| Correo fuera de la URL | `components/landing/entrar-form.tsx`, `app/login/login-form.tsx`, `lib/email-landing.ts` | La landing mandaba `/login?email=…`; con etiquetas cargadas, esa URL la veían Google y TikTok. Ahora viaja por sessionStorage y la landing sale al login con navegación completa. Contratos en `app/login/login-form.test.tsx` (lo lee, lo borra, sobrevive a un error) y `lib/publicidad.test.ts` (nada arma `?email=`). `/login` ya no acepta `?email=`. |
| Aviso de privacidad | `app/privacidad/page.tsx` | Decía "No los compartimos con anunciantes. No hay publicidad." Ahora explica qué ven las etiquetas, qué no, menores, links a los avisos de Google y TikTok, y el botón para apagarlas. |
| Search Console | `app/layout.tsx` | Verificación por etiqueta HTML con `GOOGLE_SITE_VERIFICATION`. |

## Lo que tiene que hacer Roberto (una vez)

1. **Google Ads.** Crear la cuenta. En *Objetivos → Conversiones* crear dos
   acciones de tipo "Sitio web", configuración manual con código:
   - "Registro" (categoría *Registro*, contar **una**).
   - "Primer look" (categoría *Otro* o *Cliente potencial*, contar **una**).
   De "Configurar etiqueta → Usar Google tag" copiar el ID `AW-…` y la
   **etiqueta** de cada acción.
   Dejar **apagadas** las *conversiones mejoradas* y la *recopilación de datos
   proporcionados por el usuario*: el aviso dice que no se les manda el correo.
2. **Google Analytics 4.** Crear propiedad + flujo web `https://stailist.co`,
   copiar el `G-…`. En *Medición mejorada* apagar **"Cambios de página según
   eventos del historial de navegación"** (las vistas las manda el código con
   la URL limpia; dejarlo prendido duplica, manda URLs crudas y alcanza a ver
   la primera página de la app antes de que las etiquetas se suelten) e
   **"Interacciones con formularios"**. Son precondición del aviso de
   privacidad, no una preferencia.
   Vincular GA4 con Google Ads (opcional).
3. **Search Console.** Agregar propiedad "Prefijo de URL" `https://stailist.co`,
   método *Etiqueta HTML*, copiar sólo el valor de `content="…"`.
4. **TikTok (cuando toque).** Ads Manager → *Eventos → Web → Configurar
   manualmente*, copiar el ID del píxel. Dejar **apagada** la *coincidencia
   avanzada automática* (lee correos de los formularios).
5. Pasarle los valores a Claude, que los sube a Vercel (NO `--sensitive`: son
   `NEXT_PUBLIC_*`) y redeploya. Ver `.env.example`. Antes de anunciar, Claude
   verifica en producción, con las herramientas de red, que al mandar el correo
   de la landing ninguna petición a Google o TikTok lo lleve (tampoco cifrado):
   la landing sí tiene campo de correo y esa promesa depende de los ajustes de
   los pasos 1, 2 y 4.
6. **Probar el flujo en el teléfono dentro del navegador de TikTok e
   Instagram**: pedir el código, salir al correo, volver. Si se pierde la
   pantalla, TikTok no sirve todavía.

## Configuración de campaña recomendada

- Sólo **Red de Búsqueda** (sin Display, sin socios de búsqueda) al arrancar.
- México, español, **18+**.
- **Campañas separadas por género** (hombre principal; mujer chica o pausada).
  Mezcladas no se pueden leer.
- **Dentro de hombres, separadas por intención**, cada una con su
  `utm_campaign` (así `/admin/adquisicion` las separa sola):
  `hombres-diario` ("cómo combinar ropa hombre", "outfits hombre casual") y
  `hombres-eventos` ("qué ponerme para una boda hombre", "outfit cita hombre").
  El uso por evento es episódico: "volvió en 7 días" sólo es la vara justa para
  la de diario; la de eventos se lee también a 30 días.
- URLs finales con utm explícitas, p. ej.
  `https://stailist.co/?g=hombre&utm_source=google&utm_medium=cpc&utm_campaign=hombres-search`
  (el gclid lo añade Google solo).
- Conversión principal al inicio: **Registro** (volumen). Pasar a **Primer
  look** cuando junte decenas al mes.
- Presupuesto con tope diario, fijado después de ver el costo por clic en el
  Planificador de palabras clave (no se estimó: no hay dato).

## Pendientes conocidos

- ~~DMARC~~ **Hecho el 2026-09-10** con permiso de Roberto: `_dmarc.stailist.co`
  TXT `v=DMARC1; p=none;` en Vercel DNS (DKIM y Return-Path ya estaban, de
  Postmark). No bloquea nada, sólo declara la política. Sin `rua`: `hola@`
  manda pero no recibe, así que no hay a dónde mandar los reportes.
- El hero de la landing habla del dolor de mujer ("tu clóset está lleno…"); el
  de hombre suele ser "no sé combinar / me visto igual / tengo una cita".
  Decisión de copy de Roberto.
- Conversiones del lado del servidor (Events API de TikTok, conversiones
  offline con `gclid`) — sólo si lo que reporta Google queda muy por debajo de
  lo que cuenta `/admin/adquisicion`.
- Revisión del ship (2026-09-10), aceptado sin arreglar: (a) gtag y el píxel de
  TikTok se inyectan justo después de hidratar la landing; si Google Ads marca
  mala experiencia de página, diferirlos a `requestIdleCallback`. (b) `items` no
  tiene índice `(user_id, created_at)`; hoy no importa, sí con miles de altas.
  (c) Si el primer look se mide en una URL que TikTok no puede ver (volver del
  avatar a `/onboarding/wow?look=`), Google lo recibe y TikTok no, y ya no se
  reintenta. (d) El origen se pierde si la persona cambia de navegador entre el
  clic y el registro (el navegador de TikTok → Safari): la cookie vive en uno solo.
- Confianza MEDIA en el encuadre legal: el aviso ahora informa de las
  etiquetas y cómo apagarlas, que es lo que pedían los Lineamientos del Aviso
  de Privacidad; no se revisó con un abogado cómo lo trata la LFPDPPP de 2025.
