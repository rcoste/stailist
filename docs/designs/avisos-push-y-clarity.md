# Avisos push + Microsoft Clarity — preparados apagados (2026-10-30)

Rama `avisos-y-clarity`. Decisión de Roberto del 2026-10-30, en la semana de "cero
versiones" previa al 5 de noviembre: se construye, se deja apagado detrás de dos
variables y **no se publica nada** hasta que él lo diga. Igual que `calzado-variado`.

## Por qué los dos, y por qué juntos

- **Push.** Entre sesión y sesión nadie recibe nada: los correos son opt-in y
  aceptaron 2 de 103; la retención muere al día 3. La app ya arma "tu look de hoy";
  lo que falta es avisar que existe. Techo chico a propósito: 20 personas con la
  app instalada (18 en los últimos 30 días). Un experimento barato, no una apuesta.
- **Clarity.** El 62% no hace nada después del primer look y no sabemos qué
  *intenta* hacer antes de irse. Roberto ya lo usa en otros proyectos para ver
  "qué no hacen". Aquí la diferencia es que la app está llena de fotos de la ropa
  de la gente, su avatar y su cara en el probador: entra con todo tapado o no entra.
- Juntos porque se prenden el mismo día y miden caras distintas de la misma
  pregunta: Clarity, *qué pasa dentro de la sesión*; el push, *si vuelven a la
  siguiente*. Ninguno sustituye la llamada con Rafa.

## Los dos switches

| Qué | Variable (Vercel, Production) | Sin ella |
|---|---|---|
| Push | `NEXT_PUBLIC_AVISOS_PUSH=1` (+ `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) | no se ofrece, no se suscribe, el cron responde `{apagado:true}` |
| Clarity | `NEXT_PUBLIC_CLARITY_ID` | no se inyecta nada |

Las `NEXT_PUBLIC_*` se hornean en el bundle: cambiarlas exige redeploy.

## Push: cómo funciona

```
primer 👍 o look en /hoy  ──►  stailist:pwa-momento
        │
        ├─ app NO instalada ──► <PwaInstall/>   "Llévame en tu bolsillo"   (ya existía)
        └─ app instalada    ──► <AvisosPush/>   "¿Te aviso cuando esté tu look?"
                                     │ sí (dentro del toque: permiso → suscripción)
                                     ▼
                         push_subscriptions (endpoint + 2 llaves)   profiles.avisos_push='on'
                                     │
   cron 13:00 UTC (7am CDMX) ──► /api/cron/avisos ──► web-push ──► sw.js muestra ──► toca ──► /hoy?desde=aviso
```

- **Una pregunta por navegador**, nunca junto al prompt de instalar (son excluyentes
  por `estaInstalada()`). Quien dice "ahora no" lo tiene en Perfil → Cuenta.
- **Sin re-suscripción en silencio.** Una suscripción sólo nace de un sí explícito.
  En un teléfono compartido, quien entra después no hereda el permiso: si el
  endpoint ya es de otra cuenta, la base lo rechaza (RLS) y el navegador pide uno
  nuevo (`lib/push-navegador.ts`).
- **El interruptor de Perfil refleja ESTE teléfono**, no la cuenta; apagarlo apaga la
  cuenta entera (`profiles.avisos_push='off'`).
- **Reglas de a quién le toca** (`lib/avisos-push.ts`, probadas una por una): no dos
  veces el mismo día local; no si ya generó su look hoy; no si usó la app hace
  menos de 2 h; **se deja de insistir tras 7 avisos sin que vuelva**; una
  suscripción con 3 fallos seguidos se da por rota; 404/410 la mata al instante.
- **El texto**: si ya tiene un look para hoy (lo planeó con "arma tu semana"), lo
  anuncia con su título. Si no, rota entre tres textos. Sin IA por persona cada
  mañana a propósito: el aviso cuesta cero.
- **iPhone**: sólo con la app en la pantalla de inicio (iOS 16.4+) y el permiso
  pedido dentro del toque, antes de cualquier `await`. Por eso el orden en
  `suscribirEsteNavegador`.
- `?ensayo=1` en el cron calcula todo y no manda nada: la lista se revisa antes.

### Qué se mide (eventos, migración 0189)

| Evento | Cuándo | Para leer |
|---|---|---|
| `push_prompt_shown` | se le ofreció (data.motivo: like/look) | base de la tasa de aceptación |
| `push_suscrito` | dijo sí y el navegador dio permiso (data.motivo: like/look/perfil) | aceptación |
| `push_rechazado` | dijo no / negó el permiso / lo apagó (data.via) | rechazo y fatiga |
| `push_enviado` | el cron le mandó uno (uno por persona y día) | denominador de apertura |
| `push_abierto` | entró desde el aviso | tasa de apertura |

**Lo que NO prueba este experimento**: comparar retención de suscritos vs. no
suscritos. Quien dice que sí ya está más enganchado (se autoselecciona). Lo
honesto es leer aceptación y apertura, y si la apertura es alta, pensar en un
A/B de verdad.

## Clarity: las tres reglas y dónde vive cada una

1. **Nada de imágenes ni textos.** `<body data-clarity-mask="true">` (app/layout.tsx)
   tapa el árbol entero del lado del navegador. Sólo la barra de pestañas lleva
   `data-clarity-unmask` (texto nuestro, fijo). En el panel de Clarity además se
   pone **Masking = Strict** (cinturón y tirantes: si alguien quita el atributo
   por error, el panel sigue tapando).
2. **No carga donde no se sabe la edad ni donde no hay cuenta**: `/`, `/login`,
   `/empezar`, `/onboarding/genero`, `/onboarding/edad`, `/privacidad`, `/terminos`,
   `/admin`, `/v/*` (looks compartidos), `/cuenta`. (`rutaConClarity`, con test.)
3. **Respeta lo mismo que las etiquetas de publicidad**: el interruptor de
   `/privacidad`, Global Privacy Control y la cookie de menor
   (`permitidoEnEsteNavegador`). Si estaba cargada y deja de estar permitida, una
   recarga la suelta.

Etiqueta `app_instalada = si|no` para separar en el panel a quien la tiene en la
pantalla de inicio. **No se identifica a la persona** (sin `identify`): si hace
falta ver "la sesión de X", se agrega después y se escribe en el aviso.

### Privacidad

`app/privacidad/page.tsx` pinta dos secciones nuevas **sólo cuando su variable
existe**: el aviso dice lo que pasa, no lo que podría pasar. La promesa vigente de
"Google y TikTok no ven nada dentro de la app" sigue siendo cierta; Clarity es un
tercero nuevo y se describe aparte, con lo que ve y lo que no.

## Para prenderlo (el 5 de noviembre o después)

Cero código. En este orden:

1. **Migración 0189** en la base (crea `push_subscriptions`, añade
   `profiles.avisos_push` y los cinco eventos). Sin ella el cron y las acciones
   fallan; con ella y los switches apagados no pasa nada.
2. **Clarity**: crear el proyecto en clarity.microsoft.com → Settings → Masking →
   **Strict** → copiar el id → `NEXT_PUBLIC_CLARITY_ID` en Vercel (no sensitive).
3. **Push**: subir a Vercel `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (no sensitive),
   `VAPID_PRIVATE_KEY` (sensitive), `VAPID_SUBJECT` y `NEXT_PUBLIC_AVISOS_PUSH=1`.
   Las llaves ya están generadas en `.env.local` (2026-10-30). **No regenerarlas
   nunca**: cambiarlas mata todas las suscripciones.
4. Merge + deploy. Verificar:
   - `curl -H "Authorization: Bearer $CRON_SECRET" https://stailist.co/api/cron/avisos?ensayo=1`
     → `{"ensayo":true,"suscripciones":0,...}` (ya no `apagado`).
   - En un iPhone con la app instalada: dar 👍 → aparece "¿Te aviso…?" → sí →
     Perfil → Cuenta muestra "activado". Al día siguiente a las 7 llega.
   - En Clarity, abrir una grabación de `/perfil/avatar` o del probador: las
     imágenes tienen que ser bloques grises. Si no, **apagar** (quitar la variable)
     y revisar antes de volver a prender.
5. Leer a los 7 días: aceptación (`push_suscrito` / `push_prompt_shown`), apertura
   (`push_abierto` / `push_enviado`), y en Clarity las dos preguntas: ¿qué tocan
   después del primer look? ¿dónde se atoran (rage/dead clicks)?

## Pendientes conocidos (no bloquean)

- `pushsubscriptionchange` en el service worker (cuando el navegador rota la
  suscripción solo) no se maneja: el endpoint viejo muere y la persona tendría que
  volver a prenderlo en Perfil. Raro; se mide si pasa (`muertas` en el cron).
- El aviso no lleva el clima: `profiles.city` está vacío en las 20 instaladoras.
  Si el push funciona, el siguiente paso es guardar la última ciudad al generar
  el look y decir "14° y lluvia en Bogotá" sin gastar IA.
- Clarity no identifica a la persona. Si hace falta, `clarity("identify", id)`
  (Clarity lo hashea antes de mandarlo) y una línea en el aviso.
