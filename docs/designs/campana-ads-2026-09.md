# Campaña de Google Ads — decisión de segmento y plan de lanzamiento

**Fecha:** 2026-09-23. **Estado:** propuesta para Roberto, nada prendido.
Complementa `adwords-readiness.md` (lo construido) — este archivo es el
**plan de campaña**: qué se prende, con cuánto, qué copy, cómo se lee y
cuándo se apaga. Los datos salen de la base de producción de hoy.

---

## 1. ¿Sólo hombres? Lo que dicen los datos

**Hipótesis de Roberto:** el motor arma peor para mujer porque el outfit
femenino tiene más grados de libertad; si para hombre a veces falla, para
mujer sería peor. Por eso arrancar sólo con hombres.

### 1.1 El instrumento no puede contestar

| instrumento | corridas | clóset de mujer |
|---|---|---|
| `/admin/evales` (`eval_corridas`) | 17 | **0** |
| comparador de motores (`comparador_motor_corridas`) | 28 | **0** |

Las 45 corridas son sobre el clóset de `roberto@kublau.com`. **Nunca se ha
medido el motor sobre un clóset de mujer.** La pregunta "¿arma peor para
mujer?" no tiene respuesta con lo que existe; cualquier número que se dé
desde aquí sería inventado.

### 1.2 Las señales sueltas que sí existen (todas débiles)

Cuentas reales = sin Roberto, sin `@stailist.app`, sin admin, sin clientas
gestionadas.

| señal | hombre | mujer | ¿distinguible del azar? |
|---|---|---|---|
| Juez de producción: % de generaciones con reparación (`critic_review`) | 29% (24 gen, 9 personas) | 39% (75 gen, 15 personas) | no (Fisher p=0.47) |
| Votos SIN Val | 8👍 / 1👎 (4 personas) | 8👍 / 6👎 (7 personas) | no (p=0.18) |
| Votos con todo (la tabla contaminada) | 9 / 3 | 11 / 15 | casi (p=0.09) |
| Volvió otro día | 3 de 9 (33%) | 6 de 15 (40%) | — |
| Tiempo al primer look (mediana) | 6.8 min | 9.4 min | — |
| Pidió "otro look" | 0 | 5 (2 personas) | — |

Motivos de los 👎 de mujer con motivo: **"No es mi estilo" ×4 (cuatro
personas distintas)**, "Los colores" ×4 (sólo Val), "No me queda", "Se ve
muy x", "No es la ocasión" ×1 cada uno. Hombre: un 👎 sin motivo.

Lectura honesta:
- La dirección de todas las señales es "mujer califica más bajo", pero
  ninguna alcanza a separarse del ruido y el juez está calibrado con Roberto.
- El motivo dominante es **gusto**, no construcción del outfit. Eso apunta al
  mazo de swipes / arquetipo / paleta prestada, no a "más grados de libertad".
  Si la hipótesis fuera "arma mal", esperaríamos "no combina" o "no es la
  ocasión", y casi no aparecen.
- Evidencia independiente A FAVOR de la hipótesis: cuatro veces se han
  colado defaults masculinos en reglas y catálogo (`memory/sesgo-genero-en-reglas`),
  y nadie ha corrido el motor contra un clóset de mujer con ojos de mujer.
- El catálogo NO la apoya: mujer tiene 253 arquetipos vs 200 de hombre.
- Las mujeres son la mayoría de las usuarias reales (15 vs 9), volvieron un
  poco más y la landing/producto se diseñó para ellas.

**Veredicto:** ni confirmada ni refutada. Y hay una forma barata de saberlo:
**una ronda "vistazo" del comparador (6 pares) sobre un clóset de mujer
real** — el de Tatiana (82 prendas) o el de Val (59) — **votada por una
mujer**, no por Roberto. Cuesta ~$3 y una hora. Es el único experimento que
convierte esta discusión en un dato.

### 1.3 Qué cuesta equivocarse en cada dirección

**Segmentas sólo hombres y la hipótesis era falsa (el motor está igual para
mujer):**
- Gastas en el segmento con **menos demanda de búsqueda** (las consultas
  "qué me pongo / outfit para…" en México son mayoritariamente de mujer;
  confianza media, sin Keyword Planner a la mano) y con retención observada
  ligeramente peor (33% vs 40%). Llegar a 30 primeros looks tarda más y
  cuesta más por look.
- El experimento contesta "¿los hombres desconocidos vuelven?" y NO contesta
  la pregunta original del producto (Tatiana). Te quedas sin lectura del
  segmento para el que se construyó.
- Reversible en un día: copy + campaña nueva. **Cuesta tiempo y algo de
  dinero, no cuesta información falsa.**

**Incluyes mujeres y la hipótesis era verdadera (el motor arma peor):**
- Pagas clics para enseñar un producto flojo a la audiencia principal; su
  "volvió en 7 días" sale bajo y la primera impresión se quema.
- PERO no confunde el experimento: las campañas van separadas y
  `/admin/adquisicion` ya parte por H/M. Verías el problema, no lo
  taparías. El costo real es **presupuesto partido** (cada celda tarda más
  en llegar a 30) y la marca ante ~30 mujeres.
- **Cuesta dinero y reputación a escala chica; no cuesta ceguera.**

Asimetría: equivocarse hacia "sólo hombres" es barato de revertir pero deja
sin contestar la pregunta importante; equivocarse hacia "ambos" es visible
en el panel desde la primera semana.

### 1.4 Recomendación

**Hombre como campaña principal, sin campaña dedicada de mujer todavía, y
UNA campaña neutra de intención "app"** cuyas consultas no llevan género
("app para armar outfits", "app que te dice qué ponerte", "estilista virtual
gratis"). Esa campaña aterriza en `/` sin `?g=` y la persona elige el
toggle: da una lectura de mujer **sin copy nuevo ni presupuesto dedicado**.

Y en paralelo, **esta semana**, la ronda de mujer en el comparador. Su
resultado decide en la semana 2 si se abre `mujeres-diario`:
- Si la aprobación de la votante de mujer queda ≥75% (la de producción de
  hombres): la hipótesis cae, se abre mujer con el 50% del presupuesto.
- Si queda <60%: la hipótesis se sostiene, mujer se queda apagada y se
  arregla el motor antes de pagar por mujeres.

No estoy validando la hipótesis: estoy diciendo que **la decisión de
segmento se está tomando sin el dato que la decide, y el dato cuesta $3.**

---

## 2. Plan de lanzamiento (Google Ads)

### 2.1 Bloqueante antes de gastar un peso: la landing pesa 10 MB

Medido hoy con Lighthouse (móvil, 4G simulado) sobre `stailist.co/?g=hombre`:

| métrica | valor |
|---|---|
| Largest Contentful Paint (cuándo se ve lo principal) | **16.3 s** |
| Peso total | **10.6 MB** (49 imágenes = 10.1 MB) |
| First Contentful Paint | 1.1 s |
| Puntaje | 74 |

Causa: las 36 imágenes de la landing van con `<img>` plano, en PNG sin
comprimir (el hero pesa 684 KiB a 600×804 px; `swipe-no.png` 745 KiB), sin
`loading="lazy"` y sin `next/image`. En un teléfono con datos, quien llega
de un anuncio ve el texto rápido y la foto del hero **16 segundos después**.
Google además castiga la puja con "experiencia de la página de destino".

Arreglo (medio día, sin tocar motor ni base): pasar las imágenes a WebP/AVIF
(o a `next/image`, que lo hace solo), `priority` sólo al hero, `lazy` a
todo lo que está debajo del pliegue. Objetivo: <2 MB y LCP <3 s. **Se hace
antes de prender.**

### 2.2 Otros arreglos chicos que salieron del recorrido en frío

- Con `?g=hombre` el cierre dice **"¿Lista para abrir el clóset…?"** en
  femenino (`components/landing/landing.tsx:976`). Un hombre que llega de
  un anuncio de hombre lo lee justo antes del segundo botón.
- No hay ninguna petición a terceros en la landing hoy (etiquetas apagadas
  sin IDs): correcto. Al poner los IDs hay que repetir la revisión de red
  para confirmar que el correo no viaja a Google.
- **Una alta orgánica del 2026-09-19 (`stephanymav@…`) se quedó en el paso 0**:
  pasó género, edad y "¿cómo nos conociste?" y no terminó los swipes. Es el
  primer caso real de abandono en el mazo — justo lo que el panel del mazo
  quiere medir. Con 20 hombres de campaña se sabrá si es patrón.
- No pude recorrer el onboarding completo desde cero: el modo automático me
  negó teclear un correo en producción y también resetear la cuenta de
  desarrollo en la base (es la de producción). **Roberto puede hacerlo en 3
  minutos desde su teléfono** con un alias de Gmail que sí recibe
  (`roberto+frio@kublau.com`), en una ventana privada, entrando por
  `stailist.co/?g=hombre&utm_source=prueba`. Después se borra la cuenta
  desde Perfil (queda programada a 30 días) y en `/admin/adquisicion` debe
  aparecer con fuente `prueba`. Eso verifica de un golpe: el correo de código
  llega, la cookie de origen se copia, la conversión `registro` dispara.

### 2.3 Campañas

Sólo Red de Búsqueda, México, español, 18+, sin socios de búsqueda ni Display.
Conversión principal: **Registro**; secundaria: **Primer look**. Sin
conversiones mejoradas ni datos del usuario (aviso de privacidad).

| campaña | `utm_campaign` | URL final | intención | % presupuesto |
|---|---|---|---|---|
| Hombres · diario | `hombres-diario` | `/?g=hombre&utm_source=google&utm_medium=cpc&utm_campaign=hombres-diario` | no sé combinar / me visto igual | 40% |
| Hombres · eventos | `hombres-eventos` | `…&utm_campaign=hombres-eventos` | boda, cita, entrevista, graduación | 35% |
| App (neutra) | `app-neutra` | `/?utm_source=google&utm_medium=cpc&utm_campaign=app-neutra` | busca una app/IA que le diga qué ponerse | 25% |

Palabras clave (concordancia de frase; sin concordancia amplia al arrancar,
que se lleva el presupuesto a "comprar ropa"):

- **hombres-diario:** "como combinar ropa hombre", "como combinar colores de
  ropa hombre", "outfits hombre casual", "que ropa me queda hombre", "como
  vestir bien hombre", "estilista personal hombre", "asesor de imagen hombre".
- **hombres-eventos:** "que ponerme para una boda hombre", "outfit boda de
  dia hombre", "outfit boda de noche hombre", "outfit primera cita hombre",
  "como vestirme para una entrevista de trabajo hombre", "outfit graduacion
  hombre", "que ponerme para una cena hombre".
- **app-neutra:** "app para armar outfits", "app para combinar ropa", "app que
  te dice que ponerte", "estilista virtual gratis", "estilista con
  inteligencia artificial", "outfit con inteligencia artificial", "app closet
  virtual".

Negativas en las tres: comprar, tienda, venta, barato, precio, renta, traje
de renta, pdf, curso, niño, niña, shein, zara, amazon, mercado libre, liverpool,
mujer (sólo en las de hombre), hombre (sólo si se abre la de mujer).

### 2.4 Copy (anuncios adaptables)

Voz: la amiga cool. Tuteo, nada de "temporada", nada de jerga. Los títulos
caben en 30 caracteres y las descripciones en 90.

**Hombres · diario** — títulos: "Tu stylist con IA, gratis" · "Qué ponerte
hoy, resuelto" · "Combina lo que ya tienes" · "Sin subir prenda por prenda" ·
"Looks de hombre, en minutos" · "Sin tarjeta. Sin contraseña." · "Deja de
vestirte igual". Descripciones: "Te armo 2 o 3 outfits con tu ropa, te digo
por qué funcionan y los ves puestos en ti." · "Unos likes, un quiz de color y
listo: tu primer look hoy. Gratis y en español."

**Hombres · eventos** — títulos: "¿Boda el sábado? Te visto" · "Qué ponerte
para la cita" · "Entrevista mañana: look listo" · "Con tu ropa, sin comprar
más" · "Te lo pruebo antes de salir" · "Tu stylist con IA, gratis".
Descripciones: "Dime el evento y la hora. Te armo el look con lo que tienes y
con el clima de ese día." · "Lo ves puesto en ti antes de salir de casa. Sin
tarjeta, sin contraseña."

**App (neutra)** — títulos: "La app que te dice qué ponerte" · "Outfits con
tu ropa, con IA" · "Tu clóset, resuelto en minutos" · "Sin fotografiar cada
prenda" · "Gratis y en español". Descripciones: "Sube fotos donde ya sales
vestido y yo saco las prendas. Después te armo los looks." · "Tu gusto, tus
colores y tu ropa. Primer outfit hoy, sin tarjeta."

Extensiones: enlaces a "Cómo funciona", "Tu ropa de verdad", "Modo viaje",
"Preguntas"; texto destacado "Gratis", "Sin tarjeta", "En español", "18+".

### 2.5 Presupuesto (estimación propia, confianza baja hasta ver el Planificador)

Supuestos: CPC 5–12 MXN (fuentes públicas ponen retail/moda en 5–15 MXN en
México); landing→registro en frío 5–8% (con la landing arreglada);
registro→primer look 40–50% (los amigos: 23 de 24; en frío, menos).

| | por unidad |
|---|---|
| clics por primer look | ~30–40 |
| costo por primer look | **~200–400 MXN** |
| 30 primeros looks (la muestra del criterio de paro) | **~6,000–12,000 MXN** |

Propuesta: **300 MXN/día** con tope, 3 semanas → ~6,300 MXN de primera
tanda. Si a la semana el costo por primer look va arriba de 500 MXN, se baja
a 200/día y se revisa qué palabra se lo come, no se sube. Antes de fijar
números finales: Planificador de palabras clave con esa lista (Roberto lo
tiene al crear la cuenta).

### 2.6 Cómo se lee y cuándo se apaga

**Dónde se lee (construido el 2026-09-23, v0.2.339.0):** `/admin/campana` junta
en una fila por campaña clics y costo (capturados a mano desde Google Ads, un
renglón por día), personas nuevas que pidieron su código, entraron, registro
(edad, mayor), cada paso del onboarding, primer look, TTV, volvió en 7 días, se
lo puso, IA de sus primeros 7 días y costo por primer look. Arriba, el
criterio de paro con su veredicto. El mismo resumen llega cada día a las 8 am
(CDMX) a `ADMIN_EMAIL`, con el gasto de IA del día anterior aunque no haya
campaña. **Rutina diaria de Roberto: capturar los clics, el costo y los
registros de Google de ayer, por campaña. Sin eso, las columnas de costo
salen vacías.**


Tres niveles, del más rápido al que importa:

**Nivel 1 — mecánica (días 1–5).** Si falla, se pausa y se arregla, no se
concluye nada del producto.
- CTR de búsqueda <1.5% → las palabras no son la intención o el copy no
  conecta. Cambiar copy/negativas.
- Landing→registro <2% → problema de landing (velocidad, promesa). Pausar.
- Registro→primer look <30% → el onboarding en frío está roto en algún paso;
  mirar el panel del mazo (escape/abandono) y `first_outfit_ttv`.

**Nivel 2 — eficiencia (semanas 1–2).**
- Costo por primer look >800 MXN después de 2,000 MXN gastados en una campaña
  → esa campaña se apaga.
- Comparar lo que reporta Google contra `/admin/adquisicion`; si Google ve
  menos de la mitad, es el cambio de navegador (TikTok/IG → Safari) o la
  cookie, no la campaña.

**Nivel 3 — el experimento (el único que decide escalar).** Criterio ya
acordado el 2026-09-10: **de las primeras 30 personas con primer look, si
menos de 6 vuelven otro día en su primera semana, se para y no se escala.**
Se lee en la columna "volvió en 7 días" (sólo ventanas cerradas) por campaña:
- `hombres-diario` se lee a 7 días.
- `hombres-eventos` se lee a 7 **y** a 30 días, y además con `espejo_subido`
  / `worn`: el uso por evento es episódico y "volvió en 7 días" lo castiga.
- `app-neutra` se lee partida por género (el panel lo hace): es la lectura
  gratis de mujer.

Paro total: 3 semanas o 8,000 MXN, lo que llegue primero, salvo que el nivel
3 ya esté dando ≥20% — entonces se decide escalar con datos.

**Trampas de lectura ya conocidas:** el registro se cuenta al guardar la
edad (no al crear cuenta); menores no se cuentan; el origen se pierde si la
persona cambia de navegador; `/admin` y "ver como" no cuentan como visita;
una alta con `(sin origen)` puede venir de un anuncio si borró cookies.

---

## 3. Meta (Facebook/Instagram) y TikTok

**Estado real:** para TikTok el píxel existe en código apagado
(`NEXT_PUBLIC_TIKTOK_PIXEL_ID`), el aviso lo menciona y `ttclid` se guarda.
Para **Meta no hay nada**: ni píxel, ni Conversions API, ni mención en el
aviso de privacidad; sólo se guarda `fbclid` en el origen (o sea, el panel sí
sabría que alguien vino de Meta por `utm_source=meta`, pero Meta no sabría
quién convirtió y optimizaría a ciegas).

**Recomendación: no pagar en Meta ni TikTok en esta tanda.** Razones:
1. El experimento es de **recurrencia**, no de alcance, y 30 primeros looks
   se consiguen con búsqueda, donde la persona ya trae el dolor. En Meta/
   TikTok la intención se crea con el video; mezclar audiencia "que buscaba"
   con "que le interrumpimos el scroll" contamina la lectura del 20%.
2. Sin píxel, Meta no aprende; el costo por registro sale 2–4× peor que con
  píxel. Construirlo es medio día (mismo patrón que el de TikTok en
  `lib/publicidad.ts`) más ampliar el aviso — se hace cuando toque, no antes.
3. El flujo dentro del navegador de TikTok/Instagram (pedir código, salir al
   correo, volver) no se ha probado. Es el pendiente 6 del readiness.

**Lo que sí vale la pena YA en esos canales: orgánico con video** (sección 4),
con links con `utm_source=tiktok` / `utm_source=instagram` y
`utm_medium=organic` en la bio, para que el panel los separe. Sirve para
probar mensajes gratis y da el material que después se pagaría.

---

## 4. Los videos (Flow / Veo)

La duda de Roberto: qué videos, que comuniquen el producto y respeten el
branding (monocromo B&N, editorial, voz cálida; modelos mexicanos, sin
ámbar/terracota).

Primero la advertencia: **el video 100% generado por IA choca con la
promesa de la landing ("un ejemplo real", "tus prendas reales")**. Si el
anuncio se ve generado, la persona asume que el producto también. Veo/Flow
sirve para **b-roll de ambiente** (el clóset, la mañana, la prisa); el
producto tiene que salir **grabado en pantalla, real**.

Tres piezas, 9–15 s, verticales, sin voz en off (subtítulos grandes en Arimo,
B&N con la ropa a color):

1. **"El clóset lleno."** B-roll IA: mujer/hombre mexicanos frente al clóset
   abierto, luz de mañana, 3 cortes de prendas tiradas en la cama. Texto:
   "Tu clóset está lleno. Y aun así, no sabes qué ponerte." Corte a pantalla
   real: el look de hoy apareciendo. Cierre: "stailist · tu stylist con IA ·
   gratis". Es el hero de la landing en movimiento; una versión hombre y una
   mujer.
2. **"De tu foto salen tus prendas."** 100% pantalla real: una foto del
   carrete entra, las 5 tarjetas de prendas aparecen, un toque confirma, el
   look se arma con esas prendas. Texto: "Sin fotografiar prenda por prenda."
   Es el diferenciador contra Whering/Stylebook y el que más convierte en
   frío.
3. **"Boda el sábado."** B-roll IA de 2 s (invitación, reloj) + pantalla
   real: eliges "una boda", sábado 7 pm, el clima aparece, salen 2 looks, el
   try-on lo muestra puesto. Texto: "Dime el evento. Te visto con lo que ya
   tienes." Alimenta la campaña de eventos.

Orden de producción: 2 → 1 → 3 (el 2 no necesita IA y es el más honesto).
Especificar a Flow/Veo el casting (piel morena/mestiza, no afrodescendiente;
ver `memory/modelos-mexicanos-no-afrodescendientes`), luz neutra fría, sin
naranjas, y pedir el clip sin texto (el texto se pone después, con la fuente
de la marca).

---

## 5. Un correo centralizador

Roberto: varias iniciativas de IA y ningún buzón común; lo quiere para
**recibir**, no para enviar.

Hoy `hola@stailist.co` **manda pero no recibe** (por eso el DMARC quedó sin
`rua`). Dos opciones:

- **Recibir sin costo:** reenvío de correo del dominio (Cloudflare Email
  Routing o ImprovMX) — `hola@stailist.co` y un comodín `*@stailist.co`
  reenviados a una cuenta que ya lee Roberto. Sólo son registros MX/TXT en el
  DNS de Vercel; 20 minutos; no manda correo, exactamente lo que pidió.
- **Un buzón de verdad para todas las iniciativas:** una cuenta de Google
  Workspace tipo `iniciativas@kublau.com` (o un Grupo de Google, que es
  gratis dentro del Workspace que ya tiene `kublau.com`) y que **esa** sea
  la dueña de Google Ads, GA4, Search Console, Meta Business y TikTok Ads,
  con `roberto@kublau.com` como administrador. Así las cuentas de anuncios
  no dependen de un correo personal y los avisos de facturación/cobros
  llegan a un solo lugar.

Recomendación: las dos, porque resuelven cosas distintas: el Grupo es el
dueño de las cuentas de plataforma; el reenvío de `stailist.co` es la puerta
pública (y el destino del `rua` de DMARC).

---

## 6. Orden de ejecución

1. **Hoy/mañana:** arreglar el peso de la landing (§2.1) y el "¿Lista" (§2.2).
   Sin esto, el CPC sube y la lectura del nivel 1 sale falsa.
2. **Roberto:** cuentas + los 5 IDs (pasos de `adwords-readiness.md`), con el
   Grupo/buzón como dueño (§5). Recorrido en frío desde su teléfono (§2.2).
3. **Claude:** subir IDs a Vercel, redeploy, revisión de red en prod (el
   correo no viaja), verificar que `registro` y `primer_look` disparan.
4. **Esta semana, en paralelo:** ronda de mujer en el comparador (§1.4),
   votada por Tatiana o Val.
5. **Prender** las tres campañas de búsqueda (§2.3) con 300 MXN/día.
6. **Semana 2:** con la ronda de mujer y el nivel 1 leídos, decidir si se
   abre `mujeres-diario`.
7. **En paralelo, sin presupuesto:** los videos (§4) al orgánico con utm.
8. **Semana 3:** leer el nivel 3 y decidir escalar, arreglar o parar.
   Meta/TikTok pagados sólo después de eso.

Fuentes usadas para el rango de CPC en México:
[MailClick](https://www.mailclick.com.mx/cuanto-cuesta-google-ads-en-mexico/),
[VCC Agency](https://vccagency.com.mx/blog/cuanto-cuesta-google-ads-mexico),
[Axon Digital](https://www.axondigital.mx/blog-de-marketing-digital/cuanto-cuesta-hacer-publicidad-digital-en-mexico-en-2026-precios-reales-en-meta-google-y-tiktok/).
