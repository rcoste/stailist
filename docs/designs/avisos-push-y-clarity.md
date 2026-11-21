# Avisos push + Microsoft Clarity (preparados 2026-10-30; Clarity prendido 2026-11-05, avisos 2026-11-21)

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
  de la gente, su avatar y su cara en el probador: entra sin una sola foto o no entra.
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

## Clarity: las cuatro reglas y dónde vive cada una

Decisión de Roberto del 2026-11-02: **el texto se ve, las fotos no.** La versión
original tapaba todo con un `data-clarity-mask` en el `<body>`; se quitó porque sin
leer la pantalla la grabación no contesta qué no hace la gente, y el texto ya lo
puede leer el admin. Lo que cambia es que también lo recibe Microsoft, y eso se
avisa en `/privacidad`.

1. **Ni una foto, desde el código.** `conFotosTapadas` (lib/clarity.ts) agrega `img`,
   `video` y `source` a la lista `mask` cuando el tag de Clarity llama a
   `clarity("start", config)`, porque esa llamada pasa por nuestra cola
   (components/clarity.tsx). Así la protección no depende del panel.
2. **Las pantallas del cuerpo van tapadas enteras** con `data-clarity-mask`: silueta,
   avatar, espejo y la etiqueta de silueta en Perfil.
3. **No carga donde no se sabe la edad ni donde no hay cuenta**: `/`, `/login`,
   `/empezar`, `/onboarding/genero`, `/onboarding/edad`, `/privacidad`, `/terminos`,
   `/admin`, `/v/*` (looks compartidos), `/cuenta`. (`rutaConClarity`, con test.)
4. **Respeta lo mismo que las etiquetas de publicidad**: el interruptor de
   `/privacidad`, Global Privacy Control y la cookie de menor
   (`permitidoEnEsteNavegador`). Si estaba cargada y deja de estar permitida, una
   recarga la suelta.

### Lo que Clarity NO limpia (leído en el clarity.js real, 0.8.73-beta)

Su enmascarado sólo limpia texto, `data-*`, `src`, `srcset`, `title`, `alt` y `href`.
Todo lo demás sale tal cual, incluso dentro de `data-clarity-mask`:

- **`style`**: una foto pintada como fondo CSS entrega su enlace firmado. Por eso las
  fotos van siempre en `<img>` (lo blinda `lib/clarity.test.ts`).
- **`<link rel="preload">`**: `priority` de next/image escribe ahí el enlace. Sólo
  para imágenes públicas.
- **`aria-label`**: se ve. Ya no contradice nada porque el texto es visible, pero no
  poner datos del cuerpo en uno dentro de una pantalla tapada.
- **`data-clarity-unmask` destapa también las `<img>` hijas**: nunca ponerlo en algo
  que pueda contener una foto.

Equilibrado tampoco limpia `src`: sin la regla 1, las fotos saldrían.

### Cómo se verificó (2026-11-02)

Con el clarity.js real sobre la app local y la subida desviada a la propia página,
sin mandar nada a Microsoft, en clóset, historial, hoy, perfil, viaje, silueta y
avatar. Control sin tapado: 21 enlaces firmados capturados. Con tapado: 0, incluidas
imágenes agregadas después de cargar. No cubierto: la cola real con el tag servido
por Microsoft (sólo su texto copiado) ni una grabación de punta a punta en el panel.

Etiqueta `app_instalada = si|no` para separar en el panel a quien la tiene en la
pantalla de inicio. **No se identifica a la persona** (sin `identify`): si hace
falta ver "la sesión de X", se agrega después y se escribe en el aviso.

### Privacidad

`app/privacidad/page.tsx` pinta dos secciones nuevas **sólo cuando su variable
existe**: el aviso dice lo que pasa, no lo que podría pasar. La promesa vigente de
"Google y TikTok no ven nada dentro de la app" sigue siendo cierta; Clarity es un
tercero nuevo y se describe aparte, incluido que Microsoft recibe el texto de la
pantalla. Si el piloto del embarazo se construye, sus pantallas deben ir tapadas.

## Para prenderlo (el 5 de noviembre o después)

Cero código. En este orden:

1. **Migración 0189** en la base (crea `push_subscriptions`, añade
   `profiles.avisos_push` y los cinco eventos). Sin ella el cron y las acciones
   fallan; con ella y los switches apagados no pasa nada.
2. **Clarity**: el proyecto ya existe (`z7fsslmeaz`). En su panel, Settings →
   Masking → **Equilibrado**, y en "Mask by element" agregar `img` como segunda capa
   (el código ya lo hace). `NEXT_PUBLIC_CLARITY_ID` en Vercel (no sensitive).
3. **Push**: subir a Vercel `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (no sensitive),
   `VAPID_PRIVATE_KEY` (sensitive), `VAPID_SUBJECT` y `NEXT_PUBLIC_AVISOS_PUSH=1`.
   Las llaves ya están generadas en `.env.local` (2026-10-30). **No regenerarlas
   nunca**: cambiarlas mata todas las suscripciones.
4. Merge + deploy. Verificar:
   - `curl -H "Authorization: Bearer $CRON_SECRET" https://stailist.co/api/cron/avisos?ensayo=1`
     → `{"ensayo":true,"suscripciones":0,...}` (ya no `apagado`).
   - En un iPhone con la app instalada: dar 👍 → aparece "¿Te aviso…?" → sí →
     Perfil → Cuenta muestra "activado". Al día siguiente a las 7 llega.
   - `curl -s https://www.clarity.ms/tag/z7fsslmeaz` muestra lo que manda el panel:
     debe traer `"content":true` y, si se agregó, `"mask":["img"]`.
   - Abrir una grabación del clóset y otra del probador: las fotos tienen que ser
     bloques, y en silueta, avatar y espejo no debe leerse ninguna palabra. Si no,
     **apagar** (quitar la variable) y revisar antes de volver a prender.
5. Leer a los 7 días: aceptación (`push_suscrito` / `push_prompt_shown`), apertura
   (`push_abierto` / `push_enviado`), y en Clarity las dos preguntas: ¿qué tocan
   después del primer look? ¿dónde se atoran (rage/dead clicks)?

## Lo que cambió al prenderlos (2026-11-21)

Roberto pidió prenderlos el 21 de noviembre. Antes de publicar se leyó el código
entero y se corrió una revisión adversarial independiente. Lo que salió, y quedó
arreglado en la misma versión:

- **El aviso contaba como "volvió".** `push_enviado` lo escribe el cron a nombre de
  la persona; los paneles de retención, embudo, adquisición, "último uso", el feed y
  el correo de reenganche tomaban cualquier evento como actividad. Alguien suscrito
  que no volviera a abrir la app habría salido como que volvió siete días seguidos.
  Ahora está en `EVENTOS_QUE_NO_SON_VOLVER` (lib/admin/adquisicion.ts) y en
  `EVENTOS_DEL_SERVIDOR` (lib/admin/actividad.ts). `push_abierto` sí cuenta.
- **A quién le habla el servidor.** La dirección de la suscripción la escribe el
  navegador y la RLS sólo pide que la fila sea propia: una cuenta podía poner al
  cron a llamar a cualquier dirección. Sólo se aceptan Google, Apple, Mozilla y
  Microsoft (`esServicioDePush`), al guardar y al mandar. Un rechazo se anota en
  `/admin/errores` como `push:suscripcion-rechazada` con el nombre del servidor:
  si aparece uno de un navegador real, se agrega a la lista.
- **Tope y espera.** Máximo 5 teléfonos por persona (recortado en el SQL, antes de
  las subconsultas) y 8 segundos de espera por envío.
- **Los fallos se ven y no matan lo que no deben.** Un 401/403 (llaves nuestras),
  un 429, un 5xx o un corte de red ya no suman a los tres fallos que dan por rota
  una suscripción; todo fallo va al log y a `/admin/errores` (`push:envio`).
- **El interruptor dice la verdad.** "Activado" sólo si el servidor tiene viva la
  suscripción de ese teléfono para esa cuenta (`suscripcionViva`). Si no se pudo
  guardar, también se suelta en el navegador.
- **Apagar borra.** Apagar en Perfil borra todas las direcciones de la cuenta;
  apagar desde los ajustes del teléfono borra la fila al siguiente envío (404/410);
  cerrar sesión borra las de la cuenta y deja la preferencia sin decidir.
  `/privacidad` lo dice así, y menciona el navegador y por dónde viaja el aviso.
- **Textos.** "Tu look de hoy te espera. Un toque y listo." y "¿Te aviso cuando
  esté tu look?" prometían un look ya hecho. Sin un look planeado, al abrir no hay
  nada esperando: la app pregunta el plan y lo arma. Quedaron "Dime a dónde vas y
  te lo armo con tu ropa." y "¿Te aviso en las mañanas?".

### Al leer la apertura, tener presente

`push_abierto` se escribe cuando la app carga `/hoy?desde=aviso`. Se pierde si iOS
abre la app en su pantalla de inicio en vez de la dirección pedida, si sólo se trae
la ventana al frente sin navegar, o si `/hoy` redirige (onboarding a medias). La
apertura real puede ser mayor que la medida: contrastarla con las visitas del mismo
día entre las 7 y las 13 h de quien recibió aviso.

## Pendientes conocidos (no bloquean)

- `pushsubscriptionchange` en el service worker (cuando el navegador rota la
  suscripción solo) no se maneja: el endpoint viejo muere y la persona tendría que
  volver a prenderlo en Perfil. Raro; se mide si pasa (`muertas` en el cron).
- El aviso no lleva el clima: `profiles.city` está vacío en las 20 instaladoras.
  Si el push funciona, el siguiente paso es guardar la última ciudad al generar
  el look y decir "14° y lluvia en Bogotá" sin gastar IA.
- Clarity no identifica a la persona. Si hace falta, `clarity("identify", id)`
  (Clarity lo hashea antes de mandarlo) y una línea en el aviso.
