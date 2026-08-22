# Changelog

Cambios notables de stailist. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/); versiones `MAJOR.MINOR.PATCH.MICRO`.

## [0.2.269.3] - 2026-08-22

### Added — atajos de comentario al votar

Tres chips de un toque bajo cada look, con el texto de Roberto: "bien, pero
muy formal para la ocasión", "bien, pero muy casual para la ocasión" y
"depende del tipo de plan — así no puedo decidir". Un toque lo pone en el
comentario (y se puede seguir escribiendo); otro lo quita. El tercero es su
duda convertida en dato: si se repite en un brief, el problema es el brief,
no el motor.

Anotado, sin tocar: "cita · semiformal" le resulta ambiguo al votar ("¿cena o
trabajo?") — y es exactamente lo que recibe el motor. Reescribir el pool con
el contexto que daría una persona real es pool v9 y rompe la comparabilidad
con las rondas de v8; va después de que se vote la ronda en curso, si Roberto
lo pide.

## [0.2.269.2] - 2026-08-22

### Changed — votar en desktop: los tres looks en filas, el voto en medio

Roberto: "donde yo normalmente lleno esto es en desktop… pongo los thumbs y
luego tengo que dar scroll para escoger A, empate o B. Está de hueva". En
desktop la pantalla era la de celular estirada: dos columnas con fotos de
póster, pestañas por look y el voto lejos de los pulgares.

A partir de 1024px la pantalla es otra: **una fila por look**, con la tarjeta
A a la izquierda, la B a la derecha y los botones Gana A / Empate / Gana B en
medio, **a la altura de los pulgares** — sin pestañas y sin scroll entre una
decisión y la otra. Las fotos pasan a cuatro por fila (tamaño de ficha). La
barra fija de abajo sólo dice qué falta y guarda. En celular no cambia nada:
look por pestaña, auto-avance y barra fija.

## [0.2.269.1] - 2026-08-22

### Changed — votar y cruzar, con menos trabajo por look

Roberto: "¿puedes mejorar el UX del votar y cruce para que sea más fácil?".
Se midió primero qué se usa de verdad en 105 pares votados: el 👍/👎 en el
97%, el comentario por look en el 57%, los chips de defecto en el 21%, la
nota del par en el 13%. Lo que más pantalla ocupaba era lo que menos se
tocaba, y el control que decide el experimento (Gana A / Empate / Gana B)
estaba al fondo de un scroll largo, tres veces por par, seis pares.

**Votar** (`votar-client.tsx`):
- Barra fija abajo con el voto del look visible; al votar avanza solo al
  siguiente look sin voto, y cuando el par está completo la misma barra
  ofrece "Guardar el par N → siguiente". Las pestañas muestran el voto dado
  (Look 1 · A).
- Pulgares al tamaño de un dedo, en su propia fila bajo el nombre del look.
- Chips de defecto plegados tras "marcar un pero"; el comentario se abre solo
  al dar 👎 (o con "comentar"). La nota del par, plegada.
- El pie explicativo de seis líneas, a una.

**Cruce** (`cruce-client.tsx`):
- El nombre de cada prenda va debajo de la foto, siempre visible: iba en un
  overlay al pasar el mouse y en el celular no hay mouse.
- Barra fija arriba con "X de N calificados" que se mueve sin recargar, y
  "siguiente sin calificar →" que salta a la tarjeta pendiente. Pendientes
  primero dentro de cada caja, con borde marcado.
- "tiene razón / se pasó" como dos botones a todo lo ancho; "tú" y "el juez"
  apilados en celular en vez de dos columnas estrechas.

Verificado en móvil (375px) contra la ronda 2bba08e0 sin guardar ningún voto.

## [0.2.269.0] - 2026-08-22

### Changed — el juez stylist aprende la vara de Roberto (js5) + el examen del juez

`scripts/examen-juez.ts`: cruza cada look del comparador que Roberto marcó
👍/👎 con la crítica del juez, y reporta por umbral de gravedad cuántos 👎 caza
y cuántos 👍 marca. En seco usa las críticas guardadas ($0); con `--correr`
corre el juez vigente sobre los mismos looks (~$0.08 por 95). Es la medición
que el doc del loop dice que se repite cada vez que el juez cambia.

Primer examen (js3, 95 looks: 27 👎 / 68 👍): **ve pero no pesa** — con
cualquier hallazgo cazaba el 85% de los 👎, con "rompe" el 22%. "Camisa negra
para una boda es como de cholo… fatal" era `color/resta`. Y "plano" —el
defecto que a propósito no es defecto— era su hallazgo más frecuente, 18 de 21
veces en looks que a él le gustaron.

js4 → js5, dos vueltas el mismo día:

- El system lleva ahora LA VARA DE LA PERSONA con sus casos reales: qué le hace
  decir "ni al caso" (mezclilla con blazer, negro con chinos beige, camisa
  negra en boda, blazer como única capa a 8°…) y con qué defecto y nivel va
  cada uno; qué es "resta" (lino en oficina, demasiadas capas); y qué aprueba
  sin comentario (negro con burdeos, traje entero en cita, reloj de caucho en
  diario, "plano").
- Dos líneas de REGLAS_DE_LA_CASA que sus votos refutaron: burdeos no es café
  (cinturón negro con mocasín burdeos pasa, y café con jeans negros en casual
  también — lo que rompe es café en un look negro completo), y una sola pieza
  de lino en oficina ya resta. js4 falló justo ahí porque la casa le decía lo
  contrario.

| umbral | js3 | js5 |
|---|---|---|
| "rompe": caza 👎 / falsa alarma 👍 | 22% / 7% | 48% / 12% |
| "rompe o resta" | 70% / 56% | 85% / 40% |

Se paró en dos vueltas a propósito: una tercera sobre los mismos 95 sería
ajustar al examen. El número que vale es el de la próxima ronda votada.

## [0.2.268.0] - 2026-08-22

### Added — el retador "prompt anterior": lo nuevo tiene que ganarle a lo de ayer

Nueva variante del comparador, `prompt-anterior`: corre la **última versión
congelada del prompt de este clóset** (`prompts_congelados`) dentro del
pipeline completo de hoy — mismo juez, misma reparación en código para los dos
lados, así que lo único que difiere es el prompt. Es el freno que faltó la
semana del 19 de agosto, cuando nueve versiones salieron medidas cada una por
su propio termómetro y la aprobación de Roberto cayó de 91% a 52% sin que
ningún instrumento lo viera.

Cómo está hecho, y por qué así:

- `OpcionesGeneracion.congelado` (`{version, system, texto}`): el generador usa
  ese system y ese mensaje ya renderizado en vez de construir el de hoy, y
  anota en el recibo la versión que corrió de verdad. Solo lo resuelve
  `generar-lado.ts`; producción no lo toca.
- `elegirPromptAnterior` (pura, con test): el congelado más reciente cuya
  versión no sea la vigente, del mismo pool, y con todas sus prendas todavía
  en el clóset. Si falta cualquiera de las tres, el lado **falla claro** con
  el script a correr — un lado que midiera otra cosa es peor que uno vacío.
  Verificado contra la base: hoy se rehúsa (no hay anterior a v57) y, simulando
  el código en v58, los 6 briefs del vistazo resuelven v57 intactos.
- Congelar antes de subir de versión pasa de "buena práctica" a **paso
  obligatorio** del proceso (`docs/improvement-loop-del-motor.md`, paso 5).
  v57 queda congelado como primera línea base (17 briefs, 298 KB).

Al leer una ronda con este retador: **"Producción" es lo nuevo** y "Prompt
anterior" es el control. Si el control gana, lo nuevo no sale.

## [0.2.267.0] - 2026-08-22

### Added — los looks del comparador congelan el nombre de sus prendas

`LookMotor.prendas` (`{id, nombre}[]`, mismo orden que `item_ids`) se escribe al
generar cada lado (`conNombres` en `lib/comparador/generar-lado.ts`). El script
que juzga usa el nombre vivo y, si la prenda ya no existe, el congelado — nunca
"Prenda" a secas si hay forma de saber qué era.

Por qué: el 08-18 se recreó el clóset de Roberto y 393 de sus 520 votos del
comparador quedaron apuntando a ids muertos. Un look que sólo guarda ids muere
con la siguiente limpieza de cuentas; uno que guarda nombres sigue siendo
legible para un juez o una persona. `scripts/backfill-nombres-comparador.ts`
rellenó los 102 lados cuyas prendas siguen vivas; los 203 huérfanos no se
tocan (no hay de dónde sacar el nombre).

Las pantallas del comparador siguen resolviendo por id contra el clóset vivo —
pasarlas al nombre congelado es el siguiente paso si se vuelve a necesitar leer
una ronda vieja.

## [0.2.266.2] - 2026-08-22

### Fixed — el doc del loop decía 520 votos; utilizables son 95

Al ir a correr el examen del juez sobre el histórico salió que **el clóset de
Roberto se recreó el 2026-08-18** (sus 65 prendas tienen esa fecha de alta) y
que los looks del comparador guardan **sólo `item_ids`, no nombres**. Resultado:
los 393 votos de las rondas del 6 al 14 de agosto apuntan a prendas que ya no
existen — 0 de sus ids resuelven. El voto sobrevivió; el look que lo motivó, no.
Se evitó gastar $4.88 juzgando looks que habrían llegado al juez como "Prenda,
Prenda, Prenda".

Corregido en `docs/improvement-loop-del-motor.md` antes de que el documento se
volviera la próxima fuente de verdad equivocada. Añadido también el resultado
del examen sobre los 95 looks que sí se reconstruyen (sección 6-bis): el juez
**ve pero no pesa** — caza 85% de los 👎 con "cualquier hallazgo", pero sólo 22%
con su "rompe".

**Deuda que sale de aquí, antes de la próxima ronda:** que los looks del
comparador guarden el nombre de cada prenda junto al id. Es aditivo y barato, y
sin eso la próxima limpieza de cuentas vuelve a borrar la base de evaluación en
silencio. Los 138 comentarios de Roberto sí sobrevivieron (son texto).

## [0.2.266.1] - 2026-08-22

### Added — el improvement loop del motor, escrito

`docs/improvement-loop-del-motor.md`: qué evaluamos, con qué, y qué tiene que
pasar para que un cambio del motor salga. Pedido de Roberto tras la regresión
de v56: "que tengamos esto como un proceso bien documentado… que no sea 'si
probamos algo, ya no entiendo cómo nos va a funcionar'".

Lo que el documento fija y antes sólo existía en la cabeza de quien corría la
ronda:

- **El universo de evaluación, con números**: 520 looks marcados por Roberto
  (430 👍 / 90 👎) en 9 rondas, 105 pares votados, 138 comentarios, 43
  calificaciones al juez. Y lo que NO hay: 0 votos suyos en producción, 22 en
  toda la app. Con las trampas de leerlo — el universo es 83% positivo, así que
  la cifra que importa es el recall sobre los 90 👎, nunca el acierto global.
- **Las cuatro varas y quién sostiene cada una** (reglas de código / eval /
  juez / voto de Roberto), y por qué hoy sólo la última decide: el juez lleva
  0 rechazos en 64 looks y no vio la regresión. Corregido de paso el "47% de
  acierto": "exageró" no es "erróneo" — 30 de sus 43 calificaciones fueron
  acuerdo.
- **Las 8 reglas duras**, incluida la que faltó (nada sale sin ronda
  nuevo-vs-anterior con aprobación ≥) y su bloqueador: no existe un retador
  "prompt anterior" en `VARIANTES_MOTOR`.
- **La bitácora de rondas** con la aprobación de cada una, que es donde se ve
  una regresión de un vistazo.
- **El plan del loop automático** en 3 etapas, con la vara para soltar al juez.

`docs/como-decidir-un-cambio-del-motor.md` (la parte técnica del instrumento
pareado) sigue vigente y ahora apunta al canónico. CLAUDE.md manda a leerlo
antes de tocar el motor.

## [0.2.266.0] - 2026-08-19

### Changed — reversión: el generador vuelve al prompt de v53 (v57)

Roberto votó las tres rondas del día con el mismo clóset, los mismos 6 briefs
y el mismo retador. Aprobación de looks: v53 **91%** → v55 72% → v56 **52%**.
"La peor que ha salido". Nueve versiones en 48 horas, cada una medida por su
termómetro local (reparto de 3, disparos de regla, trajes en la cita) y
ninguna contra la aprobación de la versión anterior — que es la única métrica
que importa. El loop destapó la regresión en un día; lo que faltó fue el
freno.

Se retiran los dos cambios que tocaban el texto del generador:

- **v54 ("EXACTAMENTE 3 outfits")**: forzar el tercero cuando el clóset no da
  mete relleno. Vuelve "2 o 3"; el piso de 2 del pipeline sigue de red y las
  pestañas del trío muestran los que haya.
- **v56 (la línea de cita)**: los trajes enteros desaparecieron (0/3), pero lo
  que los sustituyó fue peor — mezclilla + blazer ("culerísimo"), lino
  esmeralda + blazer ("Terrible!!"), camisa negra + blazer azul ("ni al caso").
  Decirle al motor qué NO sin decirle qué SÍ va con un blazer lo obligó a
  improvisar. La nota queda en `lib/eventos.ts` para cuando vuelva, con lo que
  tiene que traer.

Se quedan: las reglas de código de v55 (reloj deportivo / corbata de punto) y
el reparador de cueros — viven fuera del prompt, sólo reparan lo detectado y
se validaron sin falsos en casual. También js3 y los grados en el brief (son
del comparador, no del motor).

Regla nueva del loop, a partir de aquí: ningún cambio del motor sale sin una
ronda "nuevo vs anterior" del comparador con aprobación igual o mayor.

Lo que los 15 👎 de hoy dejan validado para la siguiente vuelta, UNO a la vez:
abrigo de verdad a 8° (los 3 looks con el abrigo de lana: 👍👍👍; los de
chaqueta ligera: "ninguno está bien para ese frío"); lino en oficina con UNA
sola pieza ya molesta (4 veces "habíamos quedado que lino no para el
trabajo" — la regla `full-lino-en-oficina` se acotó a lino arriba Y abajo y
eso quedó refutado); manga corta bajo chamarra ("ni al caso", 2 veces);
calzado que choca con la base (tenis rojos con traje, bota café con pantalón
negro, derby chocolate en total black).

## [0.2.265.0] - 2026-08-19

### Changed — la cita tiene registro: coctel relajado, no traje entero (v56)

El motor entregó tres trajes completos para "una cita en un restaurante" y
Roberto marcó el mismo desajuste tres veces calificando la ronda: "para una
cita no suele ser así: si acaso un blazer, pero no el traje sin corbata — ese
es el look más cóctel para un evento más formal". El brief "cita" era demasiado
ambiguo para que nadie —motor, jueces o él— pudiera decidir si un traje era
correcto.

La línea quedó escrita en el catálogo de eventos (lib/eventos.ts), que es el
punto de palanca: `paraElMotor` de "cita" lo comparten el generador, las tres
rúbricas y producción. Una sola edición y la misma vara guía al que arma y al
que califica. Con la excepción de Roberto de fábrica: "depende de cómo se vista
la persona — si en el diario se viste de traje, pues está bien" (si su marca de
estilo es de sastre o su plan pide algo muy formal, el traje sí va).

A propósito NO es una regla de código: "traje en cita" no es verificable como
un choque de cueros — depende del estilo y del plan. Es guía compartida, y el
cruce de la próxima ronda mide si alcanzó.

## [0.2.264.1] - 2026-08-19

### Fixed — el brief dice los grados, no sólo "frío"

Roberto, calificando un hallazgo de clima: "cuando dices 'frío' es ambiguo —
pon grados, porque no sé si me estás diciendo este look para los 8°". Lo
notable: los jueces SIEMPRE recibieron la temperatura exacta (por eso sus
hallazgos citan "para 8°C") — el que veía la banda a secas era él. O sea que
calificaba al juez con menos contexto del que el juez tuvo para juzgar.

Ahora el brief muestra los grados y la lluvia en las tres pantallas donde él
evalúa: el cruce ("cita · noche templada · 18°C"), la votación y las marcas.

## [0.2.264.0] - 2026-08-19

### Fixed — el juez stylist ya conoce las reglas de la casa (js3)

El acierto del juez cayó de 88% a 47% en la segunda ronda calificada, y al leer
los desacuerdos uno por uno casi todos eran EL MISMO: recomendaba quitar la
camiseta de abajo del suéter — en contra de `sueter-sin-base`, una regla que
nació de Roberto votando a ciegas. No era terquedad: el juez sólo veía las
violaciones del look que miraba, así que un look que CUMPLÍA una regla le
parecía mejorable rompiéndola.

Ahora recibe la lista completa (`REGLAS_DE_LA_CASA`) con la orden de no
proponer arreglos que las rompan. La lista vive junto al código que ejecuta las
reglas — si una cambia, su línea se actualiza en el mismo commit — y cada línea
lleva su mecanismo y su excepción ("en diario el smart watch pasa"), porque la
mitad de las calificaciones de Roberto fueron precisamente excepciones.

## [0.2.263.2] - 2026-08-19

### Fixed — el juez sí dice cómo arreglarlo, y ahora se ve

Roberto, calificando hallazgos: "yo le preguntaría al juez: ¿cómo lo mejor
harías tú? No nada más criticar". Ya lo hacía — cada hallazgo trae su campo
`arreglo` ("cinturón burdeos que iguale el tono exacto de los mocasines") — pero
la pantalla del cruce sólo pintaba el problema. El juez parecía un crítico y era
un stylist con propuesta.

## [0.2.263.1] - 2026-08-19

### Fixed — después de votar una ronda, calificar al juez ya no está escondido

Roberto votó la ronda entera y no encontró dónde opinar sobre los hallazgos.
No era un problema de datos —los 6 pares votados y las 12 críticas estaban
ahí— sino de camino: el marcador ofrecía **dos botones idénticos**, "Lo que
vieron los jueces" y "Tu voto contra el juez", con exactamente el mismo estilo.
El primero se llama justo como lo que él quería hacer, es LECTURA, y no tenía
ni dónde comentar ni salida: callejón sin salida.

Ahora el cruce va primero, en negro, y dice qué falta ("te faltan 27 hallazgos
por calificar" / "ya los calificaste todos"); la pantalla de lectura queda
debajo en gris. Y desde esa pantalla de lectura hay salida al cruce: "¿Estás de
acuerdo? Califícalos uno por uno".

## [0.2.263.0] - 2026-08-19

### Added — el look de hoy te enseña sus tres opciones, no una

Al generar un look, la pantalla ahora dice "te armé 3 looks" con pestañas 1·2·3:
tres outfits completos, cada uno con su voto, su try-on y su fit check. Antes
veías uno — y los otros dos ya estaban pagados y se tiraban.

El desperdicio era literal. Desde v54 el generador produce EXACTAMENTE 3
outfits en una sola llamada, y la ruta del look de hoy revisaba el primero y
descartaba el resto. Roberto: "si estamos generando dos o tres, no perdemos
nada… sino es desperdiciar lo que ya se hizo".

Cómo quedó por dentro:

- **El look de hoy corre por fin el pipeline compartido** (`armarLooks`) — el
  mismo camino de /api/generate y el comparador, con juez y reparador en código
  incluidos. Era la única ruta que no pasaba por él.
- **La primera pantalla no espera al trío**: el primer look aprobado se
  entrega ya (mismo tiempo-a-look de siempre) y los otros dos llegan en
  background; las pestañas aparecen cuando están.
- Los alternos viven ligados a su principal por `grupo_generacion` (migración
  0143) y aparecen también en el diario.
- Los looks PLANEADOS para otro día siguen generando uno: sus alternos
  confundirían la promoción del amanecer.
- Costo: el juez corre por look, ~2× por generación. Decidido con ese dato a la
  vista — el gasto real de la app está en leer prendas, no en armar looks.

Verificado en el navegador con una generación real: trío en la base (principal
+ 2 alternos), pestañas al recargar, y cada pestaña con su look completo.

## [0.2.262.0] - 2026-08-19

### Added — dos reglas nacidas de calificar al juez, y nacen con reparación (v55)

Las primeras reglas que salen del cruce voto-contra-juez completo: el juez
stylist las encontró, Roberto las confirmó calificando los hallazgos, y entran
al motor ya con su arreglo en código — el orden que faltó en todas las
anteriores, que se escribieron sin reparación y el motor entregaba roto lo que
sabía roto.

- **El reloj deportivo no va con sastre.** Confirmado con la nota más
  contundente de la ronda: "Tiene toda la razón el reloj. Este 100% rompe con
  el look". Dispara con piezas de sastre en el look o formalidad formal/gala, y
  lleva la excepción de Roberto de fábrica: "podría hacer una excepción para
  smart watch en un día normal" — en diario, oficina y casual no dispara. Se
  repara cambiando a un reloj de vestir o quitándolo: la muñeca desnuda es más
  elegante que la muñeca equivocada.
- **La corbata de punto no va a ceremonia.** Confirmado dos veces ("Sí, no va
  la corbata de punto"): textura tejida y punta cuadrada son registro
  casual-elegante, no de boda en salón. Se repara cambiando a una corbata lisa;
  si el clóset no tiene otra, NO se quita — la ceremonia pide corbata, y
  quitarla arreglaría esta regla rompiendo el pedido.

Validadas contra los 32 looks reales de la ronda calificada: disparan
exactamente en los 4 que el juez marcó y Roberto confirmó (incluida la cita,
que entra por las piezas de sastre y no por formalidad), los 4 se reparan en
código, y los looks casuales con smart watch pasan limpios — que era la
excepción pedida.

## [0.2.261.0] - 2026-08-19

### Fixed — el motor ya no entrega looks que él mismo sabe que están rotos

El hallazgo que lo motivó, medido en la primera ronda calificada por Roberto:
la regla del cinturón (`cueros-que-no-se-hablan`) disparó en 7 looks, el juez
de producción reparó 3, y **4 se entregaron rotos** — los mismos 4 que el juez
stylist cazó después y Roberto confirmó cinco veces ("Agree, no va café con
negro"). El motor detectaba el fallo, lo anotaba, y lo entregaba igual.

Tres arreglos, del más chico al más profundo:

- **El reparador en código aprendió la regla de cueros.** El calzado es el
  ancla (los pies no se quedan descalzos); el cinturón o el reloj se cambia por
  uno del color del calzado y, si el clóset no lo tiene, se retira. Un look sin
  cinturón está bien; uno con el cinturón que choca, no. Validado contra los 4
  looks reales entregados rotos: ahora se arreglan los 4.
- **El reparador reconoce el calzado por nombre, no sólo por categoría.** Las
  prendas nacidas del catálogo no traen `categoria` en attrs, y la primera
  versión de este arreglo trató unos mocasines como "accesorio movible" y los
  quitó del look. Lo cazó la validación contra datos reales — los tests con
  fixtures no lo veían. El mismo hueco afectaba a la reparación de calzado de
  lluvia, que llevaba semanas sin poder encontrar el calzado que debía cambiar.
- **El reparador ya ve el look que él mismo va cambiando.** `enLook()` cerraba
  sobre los ids originales: en la segunda vuelta buscaba prendas que ya habían
  salido y se rendía sin terminar el arreglo que su primera vuelta dejó a
  medias. Bug pre-existente, afectaba a todas las reglas con reparación.

Además, `mismoColorAOjo` ya no declara que un neutro y un color son el mismo
color (un cinturón gris carbón y unos mocasines burdeos medían "iguales" y la
regla se los saltaba). Con seis tests de los hexes reales del catálogo.

### Changed — el prompt pide EXACTAMENTE 3 outfits (v54)

Decía "2 o 3", y Roberto: "si dejamos las cosas tan abiertas, inducimos a que
el modelo tirite". Medido, tenía razón: en la última ronda el reparto fue
3,3,3,2,3,3,2,3,3,2,2,3. El piso de 2 del pipeline se queda como red, pero
pedirlo ambiguo era invitar al modelo a entregar menos.

## [0.2.260.2] - 2026-08-18

### Fixed — el cruce enseña para qué se pidió cada look

Cada tarjeta lleva ahora su brief: la ocasión, el clima, la formalidad traducida
y el evento en las palabras de quien pidió ("una cita en un restaurante"). Sin
eso no se puede calificar un hallazgo — "rompe el clima" es justo con 8°C y
lluvia e injusto con 24°C despejado. Va por tarjeta y no en el encabezado porque
el cruce agrupa por caja y no por par: dos tarjetas vecinas pueden venir de
briefs opuestos. Roberto: "no quitaste esa información, entonces me es
complicado el evaluar sin ese contexto completo".

## [0.2.260.1] - 2026-08-18

### Fixed — las prendas del cruce se ven, y dicen cómo se llaman

En la pantalla de calificar al juez los thumbnails medían 56px: a ese tamaño no
se distingue un mocasín de un botín, que es exactamente lo que hay que ver para
calificar un hallazgo sobre el calzado. Ahora miden 96px. Y el nombre de la
prenda vivía en el `title` del navegador —tarda ~1s en salir y la mitad de las
veces no aparece—; ahora es una etiqueta propia que aparece sobre la foto al
pasar el mouse. Roberto: "están demasiado chicos… sería lo ideal que si le hago
el hover pudiera ver que diga 'zapatos cafés'".

## [0.2.260.0] - 2026-08-18

### Added — calificar al juez, no al look

Pantalla nueva `/admin/comparador/motor/<id>/cruce`: "Tu voto contra el juez".
Reparte los looks de una corrida votada en cuatro cajas —coincidieron, sólo tú
lo viste, sólo el juez lo vio, los dos limpios— y en cada uno deja marcar si el
juez **tiene razón** o **se pasó**, con una nota.

Es la única medición que el juez no puede hacer solo. El primer cruce (hecho a
mano sobre la ronda 283d8d44) dio: 5 coincidencias, **0** looks donde Roberto
marcara algo que el juez no viera, y **20** donde el juez marcó y él no. Ese 20
es ambiguo por definición —o ve lo que Roberto pasa por alto, o inventa
problemas— y sin una opinión humana encima no se desempata.

Vivía en un script suelto y llegaba como un archivo por chat. Roberto: "no nada
más el HTML, sino poder poner yo ahí comentarios para que sea más fácil que lo
proceses". Una medición que sólo existe cuando alguien la pide a mano es una
medición que no se hace.

Se abre DESPUÉS del voto y nunca antes: el cálculo se salta los pares sin votar
y la acción los rechaza. Guarda en `veredictos_juez` (migración 0142), aparte de
`voto` y de `prefs_look` — mide al juez, no al look, y no toca la regla
pre-registrada.

## [0.2.259.0] - 2026-08-18

### Changed — el traje se ve como un traje, no como dos prendas que combinan

Cuando un look lleva saco y pantalón del mismo traje, las dos piezas ahora
comparten una sola celda con un pie común ("Traje gris carbón"). El look deja de
enseñarte cinco cosas sueltas: te enseña cuatro, y una de ellas es un traje.

Sale de Roberto mirando un look y sin poder contestarse la pregunta obvia:
"ahí dice que son de traje los dos, pero… me gustaría ver si sí son del par que
corresponden". La etiqueta "traje completo" ya lo decía y era correcta, pero es
texto flotante encima de una cuadrícula: el ojo no la conecta con QUÉ dos fotos.
De tres tratamientos prototipados —recuadro alrededor del par, marca compartida
en cada pieza, y el par en una celda— se eligió el tercero: es el único que no
agrega adorno. Un traje ES una prenda.

Con eso, la etiqueta "traje completo" se retiró: repetía en texto lo que la
retícula ya enseña. Los avisos de "traje parchado" y "X sin su par" siguen donde
estaban — esos no se ven solos y son el error que engaña, dos grises plausibles.

Sale en las cuatro pantallas de una vez (detalle del look, cápsula, viaje y el
comparador) porque las cuatro comparten la misma retícula.

Dos decisiones que se ven poco y sostienen el resto:

- **El nombre del par sale de lo que las dos piezas comparten**, sin plantilla
  ni lista: "Saco de traje gris carbón" + "Pantalón de traje gris carbón" dan
  "Traje gris carbón", y el smoking y el traje sastre de mujer funcionan igual
  sin nombrarlos. Con menos de dos palabras en común se rinde y dice "Traje
  completo" — las prendas de foto llevan el nombre que la persona quiso, y
  titular una celda "Azul" es peor que no titularla.
- **Afirma, nunca niega.** Sólo 12 de 870 prendas de la base traen el lazo del
  traje (lo tienen las de catálogo; las de foto lo ponen a mano al darlas de
  alta). Sin lazo todo se dibuja igual que siempre, así que la AUSENCIA de
  agrupación significa "no sabemos" y no "no son del mismo traje". Un traje a
  medias tampoco se agrupa: sin su pantalón, el saco es una prenda suelta.

## [0.2.258.0] - 2026-08-18

### Fixed — los trajes del catálogo no eran del mismo tejido

Cuando el motor te arma un traje, ahora el saco y el pantalón se ven de la misma
tela. Antes no: seis de los nueve trajes de la biblioteca tenían las dos piezas
en tonos distintos, y dos de ellos por tanto que se leía como un traje mal
apareado — que es justo lo que la app promete evitar.

Lo cazó Roberto a ojo mirando un look ("algo me dice que no van así"), y la
medición le dio la razón, aunque no por donde él creía: **el emparejamiento
estaba bien; las fotos eran las que no empataban.** Medido como la luminancia
media del tejido descartando el fondo, contra los trajes sanos que miden Δ2:

| Traje | Antes | Ahora |
|---|---|---|
| gris carbón | Δ26 | Δ4 |
| azul marino | Δ26 | Δ8 |
| smoking negro | Δ24 | Δ16 (la solapa de satín sube el promedio; validado a la vista) |
| arena | Δ18 | Δ12 |
| sastre negro de mujer | Δ15 | Δ2 |
| azul claro | Δ13 | Δ10 |

La causa no era el prompt: cada pieza se generaba en una llamada independiente a
partir de una descripción de texto, y "charcoal grey wool" no es una instrucción
reproducible — dos llamadas dan dos grises. Que era deriva y no física de la
prenda lo prueba que el traje negro y el gris claro salieron con Δ2 del mismo
pipeline.

### Changed — el catálogo genera los conjuntos como par, no como dos prendas

`scripts/gen-archetypes.mjs --conjuntos`. El saco se genera con texto y el
pantalón **pasándole la imagen del saco como referencia**, para que el modelo
copie un tejido que ya existe en vez de interpretar un adjetivo. Como la
generación no es determinista, intenta hasta tres veces y conserva el intento
cuyo tejido quede más cerca del saco: la elección es por medición, no por gusto.
Los dos archivos se escriben juntos al final, porque guardar el saco antes de
tener su pantalón dejaba el catálogo con la pieza nueva y la vieja — el mismo
descuadre que este código existe para evitar.

Sin esto, el próximo traje que se agregue nace descuadrado otra vez.

## [0.2.257.3] - 2026-08-18

### Added — medir si el juez repara lo que las reglas encuentran, en producción

`scripts/reglas-en-produccion.ts`. La regla de coherencia cromática (v53) se
shipeó **sin poder validarla**: el comparador arma looks con generación no
determinista, así que la diferencia entre "con regla" y "sin regla" queda
ahogada por el ruido de dos corridas distintas.

Roberto lo advirtió antes de que yo lo viera: *"al usar o meter arneses,
terminaban fallando otras cosas al no dejar que replique de una manera más
realista la generación"*. Fijar los looks para aislar la reparación habría sido
exactamente eso, y era mi propuesta. Se retiró.

**La salida es medir donde la realidad ya pasa**, y no hacía falta instrumentar
nada: el evento `critic_review` ya guarda, por look, los ids de las prendas
`before` y `after` de la reparación del juez. Correr `revisarEjecucion` sobre los
dos contesta las tres preguntas de cualquier regla:

1. ¿dispara en looks reales, y cuánto? (antes)
2. ¿el juez la repara? (desapareció en el después)
3. **¿la reparación rompe otra cosa?** (violaciones nuevas en el después)

### Lo que midió en la primera corrida

```
regla                          disparó   sobrevivió   la metió el juez
colores-que-no-se-leen              6            2            5
mocasin-en-frio                     5            1            0
saco-de-traje-suelto                5            4            2
blazer-no-es-abrigo                 4            1            2
frio-sin-abrigo                     4            1            0
zona-sin-cubrir                     3            3            2
traje-desparejado                   2            0            0
zona-duplicada                      2            0            0
```

**El juez estaba CREANDO el problema de color en 5 looks** mientras arreglaba
otra cosa: no existían antes de su reparación y aparecieron después. Sumado, la
incoherencia cromática era más frecuente *después* de reparar (2 supervivientes
+ 5 nuevas) que antes (6). Y en 2 looks dejó el cuerpo sin cubrir, quitando
prendas.

**Ese es el mejor argumento que existe para la regla de v53, y es evidencia que
el comparador no podía dar.** Ahora que el juez recibe el hallazgo, debería
dejar de introducirlas.

`saco-de-traje-suelto` es la que peor sale de las viejas: dispara 5 veces y
sobreviven 4 (20% reparadas). O es carencia o el juez no sabe atenderla; queda
apuntado, sin investigar.

### Dos límites, dichos

- **Para las reglas nuevas, "sobrevivió" no mide el efecto de la regla**: el juez
  nunca fue informado de ellas en esos looks. Lo que sí vale de esa aplicación
  retroactiva es cuánto ocurre el problema y cuántas veces el juez lo crea.
- **El clóset del contexto es el de hoy**, no el del día que se generó el look.
  Sólo afecta a las reglas que distinguen fallo de carencia, y con clósets que
  casi sólo crecen el sesgo es hacia marcar de más.

### Y sobre v53 en concreto

Cero looks generados con `v53` todavía: la regla dispara en ~9% de los looks, así
que hacen falta ~100 looks para decir algo. El script lo dice al correrlo con el
disparador escrito, en vez de dejar el pendiente en la cabeza de alguien.

## [0.2.257.2] - 2026-08-18

### Added — medir si el juez que MIRA falla por el modelo o por la tarea

`scripts/rubrica-vision-modelo.ts`. La rúbrica de visión corre en
`VISION_MODEL` (Gemini 3.1 Flash-Lite), un modelo que ganó a ciegas la prueba de
**leer** prendas. Criticar estilo es otra tarea y más difícil, y nunca se midió
— y coincide con Roberto el 84% cuando **aprobar todo daría 87%**.

**No hizo falta un concurso nuevo.** El comparador de visión ya existe pero mide
leer, que es la tarea equivocada para esta pregunta. El instrumento ya estaba en
la base: los 62 looks que Roberto marcó 👍/👎 a mano en los evales. Se vuelven a
juzgar LOS MISMOS con otro modelo y se compara el acuerdo.

### El resultado, que va contra la sospecha que originó el script

| modelo | acuerdo | caza 👎 | rechaza buenos | acierta al rechazar |
|---|---|---|---|---|
| aprobar todo *(vara)* | 87% | 0/8 | 0/54 | — |
| **Gemini 3.1 Flash-Lite** *(hoy)* | 84% | 2/8 | 4/54 | **33%** |
| Gemini 3.5 Flash | 79% | 2/8 | 7/54 | 22% |
| Gemini 3.7 Flash | 85% | 1/8 | 2/54 | 33% |
| Sonnet 5 | 79% | 4/8 | 9/54 | 31% |

**No era el modelo.** Subir de tier (3.5 Flash) no cazó ni un rechazo más y
encima empeoró la precisión.

Y lo que de verdad cierra la pregunta está en la última columna: Flash-Lite,
3.7 y Sonnet **aciertan casi lo mismo cuando rechazan —1 de cada 3—** y lo único
que cambia entre ellos es cuántas veces se atreven. Eso es la firma de modelos
que saben lo mismo de la tarea con el umbral en distinto lugar: cambiar de
modelo te mueve por la misma curva, no te da un juez mejor.

3.7 parece el mejor en acuerdo global sólo porque es el **más complaciente** —se
acerca a aprobar todo, que es justo lo que la vara desenmascara. Roberto lo pidió
probar porque había perdido armando outfits (9-4 en pares ciegos) y valía ver si
juzgando se comportaba distinto; se comporta distinto, pero no mejor.

**Se queda Flash-Lite**, que era la decisión de Roberto antes de medir. La
palanca para que los jueces cacen más no es el modelo: es darles más de lo que ve
el humano — hoy juzgan una cuadrícula de prendas sueltas y él vota con el
contexto entero.

**Peso de la evidencia, dicho:** son OCHO rechazos humanos. Alcanza para
descartar el tier (ahí la mejora fue cero, no pequeña) y no para coronar a nadie.

### Changed — el juez visual acepta con qué modelo mirar

`evaluarLookConVision` toma un `modelo` opcional que por defecto es
`VISION_MODEL`. Existe sólo para retarlo: cambiarlo NO cambia producción, igual
que en el motor.

Los ids de los retadores viven en `RETADORES_VISION` dentro del catálogo, no en
el script. El candado de `lib/models.test.ts` me cazó al escribirlos a mano —
funcionando exactamente como debe.

## [0.2.257.1] - 2026-08-18

### Fixed — los thumbnails del look ya abren la ficha de la prenda

Roberto: *"no puedo ver el detalle de la prenda al picarle a alguno de los
thumbnails"*.

**No estaba roto: nunca se construyó.** La retícula pintaba `<div>` puros —sin
`Link`, sin `onClick`— y el tipo `TryonPrenda` ni siquiera cargaba el id de la
prenda. El dato sí existía aguas arriba (`app/hoy/page.tsx` ya lo tenía) y se
perdía en el camino.

**Son DOS superficies, y las dos enlazan ahora**: la retícula de "las prendas" y
la columna de miniaturas de "así te queda". Arreglar una sola habría sido peor
que ninguna — la persona no sabría cuál responde.

**Lleva al clóset y no abre una hoja nueva.** La ficha de una prenda ya existe,
con sus chips de edición, su conjunto y su borrado, dentro de `closet-grid`.
Duplicarla en el detalle del look habría sido la tercera copia de un vocabulario
que este repo ya tuvo que unificar una vez. El clóset la abre al recibir
`?prenda=<id>`, y el id se limpia de la URL al abrir para que el "atrás" del
teléfono regrese al look en vez de reabrir la misma ficha.

**Sin id no enlaza**, que es el caso del comparador y los evales: arman looks
sobre clósets ajenos o sintéticos y ahí no hay ficha que abrir. Ahí el tile
sigue siendo un `<div>`, exactamente como era.

Verificado a mano en el navegador, el viaje entero: tocar el blazer en el
detalle del look abre su ficha en el clóset, con nombre, chips y acciones, y la
URL queda limpia.

## [0.2.257.0] - 2026-08-18

### Fixed — el motor entregaba looks que no visten a nadie

El motor validaba que un look trajera **≥2 prendas reales y nada más**. Así que
*"Suéter gris + Camisa blanca"* —sin pantalón— pasaba entero y llegaba a una
persona que había preguntado qué ponerse. Y *"Chaqueta de piel + Botas negras"*
también: una chamarra y unas botas, sin torso ni piernas.

Medido sobre los 153 looks reales de la base: **14 (9.2%)** no cubrían el
cuerpo.

Había regla para que SOBRE una prenda en una zona (`zona-duplicada`) y ninguna
para que FALTE. Ahora existe `zona-sin-cubrir`, su espejo.

**Falso positivo: cero** sobre los 153 looks, incluidos los 31 con voto humano.

### Cómo se calibró, que es donde estuvo el trabajo

**El calzado NO entra, y eso se midió.** La primera versión pedía también
zapatos, y fue la única zona que produjo un falso positivo:

| Zona | Marca | De ésos, con 👍 o "me lo puse" |
|---|---|---|
| torso | 7 | **0** |
| pierna | 13 | **0** |
| ~~pie~~ | 7 | **1** ← |

Ese uno es *"Lino y campo"* (camisa de lino + camisa de mezclilla + chinos
oliva), que no lleva calzado en la fila y tiene un evento **`worn`**: una
persona real **se lo puso**. Obviamente con zapatos; la app no los nombró y a
ella no le estorbó.

La lectura de producto es que **el calzado es la zona que la gente rellena
sola** y el pantalón no. Marcarlo mandaría al juez a reparar looks que alguien
ya se puso — el peor falso positivo que puede tener este archivo. Como
consecuencia asumida, 6 looks sin calzado se quedan sin marcar.

**Otras dos decisiones, con su porqué:**

- **Fallo contra carencia**, la distinción que este archivo ya usa: sólo marca
  si el clóset TIENE con qué cubrir la zona. Quien no tiene un solo pantalón
  dado de alta no está ante un error reparable.
- **El traje de baño cuenta como abajo.** Un look de alberca es sandalias +
  traje de baño + camisa, y ahí la prenda de abajo ES el traje de baño aunque su
  zona sea `no-calle`. Sin la excepción, los dos looks de viaje de la base
  salían marcados estando bien.
- **Si una prenda no se reconoce, no se juzga**: podría estar cubriendo la zona.

### Fixed — "Pantalón técnico" se leía como abrigo

Caía en la regla de prendas técnicas (`parka|softshell|rompevientos|técnic`) y
se clasificaba como **capa**, así que su look aparecía sin nada que cubriera las
piernas. "Técnico" es un adjetivo: parka y softshell nombran la prenda, técnico
sólo describe la tela. Ahora el sustantivo manda, con el mismo tipo de guard que
ya protegía a "traje" de "saco de traje".

## [0.2.256.0] - 2026-08-18

### Fixed — el motor era ciego a una de cada cinco prendas de mujer

Salió tirando del hilo de un hallazgo del juez stylist. Medido sobre las **842
prendas reales** de la base:

| Clóset | Prendas que el vocabulario reconoce |
|---|---|
| hombre | **306/306 = 100%** |
| mujer | **437/536 = 81.5%** |

`lib/engine/vocabulario.ts` nació masculino —camisa, polo, chino, mocasín— y
nunca se le agregó el guardarropa femenino. Faltaban categorías **enteras**:
blusa, top, crop top, body, corsé, tacón, flats, bailarinas, Mary Janes, mules,
arracadas, brazalete, gargantilla, clutch.

**Por qué no es cosmético.** `zona-duplicada` y otras reglas preguntan por
ZONA (`tipoDePrenda(...)?.zona`). Cuando devuelve `null`, la prenda **no existe**
para esas reglas. Demostrado con el mismo error de estilismo en dos clósets:

```
dos calzados · hombre  →  ✅ la caza      dos de torso · hombre  →  ✅ la caza
dos calzados · mujer   →  ❌ NO la caza   dos de torso · mujer   →  ❌ NO la caza
```

Dos pares de tacones en un look pasaban sin marcarse. Dos blusas también.

**Después del arreglo: mujer 535/536 = 99.8%.** Lo único que queda sin
reconocer es "Funda amarilla de teléfono", que no es ropa — es una funda de
celular dada de alta como prenda.

### Added — el candado, con nombres reales de la base

`lib/engine/vocabulario-genero.test.ts` prueba 24 nombres tal cual los escribió
la visión al leer las fotos, verifica que cada uno caiga en su zona correcta, y
—lo que de verdad importa— que **el mismo error dispare la misma regla en los
dos guardarropas**.

También blinda las trampas de orden que el archivo ya resolvía: que "Zapatilla
deportiva" no la reclame el tacón, que "Camisa oxford" no la reclame el zapato
oxford, que "Vestido camisero" no la reclame la camisa, y que "Topsider" no se
lea como un top.

Y una decisión de clasificación: el **top deportivo** entra como `no-calle`,
igual que el short de baño. Contarlo como torso haría creer que hay con qué
armar un look de calle.

### Nota sobre el sesgo

Es la **quinta vez** que este proyecto tropieza con un default masculino en las
reglas de vestir. Las cuatro anteriores se cazaron leyendo código; ésta se cazó
**midiendo contra clósets reales**, que es la única forma que ha funcionado —
y por eso el candado prueba nombres de la base y no ejemplos inventados.

## [0.2.255.0] - 2026-08-18

### Fixed — el mismo color te favorecía y te apagaba al mismo tiempo

Lo encontró el loop de jueces haciendo exactamente lo que se le pidió. El juez
stylist marcó *"el tono oliva está listado explícitamente como uno que apaga la
cara según su colorimetría"*, y al ir a verificarlo apareció que la paleta se
contradecía sola:

```
PRESTADOS: Oliva #6B7A4C, Vino, Chocolate
EVITA:     Camel, Mostaza, Oliva apagado #6B7A4C, Beige amarillento
```

**El mismo hex en los dos lados.** El motor leía "te funciona" y el juez
castigaba "te apaga la cara"; ninguno de los dos se equivocaba — el dato se
contradecía. `seasonPalette` devolvía la evita de la estación base **sin restar
lo que el guiño ya había regalado**.

Pasa en tres combinaciones y le tocaba a **6 de 24 perfiles reales**: el oliva
en invierno+otoño (4 personas) y el **negro** en primavera+invierno y
verano+invierno (2). El negro pesa más: es el color más usado de cualquier
clóset y el eje de la identidad de la app.

### Cómo se resolvió, y por qué así

**Sale de las dos listas y queda sin marcar.** Ni "gana el guiño" ni "gana la
base".

El porqué lo dio Roberto al recordar que la colorimetría de este producto tiene
**tres** grupos, no dos: los que favorecen, los que juegan en contra, y **los
que ni una cosa ni la otra, que no están vetados**. Evidencia contradictoria es
la definición exacta del tercero. Elegir un ganador exigiría saber teoría que
este archivo no documenta y adivinar la intención de quien capturó el dato;
dejarlo sin marcar no le afirma al motor nada que no se pueda sostener.

**Por qué NO se arregló con `transfiere: false`**, que es el mecanismo que ya
existe y que alguien ya usó bien para Camel y Mostaza: ese flag es **global** y
el conflicto no lo es. El negro está en los colores de invierno y en la evita de
primavera y verano, pero **no en la de otoño** — marcarlo sin cruce se lo
quitaría a los cuatro perfiles de otoño+invierno que lo reciben con razón. El
conflicto depende del par {base, guiño}, así que la resolución depende de él
también. `transfiere: false` sigue siendo lo correcto para un color que de
verdad no cruza hacia nadie.

### Added — el candado, sobre TODAS las combinaciones

`lib/colorimetria-coherencia.test.ts` recorre las 16 combinaciones de base y
guiño, no sólo las que hoy tienen usuarias: la que no existe hoy es la que se
descubre en producción. Y separa los dos tipos de fallo — una estación que se
contradice **a sí misma** no es una frontera, es un error de captura, y ahí el
arreglo va en el dato.

Nadie lo había cazado porque no había nada que lo cazara: las dos listas se
escriben en bloques distintos del archivo, a cientos de líneas de distancia, y
agregar un color a una estación sin revisar la evita de sus vecinas no rompe
nada. Verificado por mutación: al quitar la resolución, 7 tests truenan
nombrando los colores.

### Changed — la cita entra al vistazo (pool v8)

El vistazo corría seis briefs y uno —"diario · templado"— no ejercitaba nada:
sin plan, sin formalidad, sin regla de clima que morder. Los otros cinco sí
ganan su lugar (oficina, boda, frío, calor, lluvia). Ese slot lo toma ahora
**una cita**, la más valiosa de las ocasiones que nunca se medían: arreglarse ES
el punto y no hay código de vestimenta duro que proteja al motor.

**Por qué se puede tocar el vistazo y no el veredicto:** la comparabilidad
histórica que `POOL_VERSION` protege es la de la tabla "qué modelo usamos", y
esa la alimenta el veredicto. El vistazo nunca declara ganador — existe para
encontrar defectos, y uno de hace dos semanas no se compara con uno de hoy.
Dejarle un slot muerto por conservadurismo era proteger algo que no existe.

## [0.2.254.0] - 2026-08-18

### Fixed — el juez stylist encontraba algo en el 100% de los looks

La primera corrida real (vistazo de 6 pares, $1.25) midió dos fallos del juez
que nació ayer. Ninguno era supuesto:

**1. Marcaba todo.** 14 de 14 looks en un lado y 15 de 15 en el otro. El prompt
ya le decía que devolviera lista vacía si el look estaba bien resuelto, y no lo
hizo ni una vez. Un revisor que siempre encuentra algo no prioriza nada.

El arreglo no fue repetirle la instrucción más fuerte, sino **darle la tasa
base**: sobre los 62 looks que Roberto calificó a mano en los evales, aprobó 54
— el 87%. Un juez que marca el 100% no está viendo lo que ve la persona para la
que trabaja. Ahora la vara dice eso con el número, reserva "rompe" para lo que
haría detener a alguien en la puerta, y declara que devolver la lista vacía es
la respuesta correcta y frecuente.

**2. Repetía un mito que esta casa ya desmintió.** Marcó en rojo *"blazer marino
con pantalón negro es un error de paleta"*. Esa regla se metió al prompt del
motor en `v5` y se **revirtió en `v6`** tras investigarla. Un juez que trae
sabiduría convencional sin medir vale menos que no tener juez: manda a arreglar
lo que está bien. Ahora lleva la lista de lo que aquí ya se midió y resultó
falso — marino con negro, café con gris, un neutro cerca de la cara, y el
vestir tonal.

**El resultado, sobre los MISMOS looks** (se volvió a juzgar la misma corrida,
así que la comparación es limpia):

| | js1 | js2 |
|---|---|---|
| Producción, looks con hallazgos | 14/14 (100%) | **9/14** |
| Producción, fallos que rompen | 4 | **0** |
| Ablación, looks con hallazgos | 15/15 (100%) | **11/15** |
| Ablación, fallos que rompen | 4 | **3** |

Y el mito quedó corregido con precisión: la única mención que sobrevive es
naranja, no roja, y critica la combinación de tres piezas (blazer marino +
pantalón negro + zapato café) en un evento formal de noche — que es un error
real y ya tiene regla propia.

### Fixed — el laboratorio medía la mitad del producto (pool v7)

La pantalla de "¿qué plan tienes?" ofrece **seis planes sociales de un toque** y
el pool del comparador sólo medía **tres**. Una cita, una fiesta y una comida de
trabajo **nunca se habían medido**, aunque el motor lleva días sabiéndolas
resolver. Y al revés: el pool sí medía `funeral`, que ni siquiera está en esa
pantalla — sólo se alcanza escribiéndolo en el texto libre.

Los tres que faltaban son además la franja con más margen de error: no hay
código de vestimenta duro que proteja al motor, así que un fallo ahí no rompe
una regla, entrega algo aburrido — la nota que ya sale más baja (`wow`). El
vistazo que se corrió salió sesgado a lo formal (boda, funeral), y de ahí que
los hallazgos más graves fueran corbatas y zapatos de vestir.

Van al **final** del pool a propósito: el vistazo toma los primeros 6 y ésos
están curados como prueba de humo de los caminos diarios. Los nuevos se miden
en el veredicto, que es donde se decide.

`POOL_VERSION` sube a `v7`, con el costo dicho: las corridas nuevas dejan de
compararse con las viejas. Es el precio correcto — seguir midiendo con un pool
que ignora la mitad de la pantalla es peor que perder comparabilidad con
corridas de un motor que ya cambió.

### Added — el candado para que el pool no vuelva a quedarse atrás

`lib/comparador/pool-cobertura.test.ts` compara los planes que la app ofrece
(`PLANES_VISIBLES`) contra los que el pool mide. Nadie cazó este hueco porque
no había nada que lo cazara: agregar un plan a la app y no agregarlo al pool no
rompe ningún test, no truena el build y no se ve en ninguna pantalla — sólo hace
que las corridas midan un motor que no es el que corre.

Verificado por mutación: al apuntar un brief a un tipo inexistente, el test se
pone rojo nombrando el plan que falta y diciendo que hay que subir
`POOL_VERSION`.

## [0.2.253.0] - 2026-08-18

### Added — los jueces hacen la revisión que se hacía a mano

Roberto: *"los jueces van a hacer el trabajo que yo hacía manual, y ya después
de la ronda ven qué motor fue mejor y hacen ajustes que puedan ayudar a
resolver los issues que los jueces detectaron… es importante que alguno de los
jueces se ponga el gorro de stylist también"*.

**Un tercer juez, el stylist** (`lib/engine/juez-stylist.ts`). No califica:
por cada look dice qué pieza falla, por qué, y **qué cambiarías**. Esa última
parte es la que ninguna rúbrica daba — las dos que ya existían están escritas
con gorro de stylist, pero su salida son seis números y una línea que justifica
el aprobado. Lo que se hace a mano es otra cosa: *"la camisa negra es la pieza
que rompe todo; cámbiala por blanca"*.

Tres decisiones que sostienen el diseño:

- **No lleva puntaje, a propósito.** En cuanto tenga una nota que subir,
  alguien optimiza contra ella y el motor aprende a complacer al juez en vez de
  a la persona. La casa ya lo tiene escrito: *"un juez Claude prefiere looks
  escritos por Claude"*. Entrega hallazgos; el puntaje lo dan las otras dos.
- **La voz sale del espejo, no se inventó.** `lib/espejo.ts` ya contesta "¿me
  veo bien?" con un ajuste concreto, y ya pasó por la corrección de la v3
  (*"siento está muy barbero el feedback"*) contra el elogio hueco.
- **Usa el vocabulario de `DEFECTOS_MOTOR`** — las mismas etiquetas que se usan
  al votar a mano. Así los hallazgos del juez y las marcas humanas se cuentan en
  el mismo idioma, que es la única forma de saber si el juez ve lo que vería una
  persona.

### Added — el resumen de ronda: de 240 notas a "estos son los temas"

`lib/engine/resumen-ronda.ts` agrupa los hallazgos de una corrida en temas
recurrentes. Es la parte que de verdad ahorra el trabajo manual: una corrida de
40 pares son ~240 looks juzgados, y hasta hoy las notas se veían de una en una.
Una pila que nadie lee es lo mismo que no tenerla — es exactamente lo que pasó
con `ai_calls`, que existía, nadie leía, y por eso el precalentado roto vivió
dos semanas.

**El orden es la parte útil**, y no es alfabético ni por frecuencia a secas:
primero lo que **ROMPE** looks (aunque salga poco: un fallo que tira el look es
más caro que uno que lo desluce), y dentro de eso, por en cuántos looks
apareció. Un tema en 14 de 40 looks es una regla que falta; en 1 es una
anécdota. Va partido **por variante**, porque la pregunta no es sólo cuál ganó
sino EN QUÉ difieren — que es lo que se convierte en el ajuste.

### Added — pantalla para auditar a los jueces

`/admin/comparador/motor/[id]/jueces`. El orden de la página es la tesis:
primero **los temas** (lo que se repite), después **el detalle look por look**
(la auditoría). Al revés obligaría a leer 240 notas para descubrir lo que el
conteo dice de una.

Las tres capas se enseñan juntas **y sin promediar**: si la que lee aprueba y
la que mira reprueba, esa discrepancia es el dato — casi siempre significa que
el fallo está en la imagen y no en el nombre, que es justo lo que un promedio
escondería.

### Added — la rúbrica que MIRA entra al instrumento pareado

`scripts/comparador-juzgar.ts` llamaba sólo a la rúbrica de texto, que ve
nombres de prenda y no tonos. Para una iteración de regla de COLOR eso es
preguntarle por matices a alguien que lee etiquetas. Ahora corre las tres capas
y saca **dos marcadores separados** (el que lee y el que mira), sin promediar.

Las fotos se descargan **una vez por look** y las comparten el juez visual y el
stylist: bajarlas dos veces sería pagar el ancho de banda doble para mandar
exactamente las mismas imágenes.

Migraciones `0140` y `0141`: columnas aditivas `notas_vision` y `criticas`.
Aditivas a propósito — cambiar la forma de lo ya guardado rompería la
comparabilidad del histórico, que es lo único que un instrumento de medición no
puede permitirse perder.

### Lo que todavía no está probado

El juez stylist **no ha visto una sola foto**. Los tests cubren la agregación y
el candado del vocabulario (un defecto fuera de la lista se descarta, o el
conteo de temas se rompería en silencio), pero si sus hallazgos son buenos —o si
es barbero pese al prompt— lo dice la primera corrida y no antes.

Y una hipótesis anotada, no resuelta: corre en `VISION_MODEL`
(**Gemini 3.1 Flash-Lite**), un modelo elegido a ciegas para LEER prendas, que
es tarea más fácil que criticar estilo. La rúbrica de visión corre en el mismo
modelo y coincide con el humano el 84%, por debajo del 87% de aprobar-todo.
Puede que no sea que "la visión no aporta" sino que es un modelo lite en una
tarea que le queda grande. Se mide, no se cambia de oído.

## [0.2.252.0] - 2026-08-17

### Added — la primera regla de armonía de color del motor

Roberto, sobre un look real ("Carbón bajo cero": traje gris carbón + camisa
negra + suéter marino + botines café): *"al usar tantos colores es cuando ya se
rompe y se ve no combinando"*.

Tenía razón, y la causa estaba en el prompt. El motor tenía **22 reglas de
ejecución y ninguna de armonía de color** — las dos que tocaban color eran
puntuales (que los cueros dialoguen entre sí; la corbata de un funeral). Todo
lo demás quedaba a criterio del modelo, y el prompt sólo sabía contar
SATURACIÓN (*"máximo 1-2 colores protagonistas; el resto neutros"*), nunca
contraste. Encima declara que gris, negro y marino *"son el FONDO del
guardarropa, funcionan siempre"*.

Léelo junto: **un look de cinco neutros oscuros sacaba nota perfecta.** Cero
colores compitiendo. El modelo no desobedeció — obedeció una regla incompleta.

La regla popular de "máximo 3 colores" tiene el MISMO agujero y casi con las
mismas palabras: exime a los neutros. Esa exención está escrita para outfits
donde los neutros son el telón de fondo de uno o dos colores de verdad, no como
licencia para construir el look entero de neutros.

**La regla mide tres señales y exige DOS de tres:**

1. **≥4 familias de color, contando neutros** — el arreglo a la exención.
2. **Una sola banda de valor** (todo profundo, todo medio o todo claro).
3. **Una pieza cálida solitaria** entre piezas frías.

Exigir dos es lo que evita que sea otro mito como el de "marino con negro
nunca" (que este repo metió en v5 y revirtió en v6 tras investigarlo). Cada
señal por separado rechaza looks buenos: la banda única la incumple el vestir
tonal, y la cálida solitaria, el clásico traje marino con zapato café. Las tres
juntas no tienen uso legítimo.

Reusa `banda()` y `oklch()`, que ya existían y estaban probadas: no se
inventaron matemáticas de color.

### Medida ANTES de cablearla, contra 148 looks reales

- Marca **10 looks (6.8%)**.
- De los **25 con 👍 o "me lo puse"**: marca **0**.
- "Carbón bajo cero" es el único look de toda la historia con las tres señales.

Honestidad sobre ese cero: sólo 30 de los 148 looks tienen algún voto, así que
"0 falsos positivos sobre 25 aprobados" significa *sin evidencia de falsos
positivos*, no *probado seguro*.

### Fixed — dos cosas que salieron al medir

- **El sesgo de género, cuarta vez.** La regla se diseñó sobre un look de
  hombre y sus dos únicos falsos positivos aparecieron en clósets de mujer, los
  dos por un **tacón nude** (marino + blusa esmeralda + tacón nude + arracadas
  doradas: un look de noche perfectamente bueno). Un tacón nude no es una
  decisión de color — es una pieza hecha para DESAPARECER contra la piel, igual
  que los metales, que la regla popular ya exime. Nudes y metales quedan
  exentos, con test que verifica que un **camel del mismo hex sí cuenta**.
- **`mismoColorAOjo` no sirve para contar familias**, aunque lo parezca: trata
  a los acromáticos con benevolencia (`distanciaMatiz` devuelve 0 en cuanto uno
  tiene croma bajo, porque el ángulo de un gris es ruido) y hacía que "gris
  carbón + burdeos" contara como UNA familia.

### Added — la variante de ablación

`sin-coherencia-cromatica` entra a la banca del comparador. **Producción ya
lleva la regla, así que el retador es apagarla**: si apagarla gana, la regla
estorba y se revierte. Hay un test que verifica que el flag de verdad apaga la
regla y no sólo existe — una variante que declare un flag sin cablearlo mediría
dos veces lo mismo y empataría por accidente.

Aviso sobre el poder del instrumento: la regla dispara entre 0% y 18% por
usuario, así que en una corrida de 40 pares sólo 4-7 saldrán distintos. El
formato "veredicto" está hecho para cambios que tocan todos los looks; aquí la
señal vive sólo en los pares donde difieren, y así está escrita la regla
pre-registrada.

## [0.2.251.1] - 2026-08-17

### Fixed — el panel gritaba por historia, no por un bug

El dashboard llevaba días con "fit check → me lo puse · 13% llega" en rojo. No
había ningún bug: el fit check escribe `worn` perfecto (2 de 2 desde el arreglo
del 13 de agosto). Lo roto era el medidor.

**La causa:** `evaluarSenales` no sabía DESDE CUÁNDO existe el vínculo que
vigila. Comparaba conteos crudos en una ventana fija de 30 días, y esa ventana
llegaba hasta el 19 de julio. El fit check se volvió el escritor de `worn` el
2026-08-11 (ahí murió la card "¿te lo pusiste ayer?", su único escritor previo),
así que los 19 fit checks del 9 y 10 de agosto —que por diseño nunca escribieron
`worn`— entraban como fallos.

Los datos de producción, día por día: 9 ago 3/0 · 10 ago 16/0 · 13 ago 2/0 (el
bug real, arreglado ese mismo día) · 17 ago 2/2 ✅.

Se muerde la cola: el panel nació en el MISMO commit que aquel arreglo
(`3e3fada`), o sea que llevaba en rojo desde que nació, y habría seguido hasta
el 10 de septiembre.

**Por qué importa arreglarlo aunque no hubiera bug:** el panel existe para que
un fallo silencioso no viva semanas. Un rojo permanente entrena a ignorarlo, y
entonces el día que grite de verdad ya nadie lo mira. El docblock del propio
panel advertía del riesgo inverso ("un bloque permanente en verde entrena a
saltárselo") sin ver que el rojo es la misma trampa, peor.

**El arreglo:** cada par declara `desde`, la fecha en que su vínculo empezó a
existir; los disparos anteriores no cuentan. Y el veredicto ahora dice sobre qué
tramo se calculó ("desde el 11 ago"), porque un número que no dice qué periodo
midió es el que hace pensar que mide otra cosa.

La señal queda en 50% (2 de 4 desde el 11 ago), no en 100%: los dos fallos del
13 de agosto fueron fallos reales del vínculo y merecen contarse. Salen solos de
la ventana alrededor del 12 de septiembre.

### Fixed — la segunda señal comparaba peras con manzanas

"terminar onboarding → primer look · 46%" era la misma enfermedad con otra cara:
contaba **perfiles de toda la historia** (24) contra **eventos de 30 días** (11).
Medido con los dos lados en la misma ventana da **79%**.

Con eso se cae el hack de `minimo: 999` que existía para taparlo — y que además
no funcionaba: sólo silenciaba el veredicto "seca", así que el bloque seguía
saliendo en rojo como "floja".

Lo que la comparación honesta deja a la vista, y antes se escondía bajo el ruido:
3 personas terminaron onboarding sin que se les midiera el primer look.

## [0.2.251.0] - 2026-08-17

### Changed — el admin deja de ser una fiesta de 17 pestañas

Roberto: "el admin es un desmadre, hay unas que no sé qué hacen o cuál es la
diferencia entre unas y otras". Tenía razón y el problema no era solo el orden:
sobraban pantallas. El menú era una fila de 17 chips iguales sin agrupar, y
había tres pantallas muertas, dos pares casi idénticos y dos nombres que no
decían su ámbito.

**El menú queda en 12 entradas, en tres grupos por PARA QUÉ entras:**

- **Pulso** — Dashboard · IA · Usuarias · Acceso. Cómo va el experimento y
  quién lo usa; lo que se mira seguido.
- **Motor** — Comparador · Evales · Destilador · Recetas. El laboratorio de
  IA: decidir un cambio, vigilar el nivel, y curar lo que alimenta al motor.
- **Contenido** — Catálogo · Onboarding · Looks · Limpieza. Las prendas y
  looks que la app enseña.

### Removed — tres pantallas que ya habían contestado su pregunta

Barrido, A/B e Inspo nacieron la misma semana (4-5 de agosto) para responder
una pregunta puntual cada una, y las tres ya la contestaron — está escrito en
sus propios docblocks: el revisor automático marcaba el 94% y no discriminaba;
el recetario v28 quedó comparado; el selector no filtra por ocasión. Leían
JSONs congelados que nadie regeneró desde entonces (167 KB que además entraban
al bundle por import estático).

Se van con ellas los cinco scripts que solo existían para alimentarlas
(`ab-pares`, `ab-tryon`, `barrido-a-revision`, `barrido-tryon`,
`inspo-revision`). El arnés de medición en sí (`barrido-correr`,
`barrido-motor`, `barrido-comparar`) se queda: escribe a `docs_para_claude/` e
imprime su resumen, así que sigue en pie solo.

**Por qué borrar y no esconder:** una pantalla que lee datos congelados de hace
dos semanas parece información viva y no lo es. Ese es justo el tipo de mentira
silenciosa que costó dos bugs de semanas en agosto. El historial de git las
guarda, y la versión buena de A/B ya existe (el comparador, con datos en base y
proceso repetible).

### Changed — dos fusiones y un nombre honesto

- **Acceso** (`/admin/acceso`) se come Allowlist y Waitlist. Eran dos momentos
  del mismo embudo (pidieron entrar → invitadas → activas) y ya compartían la
  acción que las une: "Invitar" mete el correo a la allowlist y dispara el
  correo. Ahora es una pantalla con las dos listas.
- **Limpieza** (`/admin/limpieza`) se come Revisar y Repetidas, que quedan como
  pestañas "¿Existe?" y "¿Repetida?". Nacieron el mismo día, sobre la misma
  tabla, con la misma mecánica de una-decisión-a-la-vez y hasta el mismo
  párrafo de justificación. Solo cambiaba la pregunta.
- **Básicos se llama Onboarding** en el menú: dice lo que de verdad controla
  (qué prendas ve alguien nuevo) y deja de confundirse con Catálogo, que edita
  las mismas prendas pero para otra cosa.

### Added — el candado contra "el menú apunta a donde ya no está"

`lib/contrato-admin-nav.test.ts`, con el mismo patrón que
`contrato-wizard-rutas`: cada href del nav tiene que existir en disco con su
`page.tsx`, y cada sección en disco tiene que estar en el menú o declarar por
qué no (`ver-como` es una acción, no una pantalla). Un link muerto no truena
nada — se ve bien y da 404 al hacer clic — y esta reorganización movió seis
secciones de lugar, o sea seis oportunidades de dejar uno. Verificado por
mutación: al apuntar un link a una carpeta inexistente, el test se pone rojo.

## [0.2.250.1] - 2026-08-17

### Added — los tres trajes que faltaban

Los dos huecos que dejó abierta la pestaña "Trajes" el día que se shippeó,
cerrados el mismo día.

- **Traje negro de hombre.** Roberto lo pidió por nombre y no existía: el
  catálogo tenía marino, carbón, gris claro, arena, azul claro y esmoquin —
  y el esmoquin no lo sustituye (para un velorio, la app exige negro y
  prohíbe el esmoquin explícitamente). Con él, el onboarding de hombre queda
  con los tres que pidió: marino, gris y negro.
- **Dos trajes sastre de mujer** (negro y marino), y con esto la pestaña
  Trajes por fin le aparece a las usuarias: había once blazers de mujer y
  cero pares saco+pantalón. **Con corte de mujer, no un traje de hombre en
  otra talla** — solapa angosta, cintura entrada con pinzas, hombro estrecho,
  largo a la cadera, pantalón de tiro alto y caída fluida. El corte va
  descrito pieza por pieza en el prompt (en positivo y en negativo, porque el
  default del generador para "suit" es masculino) y los seis renders se
  revisaron uno por uno antes de sembrarlos.

## [0.2.250.0] - 2026-08-17

Tanda del recorrido de Roberto por el flujo desde cero: una feature (los
trajes se añaden como trajes) y seis fricciones que solo se ven probando.

### Added — el traje es UNA tarjeta, no dos piezas que hay que cazar

- Pestaña **Trajes** en el checklist del onboarding y en la biblioteca: un tap
  marca saco y pantalón juntos (siguen siendo dos prendas en el clóset — el
  saco se puede usar suelto). En el onboarding entran dos trajes completos
  (marino y gris carbón); antes solo estaba el saco carbón, sin su pantalón.
- El lazo `conjunto` ahora viene del catálogo y viaja hasta el motor: marcar
  tu traje ya no hacía que la regla de "traje desparejado" te lo prohibiera.
  Con backfill para las prendas que ya existían (4 en la base) — sin él, a
  esos clósets el motor les seguiría vetando su propio traje.
- La wishlist del traje guarda las dos piezas, revierte si el server falla, y
  un índice único blinda contra el doble tap que duplicaba filas.

### Changed

- **"Cómo te queda"** (pares de corte): la foto se acerca a la zona que cambia
  (pantalón / parte de arriba) y una pista dice dónde mirar — antes la
  diferencia eran unos píxeles en una foto de cuerpo entero.
- **"Tu primer look"** (onboarding): fuera la rejilla de ocasiones bloqueadas
  que referenciaba un layout que ya no existe; la pantalla dice lo que va a
  pasar en vez de fingir que se elige.
- **"¿Dónde?"** del wizard: la opción preseleccionada arranca sola (ya no hay
  que volver a picarle para que pida la ubicación) y la app dice QUÉ ciudad
  detectó — en la card ("listo — estás en Querétaro") y en el clima. Las
  coordenadas viajan redondeadas a ~1 km: para nombrar la ciudad no hace
  falta el punto exacto.
- **"¿Cuánto mides?"**: ahora es una card visible ANTES de la retícula de
  siluetas — con el CTA sticky se podía avanzar sin haberla visto nunca.
- **Home**: el checklist de "qué sigue" fluye tras las cards en vez de vivir
  encajonado contra la tab bar; el hint del fit check dice en concreto qué
  ganas (opinión + tus prendas se cargan solas).
- **Camisa de lino** del onboarding: la beige lavada se retiró del catálogo
  (borrado suave — las 5 prendas de usuarios que la referencian siguen
  intactas) y entra la blanca en su lugar.

### Fixed

- **El crop del avatar por fin se VE aplicado**: el recorte siempre funcionó,
  pero el preview pintaba el recuadro decorativo y la viñeta encima de
  cualquier foto — recortada o no — y re-cortaba el recorte para llenar la
  caja. Ahora el recorte se muestra entero, sin marco, con "recortada — así
  la uso".
- **Thumbnails del último look**: con 3 prendas la celda era el doble de ancha
  que alta y decapitaba la prenda (~40% de recorte); la tira crece con pocas
  prendas y el recorte baja a ~15%. El diseño original se validó con 5.
- Una llegada tardía de la ubicación ya no borra el pronóstico recién
  resuelto en el wizard.

## [0.2.249.10] - 2026-08-17

### Fixed — el "pantalón de vestir gris" ya no enseña el traje completo

Alberto: *"la prenda de 'pantalón de vestir gris' debería ser solo pantalón
pero la imagen muestra todo el conjunto con saco, eso saca de onda"*. Tenía
razón, y el culpable no era su prenda: era la **imagen del catálogo** que su
prenda tomó prestada.

El arquetipo "Pantalón de traje gris claro" (categoría `bottom`) se generó en
julio con el saco puesto encima. Sus cinco hermanos —carbón, marino, arena,
azul claro, smoking— están bien: es un defecto aislado, de antes de que el
prompt de arquetipos prohibiera explícitamente las prendas extra (agosto).
Regenerada con ese prompt, ahora es lo que su nombre promete.

Lo que hizo falta para encontrarlo fue el screenshot: la prenda de Alberto no
tenía render propio, así que buscar por su nombre no llevaba a ninguna imagen
defectuosa — la pista estaba en `attrs.image_path`, la imagen prestada.

## [0.2.249.9] - 2026-08-17

### Added — 25 prendas reales entran a la biblioteca

Primera cosecha del principio nuevo (spec: `docs/designs/corpus-de-prendas.md`):
las prendas renderizadas son un activo que sobrevive a las cuentas. Antes de
borrar las cuentas de prueba de Roberto se rescataron sus renders únicos —
flat-lays ya dibujados por el pipeline de la casa — y entran a la biblioteca
con el visto bueno dado.

- 22 de hombre (blazer marrón, botas de senderismo, gafas, bufanda vino,
  camisa de lino esmeralda, el jersey de México…) y 3 de mujer (vestido de
  gala negro, guantes largos, tacones).
- Curadas contra duplicados DOS veces: 8 fuera por nombre exacto contra los
  408 arquetipos, 2 más por concepto (ya había 6 pantalones marinos y una
  camiseta blanca), y las copias internas (la sandalia ×5) a una.
- Nombres genéricos sin marca (regla Carla): "Botas de senderismo negras",
  sin el Columbia.

## [0.2.249.8] - 2026-08-17

### Fixed — segunda tanda de botones que se escondían bajo el scroll

La primera tanda (v0.2.249.4) cubrió espejo, viaje y cápsula. Esta cierra lo
que la auditoría dejó radareado:

- **Wizard de avatar** (los 4 pasos): "empezar", "sí, soy yo — sigamos",
  "siguiente / generar mi avatar" y "quedó, usar este" van sticky al fondo —
  la retícula de siluetas y el retrato a ancho completo los empujaban fuera.
- **Onboarding**: "seguir" de edad (se perdía con el bloque de permiso
  parental abierto), "encontrar mis colores" de colorimetría, y el CTA del
  reveal de tu estilo en los gustos.
- **Silueta**: "Cambiar / Listo" sticky sobre la tab bar, como el resto.

Con esto, todos los flujos móviles de la app tienen su botón de avance
siempre a la vista.

## [0.2.249.7] - 2026-08-17

### Changed — el probador agrupa tus prendas por categoría

Alberto: *"en la vista de 'pruébate un look' las prendas deberían estar
agrupadas por top, bottom, shoes — ahorita están mezcladas"*. Con 40+ prendas,
armar "top + pantalón + zapatos" era pescar en una sopa.

El picker del probador ahora agrupa el clóset por categoría en el orden del
vocabulario de la casa (top, saco, pantalón, abrigo, vestido, calzado,
accesorio); lo que la visión no reconoció va al final como "lo demás" — nunca
desaparece una prenda por un dato faltante. Aplica en el probador del clóset
y en el de la wishlist.

## [0.2.249.6] - 2026-08-17

### Added — puerta de salida del tinder de estilos a las 12 cartas

Alberto: *"25 opciones para el tinder inicial de estilo lo sentí repetitivo…
permitir skippear después de 10 selecciones"*. Tenía el número casi exacto: el
mazo creció de los ~15 del spec a 27 estilos y nadie ajustó la experiencia —
mientras el TTV ya falla la promesa de los 2 minutos por 4-5×.

Tras 12 decisiones aparece un link discreto ("con estas ya te leo — seguir")
que corta al reveal del estilo con lo swipeado hasta ahí. Doce no es al azar:
el orden del mazo reparte por familias en round-robin, así que a esa altura ya
pasaron todas las familias al menos dos veces — la señal se adelgaza, no se
sesga. Quien está a gusto barajando puede seguir hasta el final, como siempre.

## [0.2.249.5] - 2026-08-17

### Fixed — la app ya no se queda muda cuando trabaja

Dos silencios reportados por Alberto, mismo diagnóstico: la app tiene un
lenguaje rico para "estoy generando" y no lo usaba en dos esperas reales.

- **Guardar el avatar ("¿Quedó?")**: al tocar "quedó, usar este" podían pasar
  15-45 segundos mudos — el guardado espera el sheet de 3 vistas en vuelo, sube
  3 imágenes y toca la base dos veces, y lo único que cambiaba era la etiqueta
  del botón. Ahora tapa la pantalla el GeneratingScreen de la casa, con su
  aviso de "quédate en la app" a los 8s.
- **La foto del look en el diario**: la imagen tardaba ~7s en bajar y el tile
  quedaba en blanco sin señal. Ahora: fondo + spinner mientras baja, y el
  blur-up de la casa al llegar — disparado por la carga real, no por reloj
  (la animación vieja corría y se gastaba antes de que hubiera imagen).

## [0.2.249.4] - 2026-08-17

### Fixed — los botones de avanzar ya no se entierran bajo el scroll

Alberto reportó la clase entera: *"en general hay que cuidar que los botones
para guardar o avanzar no se oculten debajo del scroll de la pantalla"* — y la
señaló en el espejo ("Terminar aquí" de las fichas) y en toda la maleta.

Una auditoría de los flujos móviles encontró 23 pantallas con el CTA como
último elemento del scroll. Esta tanda arregla las reportadas y sus gemelas:

- **Espejo (te veo)**: "terminar aquí" / "gracias" / "vi N prendas que no
  tienes" y los botones de "sale alguien más" viven ahora en el pie fijo de la
  pantalla, fuera del scroll. La ranura `pie` existía desde el rediseño del
  espejo — nadie la había conectado.
- **Viaje**: "revisar prendas →", "listo — a empacar" y "generar mis looks"
  van sticky sobre la tab bar (mismo patrón que el detalle del historial).
- **Cápsula** (gemela declarada del viaje): "revisar esenciales →" igual.

Quedan radareadas para una segunda tanda: los pasos del wizard de avatar y
tres pantallas de onboarding (edad, colorimetría, reveal de gustos).

## [0.2.249.3] - 2026-08-17

### Fixed — "ajustar" la foto del avatar ya no acumula zoom

Alberto: *"si doy click a ajustar y posiciono la cuadrícula, al guardar y
volver al paso anterior, el preview de la imagen que ajusté se acerca una y
otra vez aunque el ajuste haya sido hacia afuera"*.

El diagnóstico exacto: cada "ajustar" abría el recortador sobre la imagen **ya
recortada** de la vez anterior — recortar el recorte solo puede acercar, nunca
abrir, porque los pixeles de afuera ya se habían tirado. Ahora el wizard
guarda la foto original aparte y "ajustar" siempre recorta sobre ella: puedes
abrir y cerrar el encuadre las veces que quieras sin perder nada.

## [0.2.249.2] - 2026-08-17

### Fixed — el sheet de "¿a dónde vas?" ya no te deja atorado con el teclado

Alberto: *"el teclado sube la pantalla para seleccionar en el calendario pero
se pierde el primer campo que es la ciudad y no permite avanzar si no se ha
llenado ese campo"*.

Dos arreglos en el mismo sheet:

- **Tocar el calendario cierra el teclado.** Antes el campo de ciudad (con
  autofocus) dejaba el teclado abierto, el sheet quedaba a media altura y
  elegías fechas a ciegas mientras la ciudad se perdía en el scroll.
- **El botón muerto ahora explica y lleva.** Con fechas puestas pero sin
  ciudad, "añadir a mi ruta" se quedaba deshabilitado sin decir por qué.
  Ahora avisa "solo falta la ciudad" y al tocarlo te regresa al campo y lo
  enfoca.

## [0.2.249.1] - 2026-08-17

### Fixed — "así te queda" ya enseña el look completo, pies incluidos

Alberto (feedback de UX, probando el flujo completo): *"al entrar a la pantalla
de 'así te queda' se está cortando los pies de la imagen y no hay forma de
hacer zoom"*.

Tenía razón dos veces:

- **Las dos pantallas de ampliar** (la lupa del detalle y el "ampliar" del
  try-on inmersivo) usaban `object-cover` anclado a la cara — los zapatos
  morían fuera del marco. Para una app cuya promesa es "así te queda el look",
  cortar los zapatos es cortar el look. Ahora la foto va **completa**
  (`object-contain`) sobre la misma foto blurreada de fondo — el patrón que el
  try-on de desktop ya tenía validado.
- **El hint "pellizca para acercar" mentía**: el zoom de la PWA está apagado
  a propósito desde el fix del zoom accidental (#14), así que ese pellizco
  nunca funcionó. El hint ya no promete lo que la app no hace.

## [0.2.249.0] - 2026-08-17

### Fixed — la ciudad del wizard ya se autocompleta, como en el viaje

Roberto: *"en la parte de otra ciudad no tenemos el autocomplete, igual que lo
tenemos en el de viaje, lo cual hace que esté raro"*.

Eran **dos experiencias distintas para la misma pregunta, contra la misma API**:
el viaje sugería solo mientras escribías; el wizard pedía el nombre completo, un
botón "buscar", y si no acertabas devolvía *"no encontré esa ciudad — inténtalo
con el nombre completo"*.

El hook del viaje sale a `lib/place-suggestions.ts` y ahora lo usan los dos. El
viaje no cambia de comportamiento. Mismo patrón que ya costó caro con el
vocabulario de prendas duplicado: la copia peor es la que la gente ve.

**Y se cazaron dos defectos MIDIENDO en el navegador, no mirando el código:**

- **La lista nacía fuera de la vista.** Con el paso "cuándo" completo, las cinco
  sugerencias caían entre y=616 y y=841 dentro de un contenedor que termina en
  650 — aparecían y no las veía nadie. La que Roberto buscaba (Tequisquiapan)
  era la tercera. Se arregla trayéndolas a la vista al aparecer.
- **`behavior: "smooth"` hacía que el scroll NO ocurriera.** Medido: con smooth,
  `scrollTop` se quedaba en 0 indefinidamente; sin él saltaba a 205 al instante.
  El salto seco además es mejor aquí — la lista queda usable de inmediato en vez
  de pedirte esperar una animación para tocarla.

Verificado en el navegador con el clóset real: las 5 sugerencias visibles y
tocables por encima del CTA.

## [0.2.248.1] - 2026-08-17

### Fixed — "de día / de noche" ya no viene mal marcado la mitad de las veces

El default estaba fijo: `useState<"dia" | "noche">("dia")`, sin mirar el reloj.
Medido sobre los 231 looks de la base: **117 (51%) se generaron entre las 7pm y
las 5am**, con la opción equivocada pre-seleccionada en todos.

Es el peor tipo de error de default — **nadie revisa lo que ya viene
palomeado**, así que se pedía un look de noche y salía uno de día sin que nada
tronara.

- **El umbral no es nuevo**: 19h/6h es el que el espejo ya usaba desde siempre,
  escrito en línea. Ahora vive en un solo lugar (`momentoSugerido`) y las dos
  puertas contestan igual.
- **NO se reusó el 6h-18h de `lib/registro.ts`**: aquél contesta otra pregunta
  —si es horario de oficina— y unificarlos haría que las 6pm se leyeran como
  noche, que en México es de día.
- **Eligiendo otro día arranca en "día"**: a las 9pm planeando mañana, el reloj
  de hoy no dice nada útil. Y si la persona ya tocó la opción a mano, deja de
  re-sugerirse — cambiarle la elección bajo los pies sería peor que el default
  equivocado.

## [0.2.248.0] - 2026-08-17

### Added — "traje completo" también en la app, no sólo en el comparador

Roberto lo aclaró: el indicador no era para evaluar el motor, era para el
usuario. *"Es para identificar visualmente que si el AI propone un traje
completo, tipo para un abogado, sí está haciendo el match correcto y no lo está
haciendo parchado."*

Ahora, cuando el look trae un traje de verdad —dos o más piezas del MISMO
traje—, sobre las prendas aparece **traje completo**.

- **Sólo se pinta la confirmación, nunca el aviso de parchado.** En la app no
  estás evaluando el motor, estás por vestirte: un cartel que diga "esto está
  mal" sin nada que puedas hacer con él sólo quita confianza. El caso malo lo
  ataja antes la regla `saco-de-traje-suelto` (v0.2.242.0), y el comparador —que
  sí es para evaluar— sigue enseñando las tres respuestas.
- **El dato viaja por los cuatro caminos que pintan un look**: `/hoy`, el look
  del día, la generación en vivo y el historial. Hacer sólo uno habría dejado el
  mismo look con aviso en una pantalla y sin él en otra.
- **`veredictoDeTraje` se mudó a `lib/traje.ts`.** Vivía en el comparador, e
  importarlo desde un componente de usuario arrastraba al bundle las variantes,
  el catálogo de modelos y la tabla de precios. Es vocabulario del dominio (qué
  es un traje), no del banco de pruebas.

## [0.2.247.2] - 2026-08-17

### Changed — el indicador de traje ahora contesta la pregunta del look, no de la prenda

Roberto aclaró para qué era: *"esto es para identificar visualmente que si el AI
propone un traje completo, tipo para un abogado, sí está haciendo el match
correcto y no lo está haciendo parchado"*. Esa pregunta es **del look**, y la
versión anterior ponía una etiqueta en cada prenda — obligaba a leer dos y
deducir.

Ahora, una sola línea sobre las prendas: **traje completo**, **traje parchado**
(saco y pantalón de trajes distintos) o **"X sin su par"**.

**Y corrige una afirmación falsa.** La v1 etiquetaba "de otro traje" a un saco
que iba con chinos — pero los chinos pueden ser perfectamente correctos; lo que
pasa es que a ESE saco le falta el suyo. Decirlo mal no era un matiz: afirmaba
algo que no era cierto.

No necesita saber qué es saco y qué es pantalón: le basta con cuántas piezas del
look vienen de un traje y si vienen del mismo.

## [0.2.247.1] - 2026-08-17

### Added — al votar se ve qué prenda machea con cuál

Lo pidió Roberto votando el veredicto de Gemini 3.7, y era el último pendiente de
esa corrida: *"debería haber algún tipo de indicador visual para saber qué machea
el pantalón con el saco, porque si no está cabrón, no puedo saber si sí o no
va"*. Tenía razón — en ese par había un saco de un traje con el pantalón de OTRO,
y en pantalla los dos grises se veían plausibles.

Cada prenda que viene de un traje ahora dice **"mismo traje"** (su pareja está en
el look) o **"de otro traje"** (no está). La pregunta que contesta no es "¿esta
prenda viene de un traje?" sino "¿su pareja está aquí?", así que se resuelve
mirando el look entero — la decisión vive en `lazoDeTraje`, con tests.

## [0.2.247.0] - 2026-08-17

### Fixed — lino de arriba abajo no es ropa de oficina

Roberto lo marcó en dos pares del veredicto de Gemini 3.7, los dos con signos de
admiración: *"Full lino para trabajo no está bien! Full lino es más para eventos,
playa, etc."* y *"full lino en trabajo está mal!"*.

**El alcance lo fija su otra frase**: *"el look está cool, pero te fuiste FULL
lino"*. El problema no es el lino, es el lino en todo — así que la regla cuenta
prendas estructurales (torso, pierna, capa) y pide DOS. Una camisa de lino sola
es correcta en una oficina de calor, y marcarla sería prohibir el lino, que no es
lo que dijo.

- **No es formalidad, es contexto.** El look puede estar impecable de nivel y
  seguir leyéndose como vacaciones; por eso hizo falta pasarle el objetivo a las
  reglas de ejecución y no bastaba con `formality`.
- Fuera de la oficina no se toca: él mismo dijo que el lino completo es para
  eventos y playa.
- Accesorios y calzado no cuentan para el conteo.

Verificada contra los 107 looks de la corrida: dispara en 6, **todos dentro de
los dos briefs de "trabajo · calor"**. Los cuatro que Roberto no alcanzó a
comentar se revisaron uno por uno — camisa de lino con pantalón de lino en todos.

### Nota — un pendiente que no existía

Se había anotado como suelto el *"se ve parchado, distintos tipos de gris entre
el saco y el pantalón"*. No lo era: el saco es de un traje y el pantalón de
OTRO, así que `saco-de-traje-suelto` (v0.2.242.0) ya lo caza, y
`funeral-corbata-color` (v0.2.245.0) caza la otra mitad de ese mismo comentario.

## [0.2.246.0] - 2026-08-14

### Added — con lluvia, el calzado escotado pierde contra el que cubre el tobillo

Última regla salida del veredicto de Gemini 3.7, y la que más costó acertar: dos
propuestas anteriores se descartaron por medirlas antes de escribirlas.

**Es preferencia, no prohibición**, y eso lo decidió releer los comentarios
completos. En el MISMO par Roberto escribió las dos cosas: *"Gana por el
calzado"* (sobre unos botines Chelsea) y *"calzado no ideal para lluvia"* (sobre
unos tenis). Eso es un ORDEN, no un veto — ninguna prohibición encajaba con sus
dos frases a la vez.

- **El eje es el tobillo, no la suela.** Se leyeron 161 zapatos para conseguir el
  dato de la suela y no servía: sus tenis de piel (que marcó mal) y sus tenis
  blancos (que aprobó *"por la suela gruesa"*) salieron los dos `gruesa`, con
  ~12% de ruido. El tobillo sí es observable y sí es el mecanismo que él
  describió: el agua entra por arriba.
- **El guardia de formalidad no es un parche, es la regla**: no se baja el nivel
  del look para resolver el clima. Sin él —simulado contra su clóset ANTES de
  escribir nada— la regla hacía reprobar todos los zapatos de vestir bajo
  lluvia, y en un evento formal habría bloqueado el único calzado correcto.
- **La alternativa también tiene que aguantar el agua**: cambiar unos tenis por
  unos botines de gamuza sería reparar hacia atrás.
- Generaliza con un principio la lista fija de tres formas (`mocasín, náutico,
  sandalia`) que estaba escrita a mano.

**Lo que se acepta a sabiendas**: marca también unos tenis que Roberto aprobó. No
existe dato que separe esos dos pares, y el costo es cero — la reparación pone
justo las botas que él llamó ganadoras.

Verificada contra los 107 looks de la corrida: dispara en 4 (3.7%), todos dentro
de los pares de lluvia.

## [0.2.245.0] - 2026-08-14

### Fixed — nada de etiqueta en un funeral, y la corbata negra

El motor sacó un **esmoquin** para un funeral en el veredicto de Gemini 3.7.
Roberto lo calificó con una palabra: *"terrible"*. Más una corbata de color en el
mismo look — *"tendría que ser negra"* — y una gris en el siguiente.

**La ironía es la parte que importa**: el catálogo YA gritaba *"EL COLOR ES
NEGRO — el AZUL MARINO NO"*, y la prenda más negra y más formal de ese clóset
era justamente el esmoquin. **La regla del color empujó hacia el error.** Que
algo sea negro no lo vuelve luto: la etiqueta es ropa de celebración.

- Va como **regla comprobable en código**, no como otra línea de prompt: las dos
  condiciones son verificables (¿hay una prenda de etiqueta?, ¿el hex de la
  corbata es negro?) y una línea de prompt se puede ignorar — ésta la repara el
  juez.
- **La corbata se juzga en OKLCH** (oscura Y sin color). En RGB un vino y un
  carbón oscuros se parecen, y aquí esa es exactamente la diferencia que
  importa. Sin hex declarado no se marca nada.
- El tipo de evento ahora llega a las reglas de ejecución: la formalidad sola no
  distinguía un funeral de una boda, y el esmoquin es correcto en una y una
  falta de respeto en la otra. En una boda de gala nada de esto aplica.

Verificado contra el par real de la corrida: marca los 3 looks que Roberto
señaló y deja limpio el cuarto — que es justo el que votó ganador.

## [0.2.244.0] - 2026-08-14

### Fixed — el generador de imágenes nunca supo si una prenda era lisa o estampada

Cuatro comentarios del veredicto de Gemini 3.7 no eran sobre el look sino sobre
**la imagen mintiendo**: *"los pantalones se renderían como con cuadros y no son
así"*, *"se renderió también como el pocket square"*, *"está engañoso"*.

Al abrir las imágenes se vio que el try-on no inventaba nada: **copiaba
fielmente un render del clóset que ya estaba mal**. El pantalón gris —`patron:
liso` en la base— estaba dibujado con príncipe de Gales, y el saco de traje con
un pañuelo de bolsillo que nadie pidió.

La causa: el tipo que arma la descripción para el generador de imágenes llevaba
nombre, color, categoría, formalidad, temporada, largo, corte y manga — **pero
no el patrón ni el material**. Al pedir "pantalón de vestir gris, formal" sin
más, el modelo rellenaba con lo más fotogénico para esa frase.

- **El patrón viaja, y en los dos sentidos.** Decir "liso" no es redundante: es
  la única forma de que el modelo NO invente un estampado. El silencio no se lee
  como "sin patrón", se lee como "tú decides". Sin patrón declarado no se
  afirma nada — las 447 prendas sin ese dato no empiezan a decir "liso" por
  nuestra cuenta.
- **El material también** ("lana fría" y "lino" no se dibujan igual).
- **Fuera el `slightly styled` del prompt**, que era la puerta abierta al
  estilismo que nadie pidió, y las prohibiciones ahora nombran lo que de verdad
  se colaba: pañuelos de bolsillo, accesorios y patrones inventados. El
  "no props, no labels" que había no cubría ninguno de los dos.

**Escala del bug**: 609 prendas están marcadas `liso` y 326 de ellas tienen
render generado — todas dibujadas sin que nadie dijera "sin estampado". Las 41
con patrón real tampoco se lo dijeron.

Verificado regenerando las dos prendas del caso: el pantalón sale liso y el saco
sin pañuelo. **Los renders viejos NO se regeneraron** — eso es una decisión
aparte, con su costo.

## [0.2.243.0] - 2026-08-14

### Fixed — el cuello alto de punto también pide algo debajo

Segunda regla salida de los comentarios del veredicto de Gemini 3.7. Roberto lo
anotó **tres veces, en pares distintos y votando a ciegas**, que es la evidencia
más limpia que este proyecto puede producir sobre un gusto.

**Corrige una decisión anterior escrita a propósito.** La regla del suéter
excluía el cuello alto con este argumento: *"es cerrado y se lleva a piel por
diseño"*. El argumento vale para un cuello alto delgado y no para uno de punto,
y lo fija la tercera frase de Roberto: *"falta algo abajo del cuello de tortuga,
**sobre todo porque es un suéter**"*.

- **Sólo los de punto.** Un cuello alto fino de algodón sí está diseñado para ir
  a piel y se queda fuera. Era la opción que Roberto eligió entre las tres que
  se le plantearon.
- **La base no puede ser otro cuello alto**, a diferencia de la regla del
  suéter: lo que se pide es lo que va DEBAJO del cuello alto mismo. El cuello
  alto sigue valiendo como base bajo un suéter de pico — esa regla no cambió, y
  hay un test que lo fija.
- Como la regla del suéter, **sólo aplica al guardarropa masculino**: llevar el
  punto a piel es una elección normal en el femenino.

Verificada contra los 107 looks reales de la corrida: dispara en 8 (7.5%),
incluidos los tres que Roberto marcó a mano, y los cinco restantes se revisaron
uno por uno — todos son cuello tortuga de lana merino sin base.

## [0.2.242.0] - 2026-08-14

### Added — el saco de traje va con su pantalón, o no va

La primera regla que sale de los COMENTARIOS del veredicto de Gemini 3.7, no de
sus votos. Roberto lo anotó en cuatro pares distintos y pidió que fuera regla
con esas palabras: *"no podemos poner los sacos de traje así como por sí solos,
o tienen que ir con su par. Eso es una regla."* Y el diagnóstico de por qué se
ve mal: *"se ve parchado"*.

La regla `traje-desparejado` que ya existía **no lo cubría**: aquella sólo
dispara cuando saco y pantalón son del mismo color (dos piezas fingiendo ser un
traje). Ésta es al revés y más fuerte — un saco de traje con *cualquier*
pantalón que no sea el suyo.

- **La asimetría es deliberada**: el pantalón de traje suelto **sí** se puede
  usar. Sólo el saco queda atado a su par. Un test lo fija.
- **Dos señales para distinguir saco de traje de blazer**: el lazo `conjunto`
  que la persona pone al dar de alta un traje (señal dura, cero falsos
  positivos) y el nombre/subtipo. La segunda hace falta porque la primera casi
  no existe todavía: 6 prendas con `conjunto` en toda la base contra 46 sacos
  sin él. Sin ella la regla nacería correcta e inerte para 17 de 18 personas.
- **Lo que NO se marca**: blazer, saco desestructurado, saco sport y los de
  patrón (cuadros, pata de gallo, príncipe de Gales) se llevan sueltos por
  diseño. Prohibir una combinación correcta es el error caro.

**Verificada contra los 107 looks reales de la corrida**, no sólo con tests
inventados: dispara en 6 (5.6%), y los 6 son exactamente los que Roberto marcó
a mano. Esa verificación cazó dos bugs que los tests no habían visto — el
pantalón del traje entraba como saco (rompiendo la asimetría) y **"chaqueta"
hacía match dentro del patrón de "chaqué"**, marcando chamarras normales.

## [0.2.241.2] - 2026-08-14

### Changed — Gemini 3.7 Flash retó al motor y perdió: se queda 3.5

Veredicto de 20 pares ciegos, con la regla escrita antes del primer voto, mismo
prompt (v52), mismo clóset y mismo juez:

| | |
|---|---|
| preferencia | Producción **9** · 3.7 **4** · 7 empates (p = 0.267) |
| costo | $0.1954 → $0.1900 por generación (**−2.7%**) |
| latencia | 27.2s → 27.1s (empate) |

**El argumento entero del cambio era el precio, y se desinfló al medirlo.** La
lista decía −58% de salida; lo medido fue **−2.7%**. La causa está en la forma
del pipeline, no en el modelo: **la mitad del costo de cada generación son las
tres llamadas del juez**, que no cambian al cambiar el generador. Es la lección
que se lleva a la próxima: abaratar el generador abarata poco.

Con p = 0.267 la lectura honesta es que los dos modelos cuestan trabajo de
distinguir — lo confirman el 35% de empates y que uno de los dos espejos salió
inconsistente. Pero 3.7 nunca estuvo adelante y la regla pedía empatar o
mejorar. Queda escrito en `lib/models.ts` con sus números, para que el próximo
lanzamiento no se decida de oído.

No se probó contra la visión ni contra la cápsula/viaje: extrapolar de aquí
sería justo el error que ese archivo advierte.

## [0.2.241.1] - 2026-08-14

### Added — Gemini 3.7 Flash entra al comparador como retador

Google lo lanzó hoy. **No cambia nada de producción**: el motor sigue armando
outfits con 3.5 Flash. Lo único nuevo es una opción más en la pantalla de
admin, para poder decidir midiendo en vez de de oído — que es la regla escrita
en `lib/models.ts`.

Lo que el anuncio promete (ingeniería de software, flujos agénticos, fidelidad
a mockups) **no es lo que este motor hace**, así que no cuenta como evidencia.
Lo que sí es verificable es el precio: **$0.75/$3.75 por millón contra
$1.50/$9 de 3.5** — la mitad de entrada y 2.4× menos de salida.

- Precio **introductorio hasta el 31 de diciembre de 2026**, anotado en
  `lib/proveedores/precios.ts`. Si 3.7 gana por costo, esa fecha es parte de la
  decisión: en enero hay que volver a la tabla o el panel de IA reportará de
  menos.
- **Pasó el smoke antes de entrar** (3 looks, 21s, $0.19): no rechaza el schema
  del motor. No era trámite — Haiku 4.5 está fuera del comparador justamente
  porque su compilador no traga el enum de UUIDs del clóset, y se cazó así.
- Se verificó contra la API de Google qué modelos existen de verdad, en vez de
  confiar en el nombre del anuncio: están `gemini-3.6-flash` (ya estaba en el
  catálogo, nunca probado) y `gemini-3.7-flash`.

Decidir cuesta $9.50 (20 pares, veredicto). La comparación se vota a ciegas y
con la regla escrita ANTES del primer par.

## [0.2.241.0] - 2026-08-14

### Fixed — lo que escribes en "¿algo en mente?" ya cuenta como una ocasión

Roberto pidió un look para un fin de semana en un viñedo y salió con **polo,
lino y mocasines de suela lisa**: country club, no viñedo mexicano. La causa no
era el modelo — el motor entendió la palabra, escribió *"una tarde de viñedo"* y
eligió lino. Lo que le faltaba era todo lo demás.

**El campo libre mandaba `objective: "diario"`.** Un fin de semana en el campo
llegaba al motor como *un día normal en el que además se mencionó un viñedo*,
con una sola línea de andamiaje. Mientras tanto, elegir un chip ("una boda")
traía piso de formalidad, el perfil de la ocasión —dónde te sientas, cuánto
caminas, si hay fotos— y hasta el contexto cultural mexicano que el prompt ya
tenía escrito. El texto libre era ciudadano de segunda.

Y ahí es justo donde aparecen las necesidades no cubiertas: **el campo libre se
ha usado tres veces en toda la historia del producto, y las tres son casos que
la rejilla de chips no tiene** — dos viñedos y un día de gym. Los 8 chips son
todos urbanos y sociales.

- **`lib/ocasiones.ts`**: cuatro perfiles que se infieren de lo que escribiste —
  campo (viñedo, rancho, hacienda), naturaleza, playa/alberca y ejercicio. **La
  rejilla no crece**: no es un chip nuevo, no hay nada más que elegir.
- **Los perfiles describen la SITUACIÓN, nunca el atuendo**, y hay un test que
  falla si alguien escribe una prenda dentro de uno. "Se camina sobre grava y
  refresca al atardecer" es un hecho del lugar; "ponte guayabera y sombrero"
  sería el estereotipo de quien lo escribe — y en este proyecto ya se colaron
  tres veces reglas de vestimenta con un default equivocado. Funciona mejor
  además: de "suela lisa sobre grava" el motor deduce el calzado **con el clóset
  y el gusto de esa persona delante**, que es información que el catálogo no
  tiene.
- **El chip elegido a mano siempre le gana** al perfil inferido.
- Lo que no se reconoce sigue viajando tal cual: nada se bloquea, nada se
  reescribe.

Medido con el motor real sobre el clóset de 160 prendas y el mismo plan: dos de
los tres looks pasaron a **botines que pisan tierra**, citando el frío del
atardecer y las fotos. El tercero todavía saca mocasines — es una corrida, no
una medición, y el instrumento para dictaminar sigue siendo el comparador con
corrida pareada.

Prompt a v52.

## [0.2.240.0] - 2026-08-14

### Removed — una sola puerta para subir fotos de ropa

Había dos que hacían lo mismo: "una prenda" (una foto → una prenda) y "varias de
golpe". La primera era la misma función peor hecha — **no generaba el render
limpio**, así que dejaba en el clóset la foto cruda del usuario mientras que la
otra devuelve el flat-lay de catálogo.

Producía **7 prendas de 1066** en toda la vida del producto. Y el propio código
ya delataba cuál sobraba: cuando la visión detectaba más de una prenda en la
foto, esa pantalla ofrecía un botón para pasarle la misma foto a la puerta de al
lado. Una escotilla de escape que existía porque la puerta estaba mal.

Dos puertas que hacen lo mismo son fricción por sí solas: obligan a elegir, y la
fricción de catalogar es el enemigo declarado del proyecto. El menú pasa de tres
opciones a dos.

- **La puerta que queda ya no pide un ritual.** Decía "varias de golpe — vacía el
  clóset en la cama"; siendo la única, tiene que recibir igual de bien a quien
  trae unos tenis sueltos. Ahora: *"tus fotos — tómale foto a tu ropa, una o
  muchas, saco cada prenda que vea"*.
- **Se fue la tercera copia del vocabulario de prendas.** Vivía en el archivo
  borrado; `TODOS.md` la tenía anotada como deuda. Hoy solo existe en
  `components/prenda-campos.tsx`.
- **Las 7 prendas que habían entrado por ahí ya tienen su render limpio**,
  generado desde su foto original (imagen→imagen, el mismo motor del carrete).
  Cuatro eran de usuarias reales — entre ellas el corsé de encaje de Andy.

## [0.2.239.0] - 2026-08-14

### Added — el correo que rescata a las 48 horas, no a los siete días

Las tres usuarias reales duran entre 1 y 3 días. Andy hizo **todo** bien —78
prendas, 22 con foto propia, avatar, esenciales, 8 looks y 3 con 👍, primer look
en 9 minutos— y no volvió. Eso descarta que el problema sea el onboarding o la
calidad del primer look: no había nada que la llamara de vuelta al día
siguiente.

El correo semanal existía y ella tenía opt-in, pero **nunca lo recibió**: se dio
de alta el lunes 10 después del envío, se fue el 12, y su primer correo habría
llegado el 17. La gente se apaga a los 2-3 días y el rescate llegaba a los 7.

- **Cron diario a las 01:00 UTC** (7pm de CDMX), que es cuando uno piensa "¿qué
  me pongo mañana?". Una ventana de 48h no se pilla corriendo una vez por
  semana — ése es exactamente el bug.
- **Ventana, no umbral: de 48h a 7 días.** Sin techo, la primera corrida le
  escribe "hace poco estuviste aquí" a quien se fue hace dos meses, y ese correo
  miente. Quien lleva más de una semana fuera necesita un win-back, que es otro
  correo con otro texto.
- **Una sola vez por persona, para siempre** (columna propia
  `email_reenganche_sent_at`, que no toca la idempotencia del semanal). Es un
  empujón, no una campaña: si un correo no la trajo de vuelta, el segundo
  tampoco.
- **Va personalizado con su propio look.** «Corsé Rebelde de Noche, el que te
  gustó hace 3 días» es imposible de confundir con publicidad, porque nadie más
  pudo haberlo escrito. Con escalera de respaldos, porque solo 5 de las 13
  personas con opt-in tienen algún 👍: look con 👍 → último look → clóset.
- **Nunca usa un look que la persona rechazó con 👎.** Islam se fue justo
  después de dar uno; recordarle precisamente ese look sería decirle "vuelve por
  lo que no te gustó".
- **Modo ensayo** (`?ensayo=1`): calcula a quién le tocaría, con qué gancho y
  qué asunto, sin mandar ni escribir nada. Mandar correos es irreversible; la
  lista se revisa antes, no después.

El fit check va como nota al pie y no como botón: pedirlo de frente es el mismo
favor que ya mató a la card "¿te lo pusiste ayer?".

### Changed — un solo membrete para todos los correos

El wordmark, los font stacks, la paleta y el pie de baja vivían dibujados a mano
dentro del correo semanal. Al nacer el segundo correo tocaba copiarlos, y una
copia de marca es una copia que se despega. Ahora viven en `lib/email-marca.ts`
(el pendiente que `TODOS.md` tenía anotado con este disparador exacto).
Verificado generando el semanal antes y después del cambio: **no cambió ni un
carácter**.

### Fixed — el pie de los correos ya no dice que pediste algo que nunca pediste

`email_semanal` viene encendido por defecto desde la migración 0076, así que
casi nadie "activó" nada. El reenganche dice "recibes esto porque tienes una
cuenta en stailist". Decirle a alguien que pidió algo que no pidió es la clase
de frase que se contesta con el botón de spam, y con 13 personas una queja pesa.
La página de baja también dejó de prometer que solo apagaba el semanal: una sola
preferencia apaga los dos.

## [0.2.238.2] - 2026-08-14

### Fixed — el fit check volvió a registrar "me lo puse"

La señal de oro del experimento —alguien se pone de verdad un outfit— dejó de
escribirse cuando el fit check se volvió su único escritor (rediseño del home,
11 de agosto). Los dos fit checks posteriores crearon su fila de look y
**ninguno** dejó el evento.

Esa señal no es sólo un contador: alimenta la línea más fuerte del prompt del
motor ("se lo puso de verdad"), el orden del clóset por prendas usadas y el KPI
del admin.

- **Los dos eventos se escriben por separado.** Iban en un solo insert de dos
  filas, y lo medido fue que se guardaba el primero y no el segundo. La causa
  no se pudo reconstruir —las dos filas juntas se insertan bien al probarlas a
  mano contra la misma base— y eso es justo el argumento para separarlas: la
  métrica del experimento no puede depender de que su compañera de viaje tenga
  un buen día.
- **La ruta ya no se traga sus errores.** Guardaba el look y los eventos con un
  `catch` vacío y sin leer nunca el `error` de Supabase, así que el fallo no
  dejaba rastro en ningún sitio. Ahora cada paso dice qué pasó. Sigue sin
  romperle el consejo a nadie: si el registro falla, la lectura sale igual.

### Added — el dashboard avisa cuando una señal deja de llegar

Un bloque rojo arriba del admin cuando dos eventos que tienen que moverse
juntos dejan de hacerlo (fit check → "me lo puse"). Hoy diría: *2 de 36
produjeron worn, 6% llega*.

Existe porque los dos bugs de esta semana —el precalentado que se cancelaba
solo y este— son el mismo tipo: código que no lanza, no pinta error y deja de
hacer su trabajo. Los dos se encontraron por casualidad y con semanas de
retraso. Un KPI en cero se lee como "la gente no lo usa" cuando puede
significar "dejó de registrarse", y distinguir esas dos cosas es lo que costó
las semanas.

Sólo se pinta si hay algo roto: un bloque permanente en verde entrena a
saltárselo.

## [0.2.238.1] - 2026-08-14

### Changed — la vuelta sube a la altura del wordmark (handoff de diseño)

En tus esenciales y en la biblioteca, el "‹ clóset" y el menú "···" dejaron su
fila propia y se mudaron al header: el back flota a la izquierda del wordmark y
el menú ocupa el sitio del perfil. Son **~50px recuperados** que antes no
llevaban nada, justo debajo de otros 52px de header. Las dos esquinas estaban
libres porque el wordmark va centrado, y el patrón ya vivía en la app (el
detalle del diario sustituye el wordmark por "‹ historial").

El perfil cede su sitio a propósito: dentro de una sección no hace falta, y
vuelve con dar atrás. Donde la pantalla no trae menú —la biblioteca— el perfil
se queda donde siempre.

- **El colchón bajo las pestañas** de esenciales pasa de 24px a **12px**. Con
  24 la pestaña activa se leía desconectada de lo que estaba mostrando.
- El menú "···" ahora **cuelga del botón** en vez de a una distancia fija del
  borde de la pantalla: con el aviso de "hay una versión nueva" puesto, el
  desplegable tapaba el botón que lo abría.

**El detalle de viaje NO adopta el patrón**, aunque el handoff lo pedía: tiene
un header de dos capas construido alrededor de su portada, resuelve otro caso y
funciona. Queda anotado en `TODOS.md` para evaluarlo cuando se toque.

## [0.2.238.0] - 2026-08-14

### Added — ya se puede ver qué hace la IA (`/admin/ia`)

Cuánto tarda cada tarea, qué cuesta y cada cuánto truena. Antes eso se
contestaba de oído.

Lo que lo detonó fue concreto: el día anterior se descubrió que el
precalentado de imágenes de esenciales llevaba **dos semanas roto en
producción**, pagando renders que se cancelaban solos. No lo cazó ninguna
alerta — lo cazó una revisión de código, de casualidad. La tabla `ai_calls`
existía desde hacía días y **nadie la leía**.

- **`medir()`** reemplaza a "llamar y luego acordarse de registrar". Registra
  el éxito **y el fallo** en el mismo sitio; el fallo era justo lo que se
  perdía (de los dos únicos caminos instrumentados, sólo uno anotaba errores).
- **Diez tareas instrumentadas** donde antes había dos: motor, juez, espejo,
  las tres de visión, rúbrica, rúbrica visual, motivo de destino y el motor
  congelado. Los caminos de laboratorio (comparador, evales) pasan `null`
  explícito: medir una corrida de prueba como si fuera uso real ensuciaría
  los promedios.
- **El panel confiesa sus huecos** en la parte de arriba. Una pantalla de
  observabilidad que calla lo que no mira se lee como "todo bien" cuando en
  realidad dice "no estoy mirando", y ése es justo el malentendido que costó
  las dos semanas.
- **Un candado** (`lib/cobertura-recibos.test.ts`) barre el disco y exige que
  todo camino que hable con un modelo mida o esté declarado exento con su
  razón escrita. Ya sirvió de algo el primer día: la lista de caminos sin
  medir se había escrito a mano con nueve y el barrido encontró **catorce** —
  el modo Viaje entero faltaba, y también la puerta de las imágenes.

### Notas

- **Lo más caro sigue sin medirse, y ahora se sabe**: `lib/gemini-imagen.ts`
  (try-on, avatar, arquetipos, renders, destinos — siete consumidores) no deja
  recibo, porque una imagen no se cobra por token y la tabla de precios sólo
  sabe de tokens. Hace falta una tarifa por imagen antes que su
  instrumentación. Está declarado en el panel y anotado en `TODOS.md`.
- Los tiempos se calculan **sólo sobre las llamadas que salieron bien**, y los
  fallos se reportan aparte: mezclarlos miente en las dos direcciones a la vez
  (un timeout de 60s infla una tarea sana; un fallo instantáneo la hace ver
  rápida).

## [0.2.237.0] - 2026-08-13

### Fixed — cuando le picas, responde

Cinco lugares donde tocar algo no producía ninguna señal y la app se sentía
muerta (reporte de Roberto: "le pico y como que no reacciona, hace que la gente
le quiera picar varias veces"):

- **La card del último look**, en Inicio: traer el look tarda, y mientras tanto
  la card quedaba idéntica. Ahora dice **"abriendo…"** con barrido, se bloquea
  contra el segundo tap y, si falla, te avisa — antes un tap fallido no
  producía absolutamente nada.
- **Borrar un look del diario**: sale de la lista al instante en vez de
  esperar al servidor. Si el borrado truena, regresa a su sitio.
- **El listado de usuarios del admin**: sólo el correo era clickeable, así que
  picarle a cualquier otra columna no hacía nada. Ahora navega la fila entera,
  se atenúa como acuse de recibo y el detalle abre con su propia pantalla de
  carga (tarda: firma las imágenes de todo el clóset de esa persona).
- **Los chips de "¿qué no te lató?" y el corazón de favorito**: un doble tap
  escribía dos veces.
- **El fit check**: "rehacer" y "no es mía" no se bloqueaban, así que taps
  repetidos apilaban renders de la misma prenda — y "rehacer" dejaba puesta la
  imagen vieja, con lo que parecía que no había pasado nada.

### Fixed — el precalentado de imágenes moría en la primera

Las imágenes de tus esenciales se precalientan al abrir la pantalla, pero la
fila se **cancelaba a sí misma**: la lista de pendientes se recalculaba con las
imágenes ya listas, así que al aterrizar la primera, React cancelaba el resto.
Se precalentaba **una** imagen por visita, las que iban en vuelo se pagaban y
se tiraban, y el resto de la pantalla seguía en gris — justo lo que el
precalentado existía para evitar. Vivía ahí desde que nació (2026-07-30) y
quedó escondido tras la subida del tope de 8 a 40.

### Added — tus prendas sin foto también se dibujan

En tus esenciales, las prendas **tuyas** que no tienen foto ya no se quedan en
un cuadro de color: se dibujan solas al abrir la pantalla, con el mismo motor
que usa la maleta. Con tope de 12 y de dos en dos, porque a diferencia de las
prendas ideales —que se guardan en la biblioteca compartida y las hereda quien
venga después— el dibujo de tu prenda es tuyo y no se amortiza con nadie.

### Changed — se entiende qué son "tus esenciales" antes de contestar el quiz

- **Una pantalla previa** explica qué se va a crear y por qué antes de la
  primera pregunta. Sin ella se caía directo a un cuestionario de diez pasos
  sin saber para qué. Lleva su propia salida ("ahora no") y su propio crédito:
  quien abandona el quiz sigue teniendo derecho a la explicación que acompaña
  a la lista terminada.
- **La espera de ~40s ahora cuenta la idea** en vez de sólo anunciar el
  proceso: pocas piezas que combinan entre sí, tu clima y tus planes, menos
  "no sé qué ponerme".
- **"Fuera del trabajo, ¿qué pide ropa especial?" → "¿qué haces seguido?"**.
  Dos personas reportaron no entender la anterior: preguntaba por la ropa
  cuando lo que se necesita saber son tus planes; deducir las piezas es
  trabajo del motor. El motor sigue recibiendo la frase vieja (`promptLabel`),
  que ahí sí rendía: le dice que esas actividades suman piezas.

## [0.2.236.0] - 2026-08-13

### Changed — tus esenciales se leen como los viajes

- **Tres pestañas: el porqué · esenciales · looks.** "El porqué" te recibe con
  el razonamiento del estilista —tu sello en una frase y las razones detrás de
  la lista— y cierra con **"revisar esenciales →"**. Antes ese razonamiento
  vivía apretado junto a la lista en móvil; ahora tiene su lugar.
- **El encabezado dice de un vistazo dónde estás**: "tus *esenciales*" con
  cuántas piezas son, cuántas ya tienes en tu clóset y tu estilo. Y arriba, el
  regreso a tu clóset con las acciones raras (editar) juntas en el "···".
- Si llegas con la lista recién armada te recibe el porqué; si ya la conocías,
  aterrizas directo en tus piezas.

### Fixed

- El estilista ya no usa la palabra "cápsula" al explicarte tu lista — en la
  app se llaman **tus esenciales**, y ahora su texto también. (Las
  explicaciones ya escritas conservan la palabra hasta que rearmes tu lista.)

## [0.2.235.0] - 2026-08-13

### Changed — tu viaje se organiza en 4 pestañas, con su portada

- **El detalle de la maleta ahora va por pasos claros**: el plan · prendas ·
  empacar · looks. "El plan" te recibe con el razonamiento del estilista y lo
  que vas a hacer; "prendas" es donde decides; "empacar" es puro checklist; y
  los looks se generan al final, cuando la maleta ya es la buena. Si vuelves
  con la maleta confirmada, aterrizas directo en empacar.
- **La portada con la foto de tu viaje** vive en "el plan" — título y fechas
  sobre la imagen. Al pasar a las pestañas de trabajo se recoge sola con una
  transición suave, para dejarte el espacio donde lo necesitas.
- **"✓ listo — a empacar" cierra la revisión sin gastar en looks**: antes
  confirmar era generar; ahora generas cuando tú digas, desde empacar o desde
  la pestaña de looks.
- **La lista de "tus viajes" se ve como viajes**: foto grande del destino, el
  nombre en serif y cuándo sales. Un viaje multi-ciudad dice su ruta
  ("Tokio → Kioto") y se nombra por el país ("Japón").

### Added — editar ruta y fechas, sin perder tu maleta

- En el menú "···" del viaje ahora está **"editar ruta y fechas"**: cambia
  paradas, noches o la salida, y tú decides si la maleta se rehace con la ruta
  nueva o se queda como está (los looks se marcan para regenerar si cambiaron
  las fechas). Borrar el viaje también vive ahí.
- Las rutas redondas ya valen: **"Tokio → Kioto → Tokio"** conserva sus tres
  paradas con sus noches (antes la vuelta se perdía en silencio).

### Fixed — pulido del pase de revisión

- Rehacer la maleta ya no deja corazones ni try-ons de looks viejos pegados a
  los looks nuevos.
- Editar la ruta ya no vuelve a buscar las ciudades que no cambiaste — y un
  parpadeo del servicio de clima ya no te borra el clima que sí tenías.
- Los viajes de antes del multi-equipaje conservan su maleta documentada al
  rehacerse (ya no se degradaban a carry-on).
- Si tu viaje pasa de 30 días, el aviso ahora te lo dice claro en vez de
  pedirte reintentar.
- Botones más fáciles de atinar en el header del viaje, y las fotos de listas
  largas cargan solo cuando te acercas a ellas.

## [0.2.234.0] - 2026-08-13

### Changed — tus esenciales heredan lo que arreglamos en viaje

- **"Decide si te sirve" ya no arranca escondida** detrás de un toque, y la
  primera comparación abre sola. Se cerró cuando cada duelo ocupaba media
  pantalla; hoy son filitas, así que esconderla ya no compraba nada.
- Arriba de las dos fotos aparece de qué se trata: **"elige una · la que cubre
  este hueco"**.
- **Las imágenes se dibujan al cargar la página**, incluidas las de las
  comparaciones (que se habían quedado fuera). Antes tenías que ir tocando una
  por una: el tope estaba en 8 piezas y una cápsula pide entre 17 y 35.

## [0.2.233.1] - 2026-08-13

### Fixed — el duelo ya no tiene ese escalón raro entre las dos fotos

Las dos prendas del duelo vienen con proporciones distintas (la sugerida es más
alargada, la tuya suele ser cuadrada), así que a una siempre le sobra fondo. Ese
sobrante estaba en un gris que no era el del papel de las fotos y dibujaba un
rectángulo: lo que parecía la línea divisoria era en realidad el borde de la
segunda foto. Ahora el fondo empata con el papel y la divisoria se ve de arriba
abajo, en el viaje y en tus esenciales.

## [0.2.233.0] - 2026-08-13

### Added — el duelo del viaje se puede deshacer

Elegiste tu prenda sobre la sugerida (o al revés) y te arrepentiste: ahora la
decisión se queda a la vista, con su **deshacer**, y al tocarlo el duelo vuelve
tal cual — sin volver a buscar en tu clóset. Antes la elección desaparecía sin
vuelta atrás.

Y arriba de las dos fotos aparece de qué se trata: **"elige una · la que se va
a tu maleta"**.

## [0.2.232.3] - 2026-08-13

### Changed — el duelo del viaje es de dos, no de tres

Se quitó "ver otras de mi clóset" del duelo: si la app ya te propuso la mejor
de tu clóset, una tercera puerta a seguir buscando decía —en la misma tarjeta—
que no confiaba en su propia propuesta. Y de paso arreglaba un defecto: esa
búsqueda te devolvía una lista encabezada por la misma prenda que ya tenías
enfrente. Cambiar de prenda sigue donde tiene sentido: tocando una prenda ya
elegida ("no me convence — cámbiala").

## [0.2.232.2] - 2026-08-13

### Fixed — el duelo del viaje se entiende solo

Tocas la prenda que te quedas, se marca con un recuadro, y aparece un botón que
dice exactamente qué va a pasar: **"elegir la tuya"**. Antes había abajo una
línea de instrucción con el mismo aspecto que el botón de al lado — ninguna de
las dos se leía como lo que era. Es el mismo duelo de tus esenciales, ahora
también aquí.

## [0.2.232.1] - 2026-08-13

### Changed — los duelos del viaje, uno a la vez

"Decide si te sirve" ya no te avienta todos los duelos de golpe: uno abierto
y los demás en filitas compactas (las dos fotos en miniatura, "¿o tu camisa
blanca?"). Decides tocando la foto que te quedas — y el siguiente duelo se
abre solo. Igual que en tus esenciales.

Y "No lo tienes" perdió el botón de "buscar en mi clóset": esa sección ya es,
por definición, lo que la búsqueda no pudo cubrir con tu ropa — ofrecerte
buscar ahí era contradecirla.

## [0.2.232.0] - 2026-08-13

### Changed — el plan del viaje se parte por lo que significa, no por de dónde viene

"No lo tienes" ahora es solo eso: lo que de verdad no hay con qué cubrir —
cómpralo, mándalo a wishlist o di que ya lo tienes. Y **toda** comparación
entre lo sugerido y algo tuyo vive junta en **"Decide si te sirve"**, con el
mismo duelo de fotos: venga de una prenda parecida que te encontré o de una
falta que tu clóset puede cubrir. Antes el duelo aparecía dentro de "no lo
tienes" y los parecidos ni siquiera comparaban.

## [0.2.231.1] - 2026-08-13

### Fixed — las prendas sugeridas del viaje ya llegan con foto

Las sugerencias del plan sin imagen se quedaban como recuadros grises hasta
que picabas una por una. Ahora se dibujan solas al abrir el plan — lo mismo
que tus esenciales hacen desde julio. Y el duelo nunca compara una foto
contra un recuadro gris.

## [0.2.231.0] - 2026-08-13

### Changed — la cápsula y el viaje hablan el mismo idioma

Los dos módulos hacían lo mismo con palabras distintas, y una palabra
("cambiar") significaba lo contrario en cada uno. Ahora:

- En esenciales, la sección de lo que te falta dice lo que es: **"No la
  tienes — cómprala o cúbrela"** (antes "Lo que más te suma").
- El botón que revierte tu decisión ahora se llama **"deshacer"** — "cambiar"
  queda solo en el viaje, donde de verdad cambia una prenda por otra.

### Added — el viaje ya te propone el reemplazo, no te manda a buscarlo

Si al plan del viaje le falta algo que puedes cubrir con tu ropa, ya no hay
que descubrir la lupa: la app busca sola y te pone el duelo — **la sugerida
contra la tuya, con fotos**. Un tap y decidiste. Es la misma interacción de
tus esenciales, ahora en los dos lugares.

## [0.2.230.2] - 2026-08-13

### Fixed — "viajes" en el menú ya lleva a tus viajes

Si tenías un viaje cerca, tocar **viajes** en el menú "más" te metía directo
dentro de esa maleta en vez de abrir la lista — y desde ahí el resto de tus
viajes quedaba inalcanzable. Ahora siempre abre modo viaje. El acceso directo a
la maleta del viaje que se acerca sigue donde debe: la card del inicio.

## [0.2.230.1] - 2026-08-13

### Changed — las fotos de destino, ahora claras

Las fotos de viaje seguían en blanco y negro, pero la receta pedía "negros
profundos" y los edificios de piedra oscura salían como una mancha (la catedral
de Guatemala fue la prueba). La receta nueva es luminosa y aireada — elegida
comparando seis acabados del mismo edificio al tamaño real de la card. Se
regeneraron las 19 fotos del catálogo y las 3 ya generadas por viajes reales.

## [0.2.230.0] - 2026-08-13

### Changed — el viaje ahora sí fluye como el handoff: plan → maleta → looks

Al crear un viaje ya no aterrizas en los cheques de empacado. Primero ves **el
plan**: qué no tienes y deberías comprar, qué te sugiero de tu clóset y puedes
cambiar (con el porqué a la vista), y qué ya tienes. Cuando te late, confirmas
— y ahí se arman tus looks y la pestaña se convierte en **la maleta**, con sus
cheques y su "empacar todo", para cuando de verdad estés empacando.

## [0.2.229.0] - 2026-08-12

### Added — cada viaje con la foto de su destino

Los viajes ahora se ven: la foto del destino aparece en la lista, en el
detalle y en la card del home. Los destinos frecuentes ya tenían foto curada;
los demás (Osaka, Kioto, el pueblo que sea) **se generan solos la primera vez
que alguien viaja ahí** — en blanco y negro editorial, mientras contestas las
preguntas del wizard, sin que esperes nada. Si el viaje tiene varias paradas,
manda la primera: nada de híbridos raros.

### Changed — los looks del viaje esperan tu visto bueno

Antes podías brincarte directo a "tus looks" y generarlos sin haber revisado
qué te sugerí empacar. Ahora la primera generación vive donde debía: al final
de tu maleta, después de que aceptaste o cambiaste las sugerencias. No es un
paso más — es el mismo botón, en el momento correcto.

### Added — empacar todo

Un tap y toda la maleta queda palomeada. Palomear quince prendas de una en
una era un castigo.

## [0.2.228.0] - 2026-08-12

### Added — el fit check ya sabe a dónde vas

Antes le mandabas la foto y opinaba de tus colores, del clima y de cómo te
queda. Todo cierto… pero sin saber si ibas a una comida, a la oficina o al gym.
Y *"¿me veo bien?"* siempre quiere decir **"¿me veo bien para esto"**.

Ahora, mientras la foto se sube, te pregunta una sola cosa: **¿a dónde vas?**
Cuatro opciones, un tap. Si ya te armó un look hoy, llega marcada la que
supone — pero no decide por ti.

Con eso puede decirte lo que antes no podía: *"para algo especial este combo se
queda corto"* o *"con esto entras bien a la oficina"*. La misma foto, dos varas
distintas, dos respuestas distintas.

Y si vas al gym o a un mandado, no te va a sugerir que te arregles.

### Added — la app ya se acuerda de cuánto tarda

Cada llamada al stylist deja su recibo: cuánto tardó, cuánto costó. No se
guarda ni tu foto ni lo que dijo — sólo el número. Sirve para que las
decisiones sobre esperas y costos dejen de tomarse a ojo.

## [0.2.227.0] - 2026-08-12

### Added — puedes fijar varias prendas, no sólo una

Antes podías decirle *"hoy quiero usar este blazer"* y te armaba el look
alrededor. Ahora puedes decirle *"este blazer **y** estos jeans"* — hasta tres —
y arma el resto alrededor de todas. Ninguna se cambia ni se cae, aunque no vayan
con el clima.

Las prendas que no pueden convivir salen apagadas y te dice por qué: dos
pantalones no caben, un vestido no lleva pantalón. **Camisa y suéter sí**, que
eso es un look en capas.

Y si quieres decidir el outfit entero sin que la app opine, ésa es la otra
pantalla: *"pruébate un look"*.

## [0.2.226.0] - 2026-08-12

### Added — el probador, ahora desde tu clóset

Puedes elegir varias prendas y verte con ellas puestas. Ya se podía… pero sólo
desde la wishlist: **Clóset → wishlist → bajar → botón.** Y la wishlist es donde
guardas lo que *no* tienes, así que combinar tu propia ropa era lo último que se
te ocurriría buscar ahí.

Ahora está donde está tu ropa, arriba de todo: *"pruébate un look — combina
prendas y mírate con ellas"*. Mezcla lo tuyo con lo que quieres comprar, igual
que antes.

### Changed — dos botones dejaron de llamarse igual

*"Armar un look (wishlist + clóset)"* se llama ahora **"pruébate un look"**,
porque *"arma un look con esta prenda"* —lo de ayer— hace lo contrario: ahí la
app decide qué ponerte; aquí decides tú y la app sólo te lo dibuja.

## [0.2.225.1] - 2026-08-12

### Fixed — probarte la misma combinación ya no cuesta la espera de siempre

En "armar un look (wishlist + clóset)" cada intento se dibujaba desde cero,
aunque fuera exactamente la misma combinación de hace un minuto. Probar los
mismos zapatos con el mismo pantalón dos veces —que es justo como se decide una
compra— costaba veinticuatro segundos las dos veces, y la imagen se perdía al
cerrar.

Ahora la primera vez tarda lo mismo y **las siguientes son instantáneas**: 24
segundos → menos de uno. Da igual el orden en que elijas las prendas.

Y si te regeneras el avatar, tus combinaciones se vuelven a dibujar solas con tu
cara nueva, en vez de quedarse con la vieja.

## [0.2.225.0] - 2026-08-12

### Added — "arma un look con esta prenda"

Abres una prenda de tu clóset y ahora puedes pedir un look alrededor de ella.
El outfit se arma con esa prenda dentro, sin excepción: aunque no case con el
clima, aunque la tengas vetada. Si la app cree que no va con la ocasión te lo
dice antes, y tú decides.

De ahí en adelante es el camino de siempre — te pregunta el plan, el clima y la
hora, porque eso es lo que necesita para elegir el *resto*.

Es la misma prenda que ya podías fijar dentro del asistente, en un renglón
opcional que casi nadie iba a encontrar. Ahora se pide desde donde de verdad se
te ocurre: mirando la prenda.

## [0.2.224.1] - 2026-08-12

### Changed — el "historial" ahora se llama diario

Era la única pestaña con nombre de sistema. Y el nombre viejo ya no era cierto:
desde que el fit check registra lo que traes puesto con foto, esa pantalla dejó
de ser un archivo de sugerencias para volverse el registro de **lo que de verdad
te pusiste, día por día**.

### Changed — el menú "más" adelgazó

Tenía seis atajos y tres de ellos no ahorraban un solo toque: *tus esenciales* y
*wishlist* son pestañas del clóset, y *favoritos* es un filtro del diario — con
o sin atajo, llegar cuesta dos toques.

Ese menú existe para un momento: estás en una tienda y quieres saber si algo va
con tu paleta. Con seis opciones hay que leer seis; con tres, no. Quedan **añadir
prendas** y los tres lugares que no viven en ninguna pestaña: viajes, modo tienda
y tus colores.

## [0.2.224.0] - 2026-08-12

### Changed — la ficha de una prenda cabe en una pantalla

Abrir una prenda del clóset te enseñaba doce campos desplegados a la vez y pedía
scroll y medio, cuando casi siempre entras por una sola cosa: verla en grande,
cambiarle el nombre, corregir el color o rehacer su imagen.

Ahora arriba hay una fila que **dice** lo que la app cree de esa prenda —*saco ·
● gris carbón · formal*— y tocas sólo lo que esté mal. El resto (temporada,
cómo te queda, material, patrón, segundo color, marca y talla) vive detrás de
*"+ más"*. La ficha entera cabe sin scroll.

Es el mismo lenguaje que ya usas al dar de alta ropa por foto: los mismos chips,
en el mismo orden. Antes eran dos formas distintas de tocar los mismos datos.

Tres cosas siguen a la vista a propósito: el nombre, el lazo del conjunto —es el
único lugar donde se ata un traje— y rehacer la imagen. Y las siluetas dibujadas
del corte se quedan, porque enseñan mejor que las tres palabras sueltas; ahí el
que cambió fue el otro lado.

### Fixed — correcciones que se perdían sin avisar

- Cambiabas el nombre, guardabas, y al corregir de paso otra cosa ya no había
  botón para guardarla: se iba con un mensaje de éxito en pantalla.
- Tocar fuera de la ficha tiraba lo que llevabas escrito, sin preguntar. Ahora
  te avisa y no cierra.
- Si el guardado fallaba, la ficha se quedaba idéntica y parecía guardado.
- Tocar el color que ya estaba puesto sustituía el nombre fino de tu prenda
  ("gris carbón") por el genérico de la paleta, y ofrecía rehacer la imagen por
  un color que no había cambiado. Pasaba en 127 prendas.
- El corte seguía guardándose —y quedando marcado como confirmado por ti— en
  prendas donde ya no aplica, si le cambiabas el tipo después de tocarlo.
- El material escrito a mano se guarda igual desde las tres puertas de alta;
  antes "Algodón " y "algodón" eran dos materiales distintos para el motor.

## [0.2.223.4] - 2026-08-12

### Fixed — "rehacer la imagen" ya hace algo

Tocar *"la imagen no es de esta prenda — rehacerla"* en una prenda del catálogo
generaba la imagen nueva, la guardaba… y seguía enseñando el dibujo de siempre.
La generación se cobraba igual, y se podía repetir sin límite sin ver un solo
cambio. Reportado por Roberto sobre una chamarra que la app pintó gris siendo
negra — y en esa prenda había, de hecho, una imagen pagada que nadie mostró
nunca.

La causa: el dibujo del catálogo iba antes que tu imagen en el orden de
prioridad. Ahora, cuando **tú** pides rehacerla, tu imagen manda. No se borra
nada: la prenda conserva su ficha de catálogo y quitar la preferencia la
restaura, igual que con "es la misma" de las fotos propias.

└ **Rehacer guarda primero.** El render se hace con lo que hay en la base, no
  con lo que tienes en pantalla, así que cambiar el color y tocar "rehacer"
  regeneraba con el color viejo — otra vez la misma imagen. Ahora el botón lo
  dice: *"guardar y rehacer la imagen con estos datos"*.
└ **Si algo falla, te enteras.** El error se tragaba en silencio: una ruta caída
  se veía idéntica a un render perfecto.

**Lo que esto NO cambia:** los outfits que ya usaban la prenda con el color
equivocado. Su miniatura se corrige sola —guardan la referencia, no una copia—
pero el texto ya escrito ("el gris carbón funciona con…") se queda, porque se
redactó cuando el dato era otro.

## [0.2.223.3] - 2026-08-12

### Added — la app ya recuerda lo que le pides con tus palabras

El campo libre del wizard mandaba tu texto al stylist y ahí se perdía: no
quedaba guardado en ningún lado. Ahora sí, con el mismo recorte que ve el motor.

No cambia nada de lo que ves. Cambia lo que se puede saber: hasta hoy nadie
podía responder qué le pide la gente al stylist cuando lo escribe con sus
propias palabras — ni cuántas veces, ni para qué planes. Era la pregunta que
decidía si construir la interpretación automática de ese campo (issue #232), y
resultó que ni siquiera se podía formular: ese trabajo pide "20 planes reales"
como requisito, y no había ninguno guardado.

## [0.2.223.2] - 2026-08-12

### Fixed — el primer look ya escucha que es una boda

En el onboarding, el wizard pregunta **qué evento es** y **qué tan formal**… y la
ruta que arma ese primer look tiraba las dos respuestas a la basura. Viajaban por
la red y ahí se quedaban: `/api/generate` no las declaraba, y lo que una ruta no
nombra no existe. Nada fallaba — solo llegaba un look de martes cualquiera.

Lo que se perdía no era un matiz: con "una boda", el motor recibe ahora
*"hay fotos, hay ceremonia, se está de pie y sentado por turnos, **nunca de
blanco entero** — es de quien se casa"*. Esa instrucción no llegaba, así que el
primer look de alguien podía ser blanco entero para una boda.

Es el hermano del bug que arregló 0.2.223.0 (el botón de crear reutilizaba el
look en caché ignorando la ocasión recién elegida): el wizard pregunta y la ruta
no escucha. Por eso el arreglo viene con un **candado**: un test que compara el
contrato que manda el wizard contra lo que cada ruta de verdad lee, y truena
nombrando el campo sordo. Las excepciones legítimas se declaran con su razón.

## [0.2.223.1] - 2026-08-12

### Changed — el nombre del look recupera su pantalla

Dos ajustes al detalle del look, viéndolo en producción (Roberto).

└ **La fecha deja de ser un titular.** "el jueves 13" ocupaba el mismo tamaño y
  peso que el nombre del look, a su lado, y encima le robaba el ancho — así que
  "Esmeralda a prueba de lluvia" se partía en dos líneas por culpa de un dato
  al margen. Ahora la fecha es un eyebrow pequeño y **solo aparece cuando el
  look no es de hoy**: decir "hoy" sobre el look de hoy no le dice nada a
  nadie. El nombre pasa a titular único, a todo el ancho.
└ **"Otro look" cede su lugar al fit check.** El pie tenía tres acciones en dos
  filas y la invitación a enseñar el outfit vivía abajo, leyéndose como letra
  chica. Ahora comparte una sola fila con el voto. Regenerar sigue a un tap por
  dos caminos —el 👎 abre la hoja de razones, que remata con "ver otro look", y
  el botón ✦ genera desde cualquier pantalla— y lo que se pierde es justo lo
  que convenía perder: el atajo de pedir otro **sin decir por qué**, principal
  sospechoso de que el feedback esté tan seco.

Entre las dos, el look gana casi una pantalla de alto para las prendas.

## [0.2.223.0] - 2026-08-11

### Changed — el home deja de preguntar por hoy y te pregunta qué quieres

Rediseño de "Inicio" del handoff validado con Roberto. El home anterior asumía
que lo que querías era el look **de hoy**: el titular decía "tu look de hoy,
aún no" y el botón cambiaba de verbo según existiera o no. Dos problemas: el
producto ya planea para cualquier día (desde 0.2.215), así que el titular
mentía; y el botón hacía dos trabajos —crear y ver— sin decir cuál.

└ **El titular ya no asume el día**: "¿qué look armamos?" con el CTA fijo
  **"crear un look"**, que nunca desaparece. Cuándo lo preguntas en el wizard.
└ **El último look bajó a una card con imagen**: el retrato de tu avatar
  vistiéndolo si lo generaste, y si no, la tira de sus prendas. Tocarla lo
  ABRE — ver lo que ya existe no vuelve a costar una generación.
└ **Fuera los chips de looks planeados** (el historial ya los cubre) y fuera
  el tile "planear otro día", que duplicaba el botón de arriba.
└ **El fit check es el protagonista de las recurrentes**, con su ícono en
  tinta invertida, y "añadir prendas" queda como tile delgado debajo.
└ **"Qué sigue" perdió la caja**: hairline y pegado al fondo, solo pendientes
  numerados por su posición real, y se colapsa a una línea cuando ya tienes un
  look. Lo hecho vive tras "ver lo hecho", como antes.
└ **Los tips ya no son una burbuja negra**: la pantalla se apaga al 38% y la
  nota es una tarjeta blanca con serif itálica. En negro se confundía con los
  botones —el CTA, el botón central y el fit check son exactamente ese negro—,
  así que el tip parecía algo que tocar. Nuevo token `--shadow-float`,
  documentado en DESIGN.md: la excepción para lo que flota sobre un velo.

### Changed — la pregunta "¿te lo pusiste?" se volvió una oferta

La card que preguntaba si te habías puesto el look de ayer era un favor: no
daba nada a cambio y llegaba cuando la respuesta todavía no existía. Muere. En
su lugar, el look lleva fija la invitación **"cuando te lo pongas, enséñamelo
— te digo cómo se ve"**, que abre el fit check. Y el registro de que sí te lo
pusiste ahora lo escribe el propio fit check, que trae la foto como prueba en
vez de pedirte que contestes.

En el panel, la señal de oro pasa a medirse por **cercanía**: un fit check a
menos de 24 horas de un look generado cuenta como "se puso lo que le sugerí".

### Added — cada viaje llega con la foto de su destino

La card de viaje (solo a 7 días o menos) ahora abre con una foto del lugar:
19 destinos en blanco y negro, elegidos por el nombre del viaje y, si no lo
reconoce, por las ocasiones que marcaste. Son B&N a propósito — en esta app el
color es de tu ropa, y una playa a color sería el atardecer naranja de siempre.

### Removed — "sin estrenar" se va hasta que el registro de uso funcione

Avisaba de prendas que "no habías estrenado", pero eso significa "nunca
registrada como usada" y ese registro está seco: casi cualquier prenda
calificaba. Era una alarma conectada a un cable cortado.

### Fixed

└ **Pedir una boda ya no te devuelve el look de la oficina.** Con un look de
  hoy ya generado, el botón de crear reutilizaba el que estaba en caché e
  ignoraba la ocasión que acababas de elegir — sin error ni aviso.
└ **El home ya no puede quedar inalcanzable** al abrir un look planeado desde
  su card (el parámetro de la URL se limpiaba solo en uno de los dos caminos).
└ **Los faltantes de la maleta cuentan igual en la card y en el detalle**: al
  desmarcar algo empacado, los dos números se separaban.
└ **Un viaje con datos viejos ya no tumba el home entero.** Las dos cards
  nuevas fallan hacia null en vez de reventar la pantalla.
└ **La fecha del último look ya no parpadea de noche**: se calculaba con el
  reloj del servidor (UTC), así que después de las 6pm decía "ayer" sobre algo
  de hoy.
└ **La cuenta regresiva del viaje usa tu reloj**: anunciaba "en curso" un
  viaje de mañana y pedía comprar "hoy" a las 8 de la noche del día anterior.
└ **Un viaje a "Roma Norte" ya no enseña el Coliseo** — es una colonia de la
  CDMX, no Italia.
└ El try-on de un viaje o de la cápsula ya no se cuela como "tu último look":
  esas filas existen solo para guardar el render y no deben aparecer.

## [0.2.222.0] - 2026-08-11

### Changed — si estás bajo techo, la lluvia deja de mandar en tu look

Segunda pasada del wizard "crear un look", del handoff de diseño validado con
Roberto. El hueco que lo motivó, en sus palabras: *"puede estar lloviendo y si
yo voy a estar siempre entechado, me la pela la lluvia"*. La app trataba
cualquier día de lluvia como un día a la intemperie, así que una comida en un
salón perdía los mocasines y ganaba una gabardina que nadie iba a usar.

└ **"¿la lluvia te toca?" — afuera / techado**, solo cuando el pronóstico trae
  agua. Con *techado* desaparece la pregunta del paraguas y **al motor no le
  llega que llueve**: recibe la temperatura y nada más. La mitigación pasa
  ANTES del modelo, no como una regla más del prompt — mandarle los dos hechos
  ("va a llover" + "estará adentro") es pedirle que resuelva una contradicción,
  y ahí es donde se rompe. Se apagan solas las tres reglas de lluvia (capa
  impermeable, veto de calzado, paraguas). La temperatura NUNCA se toca: bajo
  techo sigues eligiendo entre manga corta y abrigo. Lo que se GUARDA con el
  look sigue diciendo que llovió — el historial no miente sobre el día.

└ **La lluvia escrita a mano pasa por el mismo filtro**: si contestas "sí
  llueve" en el cuestionario manual, también te pregunta si te toca. Sin eso se
  colaba al motor por la puerta de atrás.

└ **Bodas de playa**: la boda gana una quinta opción, *"guayabera o lino · de
  playa"* (mujer: *"vestido fresco, fluido"*). Es frecuente de verdad en México
  y no tenía dónde caer: se pedía como "formal" y llegaba traje oscuro con
  suela de cuero para la arena. Trae su propia regla —fuera el saco oscuro y el
  tacón de aguja, que se entierra— y **es el único código que invierte el
  empuje del motor**: aquí pasarse de arreglado es el error, no quedarse corto.
  Lo cazó una corrida real: la primera boda de playa devolvió blazer marino y
  zapato de piel, empujada por el "ante la duda, sube medio nivel" que sirve
  para los otros cuatro niveles. Prompt v51.

└ **Dictado con micrófono propio** en el campo "cuéntamelo con tus palabras":
  hoja "te escucho…" con la transcripción en vivo, y nada se usa hasta que lo
  confirmas. Si tu navegador no sabe transcribir (pasa en la app instalada de
  iPhone) el botón simplemente no aparece y queda el micrófono del teclado. Se
  dice quién escucha: lo transcribe el navegador en su nube, nosotros solo
  recibimos el texto.

└ **La ubicación ya no se pide de sorpresa**: tocar "en esta ciudad" explica
  primero para qué se usa ("te lo pide el navegador solo una vez — no importa
  el punto exacto") y un botón la pide. Quien ya dio permiso no ve nada de eso:
  se lee en silencio. El prompt del navegador sale una vez en la vida de la
  instalación y un "no permitir" no se puede volver a preguntar.

└ **Los planes sociales, en rejilla de dos columnas con ícono** y sin el chip
  "otro…": graduación y funeral —esporádicos de verdad— entran por el campo
  libre, con tus palabras.

### Added — los primeros tests de pantalla del proyecto

19 tests de componente del wizard (jsdom + testing-library), que blindan lo que
ningún test de función pura alcanza: **qué decisión viaja al motor** según lo
que tocaste. Cazaron un bug real antes de salir — al tocar "seguir dictando" se
borraba lo que ya habías dictado, porque cada sesión de reconocimiento empieza
en blanco. El cómo escribirlos está en CLAUDE.md (§ Tests): docblock de jsdom
por archivo y `cleanup` a mano, las dos cosas fáciles de olvidar.

### Fixed — una sola definición de "está lloviendo"

La pregunta vivía escrita cinco veces (wizard, prompt, juez, rúbrica, evales) y
la copia del wizard ya había derivado: sin el flag de mayúsculas y con otra
lista de palabras. Ahora todas llaman a `hayLluvia`. Era justo la divergencia
por la que el techado se rompe en silencio: la UI no pregunta por una lluvia
que el motor sí ve.

## [0.2.221.0] - 2026-08-11

### Changed — el home se vuelve la central de acciones (y "Hoy" pasa a "Inicio")

Rediseño del home a partir del "critical roadmap" de Roberto (clasificar cada
acción: one-time / recurrente / contextual) + los datos de 25 usuarios reales:
el fit check tenía 3 usos ajenos en 2 meses viviendo en jerarquía fantasma, el
40% del clóset entró por el carrete A PESAR de estar enterrado en drawers, y el
avatar (one-time) gastaba la posición #1 del checklist. La pirámide estaba
invertida. Design doc con 2 rondas adversariales (15 issues):
`~/.gstack/projects/stailist/robertocoste-main-design-20260811-home.md`.

└ **Cuatro zonas que calcan la taxonomía**: (1) *tu día* — el look de hoy + la
  fila de looks PLANEADOS por estrenar ("mañana · Elegancia Nocturna", tap y lo
  ves) — cero migraciones, lee `planned_for`; (2) *las recurrentes*, siempre a
  un tap — **el fit check protagonista** ("¿me veo *bien* hoy?" — sube del
  último renglón fantasma a tile dominante), añadir prendas, planear otro día;
  (3) *lo contextual* — la card única de siempre, que ya NO se apaga cuando hay
  look listo ("¿te lo pusiste ayer?" es justo más valiosa al volver con look);
  (4) *qué sigue* — checklist v2: estilo → silueta → cápsula. **Salen avatar**
  (su empujón vive donde tiene contexto: el CTA del try-on) **y prendas** (el
  tile permanente la reemplaza).

└ **La tab "Hoy" ahora es "Inicio"** (móvil y desktop): desde que se planean
  looks para otros días, el nombre mentía. Las rutas no cambian. Los hints
  se reescribieron (el "dime qué traes hoy y te armo el look" describía el
  trabajo viejo de la pantalla).

└ **Gate pre-registrado**: si con jerarquía protagonista el fit check no llega
  a ≥3 usuarias distintas de Roberto en 2 semanas, el problema no era
  visibilidad — se reevalúa la acción, no se empuja más.

## [0.2.220.0] - 2026-08-11

### Fixed — el PRIMER look de quien trabaja salía con el motor adivinando

└ Hueco viejo (no de ayer): el wow —el primer look, el del onboarding— se
  saltaba el paso del detalle junto con el del plan. Quien elegía "trabajo"
  como objetivo recibía su primer look **sin que nadie le preguntara su código
  de vestimenta**, o sea con el motor adivinando si su oficina es de traje o de
  tenis. Y ese look es justo el que decide si la persona se queda. El backend
  siempre estuvo listo (`/api/generate` ya persistía `work_dress_code`); lo que
  faltaba era la pregunta. Roberto, al verlo: *"me extraña que no esté"*.

└ **La máquina de pasos sale del componente** a `lib/wizard-pasos.ts`, como
  función pura con 9 casos probados. El hueco había vivido meses escondido en
  una condición booleana inline — ahí no se ve y no se prueba. Uno de los casos
  blinda una trampa sutil que casi entra en este mismo fix: si el cálculo usara
  el código de vestimenta *efectivo* en vez del *guardado*, tocar una opción
  borraría el paso donde estás parado y el wizard saltaría solo.

## [0.2.219.0] - 2026-08-10

### Fixed — el permiso de ubicación tiene TRES finales, y el tercero era mudo

└ Lo que vivió Roberto: tocar "aquí, donde estoy" y recibir "no pude leer tu
  ubicación" sin que nadie preguntara nada. La causa: cuando el navegador ya
  tiene la ubicación BLOQUEADA para el sitio (un "no permitir" viejo — muy
  probablemente del bug de los 5 segundos), el prompt no vuelve a salir jamás;
  ningún sitio web puede re-abrirlo. Ahora se distingue y se dice:
  · permiso sin decidir → el prompt sale en el tap + "leyendo tu ubicación…"
  · bloqueado → "tu navegador tiene la ubicación bloqueada para stailist —
    actívala en sus ajustes, o dime tú el clima" (en el tap Y en el paso del
    clima, que abre el listado manual con esa explicación)
  · fallo real (sin señal) → "no pude leerla — dime tú".
  Verificado contra un navegador con el permiso realmente en "denied".

## [0.2.218.0] - 2026-08-10

### Fixed — la ubicación perdía la carrera contra el prompt de permisos

└ **El bug que vivió Roberto**: "aquí, donde estoy" pedía la ubicación con un
  timeout de 5 segundos — y el prompt de permisos del teléfono tarda lo que
  tarde la persona en leerlo. Aunque dijeras que sí, la app ya se había
  rendido y te volvía a preguntar el clima a mano. Ahora el timeout es
  generoso (30s) y el botón confirma en el momento: "listo — ya sé dónde".

### Changed — cuarta pasada del wizard, del feedback en vivo

└ **La fuente del clima, a la vista**: "20°" a secas se leía como adivinanza.
  Pronóstico real → "pronóstico de Open-Meteo"; fuera del horizonte → "no hay
  pronóstico tan lejos — es el clima típico de estas fechas". Explicar, no
  disfrazar.

└ **El paraguas dice su porqué real**: "decide si tu capa de arriba tiene que
  aguantar agua" — el "te suelto la mano" no lo entendía nadie.

└ **"Otro día" abre un calendario de verdad**: rejilla mensual con encabezados
  (D L M M J V S), hoy marcado, el horizonte tocable y el resto del mes
  apagado — la sábana de chips "se veía horrible" (cierto).

└ **Empujar a compartir ubicación**: sin coords, el paso del clima ofrece UN
  camino principal ("compartir mi ubicación" — resuelve y muestra ahí mismo)
  y la salida explícita ("prefiero decirte yo") que abre el listado manual.
  Dos opciones del mismo peso invitaban a la flojera de contestar a mano.

## [0.2.217.0] - 2026-08-10

### Changed — el wizard deja de sonar a máquina

Tercera pasada del día sobre el wizard, del feedback de Roberto: *"se siente
copy-paste... debería sentirse más personalizado por opción"* + *"yo pondría
hoy / mañana / otro día"* + *"me das la conclusión ya"*.

└ **El detalle es de CADA plan, no una plantilla.** Cada evento del catálogo
  trae su propio copy ("la cena es donde más se nota si te arreglaste...",
  "aquí manda la invitación...") y SOLO las formalidades que le aplican —
  ofrecer esmoquin para una cena con amigos delataba a la máquina. Con test
  del invariante (el default y su subida de noche siempre están entre las
  opciones ofrecidas).

└ **"¿Qué día?" en tres opciones**: hoy · mañana · otro día… — y solo "otro
  día" despliega la rejilla completa (wrap, sin scroll horizontal).

└ **"¿Dónde?" explícito**: "aquí, donde estoy — leo tu clima yo" (el tap pide
  el permiso de ubicación, no un prompt sorpresa) / "en otra ciudad — dime
  cuál y saco el clima". Y el paso del clima se volvió LA CONCLUSIÓN: "20° ·
  lluvia — así se ve el jueves 13 en Cuernavaca", paraguas si llueve, y el
  cuestionario de bandas escondido tras "¿no va? corrígeme". Preguntar lo que
  la app ya sabe era la fricción; sin coords, el flujo manual sigue intacto.

## [0.2.216.0] - 2026-08-10

### Changed — el wizard se splitea: una pregunta por pantalla

Feedback de Roberto sobre la 0.2.215.0, a minutos de shippeada: *"son
bastantes acciones las que estás pidiendo en la misma pantalla… deberíamos
splitear"*. Tenía razón — el paso 1 apilaba plan + fecha + formalidad +
cuestionario de trabajo + campo abierto en un long scroll.

└ **Pasos dinámicos: plan → detalle → cuándo → clima.** El "detalle" (la
  formalidad del evento con su default pre-marcado, o la calibración de
  trabajo) es su propio paso y **solo existe si hay algo que acotar** — la
  barra de progreso se adapta (día normal = 3 pasos, boda = 4). La calibración
  de trabajo sigue siendo one-time y ya era editable en /perfil/trabajo.

└ **"¿Cuándo es?" — fecha y día/noche son la misma pregunta.** Un solo paso:
  qué día (hoy default) + de día/de noche + **"en tu ciudad ▾"** para el caso
  Irapuato (la comida del viernes es en OTRA ciudad): se teclea la ciudad, se
  geocodifica con la pieza del modo Viaje, y el pronóstico sale de ahí — sin
  pedir permiso de ubicación.

└ **El clima deja de preguntar lo que la app ya sabe.** Con ciudad dicha (o
  permiso de ubicación ya dado), el último paso llega CONTESTADO: "así estará
  el clima — 21° · lluvia, así se ve el viernes 14 en Irapuato — ajusta abajo
  si no va". Bandas y lluvia pre-marcadas, editables; si no tocas nada viaja el
  clima leído exacto (21°), no la banda redondeada. Sin coords: el flujo manual
  de siempre. Verificado e2e: boda→vie 14→Irapuato generó con 21°·lluvia reales.

## [0.2.215.0] - 2026-08-10

### Added — el wizard habla en planes, y ya puedes pedir un look por adelantado

└ **El paso 1 dejó de clasificar.** "¿Qué plan tienes?" con los planes a la
  vista: 2 cards cotidianas (un día normal, trabajo) + los planes sociales del
  catálogo como chips (cena, cita, comida familiar, comida de trabajo, fiesta,
  boda; graduación y funeral tras "otro…" — "¿qué tantas veces vas a un
  funeral?"). Antes una cena obligaba a decidir si "contaba como un evento"
  para llegar, dos niveles adentro, al catálogo que sí la entendía. Elegir un
  chip resuelve todo de un tap (formalidad default + "cambiar", como siempre).
  "Refrescar" salió del wizard (tarea #14: nadie entendía qué prometía); los
  perfiles que lo traían guardado caen a "un día normal".

└ **"Para hoy ▾" — la fecha como suposición editable.** Tocarla abre una lista
  de días (hasta ~16, el horizonte del pronóstico). "El sábado tengo una cena"
  por fin se puede pedir el miércoles: el look se genera con el PRONÓSTICO de
  ese día (getWeatherForDates, la pieza del modo Viaje), se guarda colgado a su
  fecha (`planned_for`, migración 0131) y **ese día amanece siendo tu look del
  día** — sin generar ni pagar nada nuevo. La vista lo dice honesto: "el
  miércoles 12", no "hoy". Verificado e2e: cena→mañana y boda→mié 12 generados,
  y la promoción del día D probada contra la base.

└ **El campo abierto invita al dictado** ("escríbelo o díctalo…"): el micrófono
  del teclado ya dictaba ahí gratis — solo faltaba decirlo. Sin botón de mic
  propio (un mic que no graba es una mentira visual). Gates pre-registrados en
  events: `plan_libre` (¿se usa el campo? → parser) y `planned_for` (¿la gente
  planea? → agenda visible).

### Fixed — dos quirks que el rediseño destapó

└ **El look del día rotaba a las 6pm de CDMX**: `look_date` se calculaba con el
  reloj UTC del servidor. Ahora la fecha local del dispositivo viaja en el
  request y manda; la primera pintura del server lee por rango (utc ± 1 día).
  Residuo aceptado: cerca de medianoche la primera pintura puede traer el look
  de ayer un momento. "Ponérmelo" del historial también manda su fecha local.

└ **"Tu clóset no alcanza" moría en silencio**: el veredicto de alcance corría
  en background (after()) y su respuesta se perdía en el vacío — el placeholder
  quedaba "generando" hasta el timeout de 150s. Ahora el veredicto se escribe
  al placeholder y el polling lo traduce a su pantalla con la lista de lo que
  falta. (Verificado por código y tipos; el clóset del QA sí alcanzó para
  ejercitarlo e2e.)

## [0.2.214.0] - 2026-08-10

### Fixed — confirmar las prendas te devolvía al veredicto

Roberto: *"después de que le doy click al CTA… me regresa a la imagen de mi look con los consejos, y le tengo que picar nuevamente"*.

**Faltaba un estado en el mapeo del wizard.** El flujo interno es `elegir → guardando → hecho → dibujando`, y `hecho` —el momento justo después de guardar— no estaba en la lista: caía al `: 1` por defecto y devolvía al paso 1. Peor todavía, el botón de "dibujarlas ahora" seguía existiendo pero enterrado al fondo de una pantalla que ya no era la suya, así que el flujo parecía haberse tragado la acción.

**Y el segundo clic desaparece.** Guardar y dibujar eran dos decisiones separadas —diseño mío— y Roberto lo leyó como falta de respuesta (*"o que se procese la acción"*). Tiene razón: al confirmar "sí, son mías" ya diste el permiso. El dibujo arranca solo al terminar de guardar, con guarda por ids contra el doble arranque, y el CTA del paso 2 pasa a declarar el trabajo entero: **"sumar y dibujar 3 · ~54s"** en vez de sólo "sumar al clóset". El botón manual se queda como red por si el arranque no prende.

Verificado en el navegador con foto real: paso 1 → 2 → 3 sin rebotes, y las fichas dibujadas a los ~16s sin tocar nada más.

## [0.2.213.0] - 2026-08-10

### Fixed — el espejo era barbero: elogio hueco y consejo vacío

Roberto, viendo su veredicto: *"siento está muy barbero el feedback"*. Medido sobre las **17 lecturas reales** de la base, no sobre esa captura:

| | |
|---|---|
| lecturas | 17 |
| **"así como estás, sales" como consejo COMPLETO** | **7 (41%)** — y las últimas 5, seguidas |
| con superlativo genérico ("de lujo", "perfecto"…) | 5 |

O sea que la fila de "mi consejo" no entregaba nada casi la mitad de las veces, y la de colores decía cosas que valdrían para cualquier outfit.

**La causa era mi propio prompt**, que lo pedía sin querer: *"Siempre hay algo bien en un outfit"* + *"si el look está bien, dilo y ya"*. El razonamiento de esa regla sigue en pie —inventar un defecto para parecer útil es peor, y una nota diaria a alguien inseguro es otro producto— así que la corrección **no es volverlo crítico**, es otra:

- **La prueba del elogio**: si la misma frase serviría para otro outfit, no sirve para éste. Lista explícita de frases prohibidas por vacías ("de lujo", "impecable", "te queda muy bien"…) y la obligación de nombrar la decisión concreta que funciona y por qué. *"El blanco junto a tu cara te levanta la piel"* es comprobable; *"te queda de lujo"* no.
- **El consejo nunca se queda en blanco con buenos modales**: si de verdad no hay nada que tocar, el hueco se usa para algo utilizable — hasta dónde sirve el look, qué NO tocarle y por qué, o cómo llevarlo mejor. Información, no un piropo más.

`ESPEJO_VERSION` a v3.

**Medido pareado sobre las MISMAS 5 fotos** (las guardadas en `outfits.photo_path`, mismo contexto, v2 contra v3):

| | v2 | v3 |
|---|---|---|
| consejos vacíos ("así como estás, sales") | 4 de 5 | **0** |
| superlativos huecos | 2 de 5 | **0** |

Y el cambio es de contenido, no de tono. Sobre la misma foto del traje: v2 decía *"te quedan de lujo… limpio y con carácter"* + *"así como estás, sales"*; v3 dice *"el blanco de la camisa pegado al cuello te limpia la cara, y el rojo de la corbata…"* + *"el nudo está un poco flojo, ajústalo hacia arriba… si vas a estar afuera, lleva algo para la llovizna"*. La misma amiga, mirando de verdad.

## [0.2.212.0] - 2026-08-09

### Fixed — el QA del espejo: el veredicto se saltaba solo, y dos botones negros

Roberto pidió que hiciera yo el QA del flujo nuevo en vez de entregarlo sin ver. Salieron **tres cosas**, y una era grave.

**1. El veredicto duraba lo que una petición.** `pasoWizard` salía del estado de la búsqueda de prendas, así que en cuanto ésta terminaba —unos segundos— la pantalla saltaba sola a "¿son tuyas?" y se llevaba por delante justo lo que la persona vino a leer. **Así es como lo descubrí: la captura del paso 1 no se podía tomar porque el paso 1 no duraba.** Ahora avanza sólo cuando ella lo pide, con el CTA que el handoff pedía: *"vi N prendas que no tienes →"*.

**2. Dos botones negros apilados** en el veredicto: el CTA nuevo y el "gracias" de siempre, los dos sólidos. "gracias" es sólido sólo cuando es la única acción —el veredicto sin prendas que ofrecer, donde cerrar es a lo que viniste—; con el CTA presente baja a *"terminar aquí"* discreto.

**3. Y el hallazgo de método**: los errores de parseo del dev server no se ven en `npm run build`. El espejo estuvo un rato sin renderizar —`</Capa>` huérfano de una edición a medias— mientras `tsc`, `build` y los 818 tests pasaban en verde, porque el build corría sobre el archivo ya arreglado y el dev server servía el roto. Pasé varias corridas culpando al arnés de Playwright. La consola del navegador lo dijo en una línea.

Verificado con la pantalla delante: hero a sangre con la foto, *"TE VEO / Básico bien hecho"* en serif itálica sobre el gradiente, filas hairline de colores y consejo, *"ya quedó en tu diario"*, y un solo botón fuerte.

## [0.2.211.0] - 2026-08-09

### Changed — el veredicto del espejo, como lo pedía el handoff

Corrección de rumbo. En 0.2.210.0 partí el espejo en tres pasos y describí lo que faltaba como "motion" — pero lo que faltaba era **la pantalla 2 entera**, que no construí: el handoff propone un hero a sangre con el veredicto encima y tres filas hairline, y yo dejé la disposición vieja (foto en tarjeta + párrafos sueltos) sólo repartida en pasos. Roberto lo señaló: *"no me quedó claro tu rechazo"*. No hubo rechazo, hubo omisión mal etiquetada.

Ahora sí: **hero de 46dvh a sangre** con la foto (`object-position 50% 18%`), gradiente inferior, rótulo del paso y cierre sobre la imagen, y el nombre del look en serif itálica sobre el gradiente. Debajo, **tres filas hairline** con icono — tus colores · el clima de hoy · mi consejo — en vez de cuatro bloques con cuatro tratamientos distintos. El `resumen` sale de esta pantalla ("nunca un párrafo que describa la prenda: ya es su foto"); el campo sigue vivo porque nombra la entrada del diario.

**Lo que el handoff pide y no existe**: la línea del hero se ejemplifica como un juicio (*"elegante sin que el color haga el trabajo"*) y ese dato no está en la lectura — los tres campos de opinión son justamente las tres filas. Se usa `titulo`, que ya se genera para el diario. Pedirle un campo más al modelo es lo que aquí no se hace a la ligera: añadir un campo al schema de un lector movió otras lecturas con z = 3.05 (medido sobre 425 prendas). Si el juicio de una línea vale la pena, se mide antes.

**SIN VERIFICACIÓN VISUAL.** Compila, tipa y pasa los 818 tests, pero el arnés de Playwright dejó de poder abrir el espejo tras varias corridas y no llegué a ver esta pantalla renderizada. Queda a revisión de Roberto antes de darla por buena — por eso no se deploya con este commit.

## [0.2.210.0] - 2026-08-09

### Changed — el espejo deja de ser un scroll largo y pasa a wizard de 3 pasos

Handoff `te_veo`. Roberto: la pantalla *"se sentía muy saturada y largas"*. Y lo era: el veredicto, la foto grande, las tres filas, las tarjetas de prenda **y** la rejilla de dibujos vivían en el mismo scroll — al llegar a confirmar prendas seguías arrastrando todo lo de arriba.

No cambia la máquina de estados, sólo **qué se pinta a la vez**: rótulo persistente *"paso N de 3 · nombre"*, y el veredicto (con su foto) se retira en cuanto empieza el trabajo de prendas. Mismo movimiento y misma cabecera que el carrete.

**El paso 3 se queda EXACTAMENTE como está**, por decisión de Roberto revisando el handoff — y por una razón que salió al comparar: el espejo ya tiene *"rehacer · no es mía"* por prenda, que es justo lo que el handoff pedía para "salió mal" (*"no descarta la prenda: reintenta el dibujo"*). Ni la propuesta de CD ni el carrete lo tienen — allá "salió mal" tira el render. En ese punto el espejo va por delante de los dos; copiarlos sería retroceder.

**Un defecto que sólo se vio al partir la pantalla**: abajo, *"gracias"* era el botón negro y *"sumar N al clóset"* el de contorno. En el veredicto está bien —cerrar **es** la acción principal, ya tienes lo que veniste a buscar—, pero en los pasos 2 y 3 la pantalla entera es sumar prendas y el botón más fuerte invitaba a abandonar el paso en curso. Fuera del paso 1, "sumar" pasa a sólido y la salida a *"terminar aquí"* discreto.

**Pendiente de decisión**: la línea de escaneo del loading (animación nueva, necesita token de motion) queda fuera hasta ver cómo se siente el resto. El explainer de primera vez y los motion del veredicto que retienen el CTA ~1.9s también quedan fuera — el flujo existe para gente con prisa.

## [0.2.209.0] - 2026-08-09

### Fixed — el terracota vetado sale del onboarding, y dos hex huérfanos van al token

Roberto, sobre cómo trabajo: *"cuando sea que te pongo un color que no va con el DS, tú dime y proponme algo en su lugar"*. Justo: en la versión anterior señalé el terracota y le devolví la decisión sin traer el reemplazo — eso es dejarle a él un trabajo que es mío.

**El cálido de la demo de colorimetría pasa a vino `#7d2b3d`.** Era terracota `#b6532f`, de la familia vetada, heredado del diseño anterior (`#c9563f`, comentado literalmente *"// terracota"*) y mantenido por el handoff: llevaba semanas de contrabando dentro de una pantalla del onboarding. Vino y no otro cálido por tres razones, escritas en el código: es inequívocamente ropa; rima con lo que el test **entrega** (`#8e1f3a` ya sale en las muestras de "tu paleta", tres bloques más abajo); y los otros candidatos fallaban — el café `#6f4a35` es seguro pero tan apagado que la demo deja de demostrar, y el oliva dorado `#8d6a2f` roza justo la familia vetada.

**Barrido de hex sueltos** en `app/` y `components/`: casi todos los que aparecían resultaron ser comentarios explicando decisiones, no color real. Los dos genuinos eran el mismo: `#E5E1DD` como relleno de una prenda sin imagen ni color, repetido en Hoy e Historial — un hex a un punto de `--c-line` (#e4e3e0) que nadie iba a mantener sincronizado. Va al token: es un hueco de la UI, no el color de una prenda.

## [0.2.208.0] - 2026-08-09

### Fixed — la portada de colorimetría parecía una pregunta, y dejaba contestarla

Handoff de diseño `colorimetria_intro` v2. Su premisa —que el par ilumina/apaga se leía como una pregunta más del onboarding— **está verificada por accidente**: mi propio recorrido automatizado del onboarding se atoró justo ahí, clicando "TE ILUMINA" y "TE APAGA" como si fueran las opciones a responder, y se quedó dando vueltas en la portada sin llegar al test.

Y era peor que parecerlo: los dos campos tenían `onClick` y tocarlos **invertía cuál favorece**. Se podía "contestar" que el frío te enciende — enseñando lo contrario de la verdad, porque cuál te favorece es un hecho sobre ti, no una elección.

Ahora el veredicto viene dado (✓ TE ENCIENDE / ✗ TE APAGA), la leyenda declara que es un ejemplo (*"es la misma persona — solo cambia el color de al lado"*) y **la única acción de la pantalla es el CTA**. Medido: dos tocables en total, el CTA y "ahora no".

**Dos correcciones que el handoff trae y verifiqué antes de aceptar:**

- **"cinco preguntas" era mentira.** Son seis (venas, sol, cabello, ojos, metal, cumplidos) — lo mismo que midió el recorrido de QA. El copy ya dice seis.
- **"tu metal" sí se entrega.** `metalForSeason` se pinta en el reveal, así que la promesa de las tres filas es comprobable y no marketing.

Las tiras de "familias de color" se van: explicaban un concepto en vez de vender el resultado. Y sobraba un lead: la pantalla arrastraba el párrafo serif del diseño anterior *y* el nuevo, dos leads apilados.

**Pendiente de tu decisión**: el tono cálido de la demo es terracota (`#b6532f`), y ámbar/terracota/naranja está vetado en la identidad. Viene heredado del diseño anterior (`#c9563f`, comentado *"// terracota"*), no lo introdujo el handoff. Queda señalado en el código; cambiarlo por un cálido fuera de esa familia es una línea.

**Lo que no se hizo**: el cross-fade lento entre las dos luces (marcado "opcional" en el handoff) — es una animación nueva y el DS obliga a preguntar antes de inventarla. Y cabe exacto en 390×844, pero **se desborda 126px en un iPhone SE (375×667)**: ahí hay que bajar para llegar al CTA. El handoff sólo contempla el tamaño grande.

## [0.2.207.0] - 2026-08-09

### Changed — el espejo pasa a pantalla completa

Decisión de Roberto, **contra mi recomendación** — queda escrito en el código porque el encuadre del módulo empuja al revés y conviene saber que se eligió a sabiendas. Mi objeción: el espejo es *"estoy vestida y salgo con prisa"*, y una hoja que se desliza y se va encaja con eso. Su argumento, que es bueno: el carrete ya es pantalla completa, y dos flujos que confirman prendas con **la misma tarjeta** no deberían vivir en dos registros distintos.

Lo que gana de verdad, y esto sí es objetivo: el paso de confirmar prendas es largo —una tarjeta por prenda, con chips y editores— y en una hoja con `max-h: 92dvh` eso era scroll dentro de scroll, exactamente lo que se arregló en el carrete hace dos versiones. Ahora las dos pantallas con trabajo dentro (recortar por acompañada, y mirar/confirmar) usan el mismo contenedor: pantalla completa, scroll propio, pie fuera del scroll.

**El error se queda como hoja**, y no por descuido: es un aviso de una línea con un botón. Pantalla completa para decir *"no pude leer la foto"* convierte un tropiezo en un acontecimiento.

Verificado en el navegador con foto real: la capa cuelga de `BODY`, ocupa 0→844, sin `items-end`, y el veredicto se lee entero con las prendas debajo.

## [0.2.206.0] - 2026-08-09

### Changed — las capas del espejo también nacen portadas

Preventivo, no reparador — y la distinción importa: **medido, el espejo NO estaba confinado**. Se monta desde el home de Hoy y no tiene ni un ancestro con transform, así que sus tres capas a pantalla completa se dibujaban bien.

Van portadas igual porque el mismo patrón explotó **dos veces en dos días** por la misma causa: el recortador dentro de la hoja del carrete, y el wizard de carga dentro del drawer de la tab bar. Un `fixed inset-0` se resuelve contra el ancestro transformado más cercano, y basta con mover el botón de "¿me veo bien?" al drawer —el sitio natural para una acción diaria— para reproducir el bug exacto. Verificado tras el cambio: la capa cuelga de `BODY` y ocupa el viewport entero.

La regla del proyecto queda escrita en el código: **toda capa a pantalla completa nace portada al `body`**.

## [0.2.205.0] - 2026-08-09

### Fixed — el wizard de carga salía "metido abajo" al abrirlo desde la tab bar

Roberto lo fotografió en su teléfono: el paso 1 del wizard asomando en una franja bajo su look, en vez de cubrir la pantalla.

Es la **misma lección del recortador, un día después**. El flujo de carga se monta desde cuatro lugares, y uno —el drawer de "más"— es hijo de la tab bar, que lleva un `translate`. Un ancestro con transform se vuelve el bloque contenedor de los `fixed` de sus hijos, así que el `fixed inset-0` del wizard se resolvía contra la caja de la barra. Ya estaba escrito en la memoria del proyecto (*"el translate de la tab bar confina los fixed de sus hijos"* — el bug del drawer que no cerraba); el Overlay nuevo de ayer no se protegió.

**Portado al `body` con `createPortal`**, igual que el recortador: da igual quién lo monte. El error del modo headless va por el mismo portal — mismo hueco en miniatura. Verificado midiendo: el overlay cuelga de `BODY` y ocupa 0,0 → 390×844, el viewport exacto.

## [0.2.204.0] - 2026-08-09

### Added — el cierre de la carga y el conjunto que contesta (tanda 3)

**La pantalla de "listo".** Antes el flujo se esfumaba a idle y el clóset aparecía cambiado sin que nadie dijera qué pasó. Ahora: anillo ✓, "+N a tu clóset", las miniaturas de lo que entró —las piezas de un conjunto con su subrayado— y, si ataste un traje, la frase que lo dice. CTA único: "ver mi clóset".

**El badge de conjunto contesta.** Ya existía como etiqueta muerta; ahora tocarlo resalta a sus compañeras (anillo, ~1.6s) y un toast nombra al par: *"saco azul marino + pantalón azul marino"*. El tap en el resto del tile sigue abriendo la ficha.

### Fixed — dos bugs que la propia prueba destapó

**El guardado mataba su propia pantalla de cierre.** El flujo de carga vive dentro del bloque de clóset-vacío, que el servidor QUITA en cuanto tienes fotos propias — y `addPhotoItems` revalida `/closet` desde el servidor. Resultado: el primer guardado real de un usuario nuevo desmontaba el bloque con el wizard adentro, y el "listo" moría en el mismo frame en que nacía (verificado: la base pasó de 15 a 17 prendas y la pantalla nunca existió). El bloque ahora queda **montado pero oculto**: no pinta nada, pero sus flujos viven hasta terminar. El mismo desmonte silencioso mataba el aviso del tope de 60 prendas.

**Los hints ya no disparan sobre un target tapado.** Al sobrevivir el "listo", el tip de *"desde aquí le sumas más ropa"* salió ENCIMA del cierre — atenuando un flujo vivo para señalar un botón que ni se veía ni se podía tocar. Ahora el coach-mark comprueba con `elementFromPoint` quién está de verdad arriba: si su target está bajo una capa, cede el turno sin marcarse visto, y vuelve en la próxima visita con la pantalla despejada. Vale para cualquier hint frente a cualquier overlay, no sólo este caso.

Verificado de punta a punta en el navegador: subir la foto del traje → chips → atar → generar renders → validar → guardar → pantalla de listo con el conjunto nombrado → clóset → tap al badge → anillo + toast → se apaga solo.

## [0.2.203.0] - 2026-08-09

### Changed — el "leyendo tus fotos" enseña su trabajo

Tanda 2 del handoff de la carga. Antes era un spinner con "2/3 fotos"; ahora cada foto lleva su **palomita** al terminar y un spinner encima mientras se lee, la **barra** avanza, y los nombres leídos van cayendo en vivo bajo *"encontré hasta ahora"* — la espera se vuelve el avance de la pantalla siguiente. Verificado en el navegador a media carga: "1 de 3 fotos · Saco azul marino · Pantalón azul marino" con la primera foto palomeada y las otras dos girando.

**La "línea de escaneo" del handoff no está, a propósito**: sería una animación nueva y el DS obliga a preguntar antes de inventar una. El spinner sobre la foto pendiente —patrón que ya existe en todo el proyecto— comunica lo mismo.

El paso de "generando" no se tocó: ya cumplía (grid que se llena prenda por prenda, contador).

## [0.2.202.0] - 2026-08-09

### Changed — confirmar prendas: chips tocables y el traje que se ve atado

Segunda y tercera pieza del handoff de la carga (la primera fue el duplicado lado a lado, 0.2.201.0).

**Chips tocables.** La tarjeta de confirmar ya no se abre entera. Antes el carrete pintaba el formulario completo por prenda —siete secciones siempre visibles— y el espejo lo escondía todo tras un "afinar" que también lo abría entero; las dos formas fallaban igual: para corregir UN campo había que atravesar seis sanos. Ahora cada prenda es una fila con chips que **dicen el valor actual** (tipo · color con su punto · formalidad · "+ más" punteado) y tocar uno abre SOLO su editor. En tipo, color y formalidad **elegir cierra** — la corrección típica es un tap. En "+ más" (cómo le queda, largo, material, patrón, marca y talla) cierra el botón "listo", porque son varios campos opcionales y cerrarse al primero obligaría a reabrir por cada uno.

Los campos que el modelo marcó inseguros llevan **borde warning en su chip**, y el primero arranca con su editor abierto — sustituye al viejo "se abre entera cuando hay algo dudoso", que enterraba lo dudoso entre lo sano. Apagada la prenda: nombre tachado y chips fuera.

**El traje se ve atado.** El modelo de conjunto ya existía (`attrs.conjunto`, 12 prendas en prod); lo que no existía era VERLO — atabas el traje con la casilla y las dos tarjetas seguían pintadas como prendas sin relación. Ahora las piezas del mismo conjunto viven en un contenedor con cabecera ("mismo traje · N piezas") y **"separar"**. Separar solo quita la relación y es reversible: la pregunta de "¿son un traje?" vuelve a aparecer, que es el "volver a unir".

**Divergencia del handoff, deliberada**: el handoff detecta el conjunto solo ("misma tela en la misma foto, las dejo juntas"); aquí se sigue PREGUNTANDO. `lib/par-de-traje.ts` tiene escrito el porqué — la visión no distingue "misma tela" con fiabilidad, y solo el dueño sabe si son traje. La pregunta cuesta un tap; un auto-atado equivocado cuesta un conjunto falso que el motor respeta.

Verificado en el navegador con una foto compuesta (blazer + chinos del propio handoff): la visión los leyó como saco + pantalón casual-formal y la pregunta NO salió (correcto: chinos no son traje); corrigiendo la formalidad a "Formal" **vía el propio chip**, la pregunta apareció, atar pintó el contenedor, y separar la trajo de vuelta.

## [0.2.201.0] - 2026-08-09

### Changed — el duplicado se decide viendo las dos fotos, no adivinando

Primera pieza del handoff de diseño de la carga. Antes el aviso de "creo que ya la tienes" era una tira con una miniatura de 40×32 **recortada** y un solo botón, "no sumarla". Dos problemas: comparar una foto recortada induce error —el recorte esconde justo el detalle que distingue una camisa de otra— y "no sumarla" es media decisión, dice qué NO hacer y no qué sí.

Ahora las dos imágenes van **completas y del mismo alto** (`object-contain`, nunca crop), rotuladas *EN TU FOTO* / *YA EN TU CLÓSET*, con la pregunta y **dos botones en el mismo bloque**. Resuelto, colapsa a una línea con ✓.

**La regla de datos se implementó sin destruir nada.** El handoff pedía que "es la misma" reemplazara la imagen de catálogo por la foto real. Al ir a hacerlo apareció que en `pickItemImage` **la imagen del arquetipo gana sobre todo**, así que para que mande la foto habría que romper el vínculo al catálogo — irreversible, y un "es la misma" mal picado dejaría la prenda sin ficha para siempre. En vez de eso, una bandera (`attrs.preferir_foto`) invierte la prioridad: `archetype_id` sigue intacto y deshacer es quitar la bandera.

La decisión se **apunta y se aplica al guardar**, no al picar: en el paso de confirmar la foto todavía no está subida, así que antes no hay a qué apuntar — y nada debe escribirse en el clóset hasta que se confirme la pantalla entera.

**Sobre el token `arena` (#efeae0) del handoff**: no se agregó. El bloque usa `accent-soft`, que ya existe, y la señal de atención la da un filete `warning` — el mismo recurso del veredicto del juez del avatar. No se inventa un token para un aviso.

## [0.2.200.0] - 2026-08-09

### Changed — el carrete deja de ser un drawer y pasa a ser una pantalla

Lo propuso Roberto viendo la hoja de *"¿Cuáles son tuyas?"* montada encima de su look: *"igual sería mejor que no se viera como drawer sino como su propia pantalla"*. Tenía razón, y el argumento de fondo es que **lo que vivía dentro de esa hoja no era una hoja: era un wizard de cinco estados** (explainer → revisar → analizando → confirmar → guardando), con N prendas × 3 decisiones y scroll. Una hoja promete "corto y desechable", que es justo lo contrario del momento en que se construye tu clóset.

Y el proyecto ya tenía el patrón correcto: el **wizard de avatar** es pantalla completa con "paso 1 de 3". Dos tareas del mismo tipo estaban en dos registros, y la que vivía en la hoja era la más larga de las dos. Ahora comparten lenguaje: barra de progreso, "paso N de 3" y botón atrás.

Lo que se arregla de paso, todo visible en su captura:

- **la franja de la pantalla de atrás asomando arriba** —un *"hoy Traje marino de gala"* cortado a la mitad— que no daba contexto sino ruido;
- **el scroll dentro de scroll**;
- **el pie pegajoso rebanando las tarjetas**: era `sticky bottom-0` DENTRO del área con scroll, con 4px de separación y fondo opaco. Ahora vive fuera del scroll, con su hairline. Medido: el área que hace scroll termina en 767px y el pie empieza en 767px — se tocan, no se pisan.

**Lo que no cambió, a propósito**: el menú de entrada (*varias de golpe · la biblioteca · una prenda*) sigue siendo una hoja, porque un menú sí es del tamaño de una hoja. Lo que se volvió pantalla es el wizard. Y se puede seguir saliendo en cualquier momento sin perder lo hecho, que era lo bueno del drawer.

**El costo, dicho**: en los pasos cortos —"revisa tus fotos" con dos fotos— ahora sobra pantalla, porque la hoja se encogía al contenido y una pantalla mide lo que mide. El loader se centra (`my-auto`) para no quedar pegado arriba; los pasos con pocas tarjetas quedan pendientes de pulir.

## [0.2.199.0] - 2026-08-09

### Fixed — el recortador salía DEBAJO de la hoja que lo abría

Roberto lo fotografió probando el multiupload: la hoja de *"revisa tus fotos"* y, asomando por abajo, la barra del recortador (*"cancelar · recorta a tu prenda · usar"*) con su tira de fotos. Dos capas a pantalla completa visibles a la vez, y el recortador inservible.

**La causa, doble.** `ImageCrop` se renderizaba DENTRO de la hoja, y ambos pedían `z-50`: un descendiente no puede pintarse por encima del contexto de apilamiento de su ancestro por mucho que empate el z-index. Y encima la hoja lleva una animación con `transform`, que mientras corre se convierte en el bloque contenedor de los `fixed` de sus hijos y encierra al recortador dentro de la caja de la hoja. Es la misma lección que ya costó el drawer que no cerraba.

**El arreglo va en el componente, no en los tres sitios que lo usan**: `ImageCrop` se porta a sí mismo al `<body>`, así deja de depender de dónde lo monten y quien añada un cuarto uso no tiene que enterarse. Sube a `z-[75]`, que es la grada correcta — el proyecto apila 50 para hojas normales, 60/70 para las de pantalla completa (viaje, try-on, cartera) y 80 para los hints; el recortador siempre se abre desde una hoja que sigue viva detrás, así que tiene que ganarles a todas.

Verificado reproduciendo el flujo: el recortador cuelga de `BODY`, ocupa los 390×844 completos, y el hit-test en cuatro puntos de la pantalla —arriba, centro, abajo y esquina— devuelve el recortador en los cuatro.

## [0.2.198.0] - 2026-08-09

### Fixed — el mazo del swipe arrancaba con seis cartas del mismo palo

Roberto insistió en algo que yo había descartado: que las primeras cartas se sienten todas iguales. Tenía razón, y medido es peor de lo que él lo planteó.

Las **seis primeras** —minimalista, casual sin esfuerzo, clásico elegante, preppy, sastre, smart casual— son todas del cluster pulido/clásico. Y **el mazo no se baraja**: ese arranque monótono era idéntico para todo el mundo, siempre. Las polarizantes vivían al fondo (y2k 23, gorpcore 24, coquette 24) y **`de-salir` era la 27 de 27** — la última. Esa carta se añadió el 2026-07-31 justamente porque Tatiana señaló que faltaba el eje "marca la silueta": el parche al hueco estaba puesto donde menos se ve, y quien abandonaba a media tanda no lo veía nunca.

**Ahora el mazo rota entre familias** (limpio → calle → suave → brillo → retro → limpio…). Dentro de cada familia se respeta el orden curado del archivo, así que una carta nueva sólo se une a la rotación de la suya.

| | antes | ahora |
|---|---|---|
| tags distintos en las 10 primeras | 18 | **21** |
| cartas del cluster pulido en las 10 | 6 | **3** |
| streetwear | 7ª | **2ª** |
| color protagonista | 15ª | **4ª** |
| glam de noche | 20ª | **9ª** |
| de salir | **27ª** | **14ª** |

**Un intento fallido queda documentado en el código** para que nadie lo repita: un greedy de "la carta que menos tags comparta con lo ya visto" no sirvió (19 tags contra 18, y `de-salir` seguía en la 27) porque a media lista todo solapa con todo y el criterio se apaga.

**Lo que NO se hizo, y es deliberado.** Roberto también propuso podar el mazo con los primeros 10 swipes: si la dirección se ve clara, dejar de mostrar los estilos descartados. Un mazo que se poda con su propia hipótesis deja de medir — las cartas que quedan sólo pueden confirmarla, y después no se puede distinguir *"no le gusta"* de *"nunca le apareció"*. Es el mismo error que el comparador pareado existe para evitar. Reordenar da la calibración rápida que busca sin cobrar ese precio.

Con guarda en tests: si alguien vuelve a dejar 5+ cartas del mismo palo entre las 10 primeras, o entierra `de-salir` pasada la posición 18, falla.

## [0.2.196.0] - 2026-08-09

### Fixed — con tu look del día hecho, la home quedaba inalcanzable

Roberto: *"después de que generó un outfit no tengo una forma de ir a la homescreen"*. Cierto, y el agujero era estructural: `/hoy` tiene dos pantallas —la home (`idle`: saludo, card contextual, **checklist de activación**, espejo, añadir) y el look (`ready`)— y al abrirla con look del día entraba directo en el look. El único `setState({kind:"idle"})` de todo el archivo es al salir del wizard **y sólo si no hay look**. O sea: en cuanto generabas, la home desaparecía el resto del día.

Lo caro no es la navegación: es que **con ella desaparecía el checklist de "qué sigue"** (avatar → prendas → estilo → silueta → cápsula), la superficie diseñada para activar a alguien nuevo — justo después del momento que más lo engancha.

**Dos puertas, ninguna inventada.** El título **"hoy"** del look ahora es un botón (es el nombre de la sección; tocarlo lleva a su home, la convención del logo de siempre, sobre pixeles que ya estaban ahí sin hacer nada). Y **tocar la pestaña "Hoy" estando en Hoy** hace lo que todo el mundo intenta por instinto. Mismo trato en el header de escritorio.

**Sobre usar el botón negro** (lo preguntó Roberto): no. El ✨ significa *"hazme un look"* — es el único botón que produce valor, y volverlo ambiguo con "y también te lleva a inicio" lo empeora.

**Y la home no puede mentir cuando ya hay look**: el titular pasa de *"tu look de hoy, aún no"* a *"listo"* con su nombre, y el CTA de *"armar mi look de hoy"* a **"ver mi look"** — volver a la home no puede disparar una generación pagada.

**Dos trampas que sólo aparecieron midiendo en el navegador**, no leyendo el código:
1. Next **no remonta** el componente cuando sólo cambia el query, así que `?inicio=1` cambiaba la URL y no la pantalla. Hace falta reaccionar al cambio, no leerlo al montar.
2. Limpiar el query con `history.replaceState` desincroniza el router de Next del address bar: la prop no cambia, el efecto no vuelve a dispararse y **la segunda pulsación dejaba de funcionar**. Va por `router.replace`.

Verificado con tres idas y vueltas seguidas por la pestaña y una por el título, sobre un look sembrado y borrado al terminar.

## [0.2.195.0] - 2026-08-09

### Fixed — el wow regeneraba encima de looks que ya existían

Roberto, probando el flujo: generó sus outfits, se fue a hacerse el avatar y el try-on, y al volver le salió otra vez la misma pantalla generando de cero. La base le da la razón — 15:17 dos outfits, 15:22-15:28 el avatar, y a las 16:36 otros tres.

**La guarda existía pero preguntaba lo que no debe.** Condicionaba a `onboarding_step >= 5`, que se escribe al FINAL de todo en `/api/generate` — después de generar, juzgar y registrar. Los outfits, en cambio, se guardan MIENTRAS se transmiten. Entre una cosa y otra hay una ventana en la que la persona ya tiene sus looks y la base sigue diciendo "paso 4". Su primera corrida murió justo ahí: guardó 2 outfits y no llegó a la cola. Él los vio —el cliente los muestra igual— pero la página los ignoró al volver. Ahora la condición es *¿ya tiene looks?*, que aguanta cualquier forma de morir a medias: el juez que truena, el timeout, la pestaña que se cierra.

**Y se cierra el paso al reanudar**, que era la mitad que faltaba. Sin eso el arreglo empeoraba las cosas: el onboarding se da por completo en el paso 5, así que con el paso en 4 pulsas "entrar a la app", `/hoy` te rebota al wow, y otra vez — para siempre. Lo que rompía ese bucle era precisamente la regeneración que se acaba de quitar.

**Cuántas veces ha pasado: una.** Medido comparando el primer outfit contra el cierre del paso 5 en todos los perfiles; el único hueco mayor a tres minutos es ése, de 78. No es una fuga sistemática. Y nadie está atrapado ahora mismo.

**Por qué murió aquella corrida sigue sin saberse** — sólo iba a la consola. Se reconstruyó por lo que FALTABA, y eso dice que algo se rompió, nunca qué. Ahora el error queda escrito en la base (`generation_failed`, migración 0130).

### Changed — el retrato del avatar se dibuja mientras contestas, no después

Idea de Roberto. El orden era fotos → 20s de spinner → retrato → complexión y estatura → otros 20s → avatar. Ahora las preguntas se contestan encima de la primera espera.

**No es sólo tapar el hueco.** El cuerpo va anclado al retrato aprobado, así que no puede empezar antes: esos segundos son serie inevitable y las preguntas son la única pieza movible del flujo. Contestadas antes, el cuerpo arranca en el instante del *"sí, soy yo"* en vez de dos pantallas después.

**Cuánto es:** 20.5s medidos (16.6 de Gemini + 3.7 del juez). **n = 1** — de 53 generaciones sólo una trae reloj porque la instrumentación es nueva, así que es orden de magnitud, no número fino. A quién le sirve: de 26 perfiles, 20 no tienen estatura.

**Lo que no arregla:** si pides ajustes al retrato, esas regeneraciones siguen siendo espera pelada. El ahorro se cobra una vez.

**Que un fallo no se coma lo que llenaste:** la generación en fondo no toca la pantalla ni al empezar ni al fallar. Verificado en el navegador — la generación devolvió 502 a los 4s y la persona no se movió del formulario; el error salió al pulsar continuar.

### Changed — el onboarding dice qué va a pasar, y suelta las preguntas que lo alargaban

Roberto, entrando desde cero. Cinco cosas.

**Nadie le decía qué hacer antes de los swipes.** La primera carta aparecía sin decir que se desliza ni para qué sirve. Va una línea en la pantalla misma, no una pantalla de preámbulo: un prólogo cobra tiempo y no da nada, y anunciar *"son 5 pasos"* hace que se sienta más largo. La barra ya dice cuánto falta; faltaba **qué ganas**.

**La calibración sale del onboarding.** Eran tres pantallas más justo antes del paso que paga. No se pierden: son LAS MISMAS preguntas de `/closet/capsula/editar`, que ya es un paso del checklist de activación del home — o sea que ya vivían fuera, sólo que además se preguntaban dentro.

**Y no vuelven a preguntar por color.** Medido sobre 4 perfiles reales: **9 de 12** preguntas generadas eran de color, dos citando la estación (*"dentro de tus neutros de otoño profundo"*) que el quiz determina DESPUÉS. La causa estaba en el prompt: prohibía "colorimetría base" —que el modelo leyó como "preferencias de color sí"— y encima ponía *"un color fuerte vs neutros"* como EJEMPLO de buena pregunta.

**El paso de básicos dice qué son**, en vez de leerse como un catálogo que hay que llenar entero.

### Added — /admin/basicos

Curar qué prendas ve alguien nuevo en *"¿qué ya tienes?"*. Manda sobre `onboarding_subset`, la misma columna que filtra el onboarding: nada de lista paralela. Enseña los dos números que importan (unisex+hombre, unisex+mujer) y no el total, que sería el dato bonito y equivocado — prender diez prendas de mujer no le cambia nada a él.

A la primera carga: **48 para un hombre, 53 para una mujer**. La spec dice ~15.

## [0.2.194.0] - 2026-08-09

### Fixed — el paso de los cortes: el CTA mentía, el título salía dos veces y nadie decía para qué

Roberto, rehaciendo el onboarding desde cero. Tres cosas, y las tres ciertas.

**El CTA prometía otra cosa.** Decía *"Sigamos con tus colores"* y lo que seguía eran los pares de corte — y después las preguntas de calibración. Los colores estaban **tres pasos más allá**. La etiqueta se escribió cuando el siguiente paso sí eran los colores y al meter los pares nadie la cambió. Ahora dice *"Ahora, cómo te queda"*.

**Dos títulos apilados.** La página pintaba *"paso 1 de 5 · ¿te gusta o no?"* siempre, y los pares traían el suyo debajo. La cabecera ahora vive dentro del deck y desaparece en cuanto cede el turno — también en el reveal, donde igualmente sobraba.

**Y no decía para qué sirve.** *"Es la misma ropa — cambia cómo queda"* describe la pantalla, no el motivo. Ahora: *"Con esto sé si buscarte cortes ajustados o sueltos en cada look que te arme"*.

**Sobre si debería ser su propia sección**, como pidió Roberto: tiene razón en el fondo — `fit_pref` entra **directo al contexto del motor**, igual que la colorimetría, así que es una entrada de primera clase escondida como cola del paso de gustos. Se le da cabecera propia (*"cómo te queda · 1 de 2"*) y su porqué. Lo que no se hace es partirlo a otra pantalla: son dos taps, y una navegación entera para cuatro segundos cobraría más de lo que cuesta.

### Fixed — la app le hablaba de vos a alguien en México

Cazado de paso en la misma corrida: el arquetipo salió *"**tenés** ese don de moverte entre lo clásico y lo atrevido"*. Voseo rioplatense en un producto mexicano.

El prompt ya decía *"Tuteo"* y no bastaba: el modelo lo lee como *"informal"* y se va al voseo. Ahora es explícito — *"tienes", jamás "tenés"; "tú", jamás "vos"*. Medido sobre 4 generaciones: **0 con voseo** (antes salía en la primera), y la misma frase ahora dice *"tienes ese don"*.

## [0.2.193.0] - 2026-08-08

### Fixed — la entrada del diario sabía menos de lo que la app había visto

Roberto, mirando una entrada: *"no aparecen todos los thumbnails, solo de dos prendas y no de todas"*.

Tenía razón, y **no era el emparejador** — probado contra su clóset real, empareja las cuatro. Las miniaturas sólo pueden enseñar prendas que **existen como fila**: las emparejadas con su clóset y las que sumó. Lo que la foto leyó pero no cayó en ninguna de las dos —su playera y su pantalón caqui— no tiene a qué apuntar, así que desaparecía.

Y lo peor: **la app sí lo sabía**. El consejo empieza describiendo el outfit entero —*"chamarra de campo azul marino, playera oscura, pantalón caqui y tenis blancos"*— y esa lista se tiraba sin guardarse en ningún lado. La entrada terminaba sabiendo menos de lo que la app había leído un segundo antes.

Ahora el resumen se guarda (migración 0129, idempotente) y la entrada dice **"Traías: …"** con el outfit completo, aunque sólo la mitad tenga miniatura. Nada de lo que la app vio se pierde.

## [0.2.192.0] - 2026-08-08

### Fixed — QA del espejo: dos bugs que se veían como "no cargó"

Manejando el flujo completo en el navegador con una foto real inyectada en el selector de archivos. Los dos salieron en la **primera** corrida.

**El 503 intermitente de la visión no se reintentaba.** Gemini devolvió `503 Unable to process input image` sobre una foto perfectamente sana, la lectura de prendas murió y apareció *"se me atravesó algo"*. El reintento manual funcionó **a la primera** — o sea que la persona vio un error que no existía.

El generador de imágenes ya reintentaba 429/5xx desde hace tiempo; los **tres** caminos que LEEN fotos, no. Y en el carrete el mensaje era peor: *"no detecté prendas en esas fotos, prueba con fotos donde la ropa se vea bien"* le echa la culpa a la foto de la persona por un tropiezo del servidor.

El reintento va en la puerta común para que lo hereden los tres. Una sola vez y con pausa corta —dos fallos seguidos ya no son un tropiezo— y nunca sobre un 400, donde lo que está mal es la petición.

**La foto se aplastaba a 2 píxeles.** A ojo parecía que no había cargado; midiendo el recuadro apareció la causa: la hoja es un flex en columna, y en cuanto abajo salen las prendas que sumar el contenido pasa de 747 a 985 px. Flex aprieta lo único que puede —la foto— y la dejaba en una raya.

Lo peor es cuándo: **desaparecía justo en el caso normal**, cuando SÍ hay prendas nuevas que enseñar. Verificado tras el arreglo con el mismo flujo: 359 px de alto con 1367 px de contenido.

## [0.2.191.0] - 2026-08-08

### Added — "no es mía" al final del espejo

Roberto, mirando el último paso: *"aquí ni sé si faltan opciones al igual que al final del flujo del multiupload"*. Sí faltaba una:

| al final del multiupload | al final del espejo |
|---|---|
| es mía | implícito (ya la confirmó) |
| **no es mía** | ❌ **faltaba** |
| salió mal | ✅ |

Y no sobra por haberla confirmado antes: **confirmar un nombre en una lista y reconocer una prenda dibujada son dos juicios distintos** — por eso el carrete separa los dos momentos. Hasta ahora, darse cuenta aquí obligaba a ir al clóset a buscarla y borrarla.

Borra la prenda (borrado suave, como en el clóset) y vuelve a colgar el look sin ella: si no, la entrada del diario quedaría apuntando a una prenda que ya no existe.

Y dos detalles de la misma pantalla: los dos botones dicen **rehacer** y **no es mía** —viven pegados y tienen que distinguirse por lo que HACEN, no por lo que describen— y con una sola prenda la rejilla deja de partirse en dos columnas, que dejaba medio hueco vacío leyéndose como si faltara algo.

## [0.2.190.0] - 2026-08-08

### Added — el espejo también avisa si sale alguien más

Cierra el último hueco de la comparación con el multiupload: **los dos flujos ya tienen los mismos pasos.**

Sin esto, una foto de espejo de un cuarto de hotel con alguien al fondo se leía entera y su ropa entraba como tuya. Lo único que lo cazaba era que lo notaras en la lista.

Se cuenta a la gente **antes de leer nada**, igual que el carrete, y si hay más de una la pantalla se para y ofrece recortar. Con salida para seguir sin recortar, a propósito: el conteo se equivoca a veces (un reflejo, un póster) y bloquear a alguien porque el modelo vio dos personas donde hay una sería peor que el problema. Lo que no puede pasar es que se lea la ropa de otro **en silencio**.

**Medido sobre sus tres fotos de espejo reales, dos corridas cada una:**

| | |
|---|---|
| interrupciones falsas | **0 de 6** |
| retraso que añade | **1.6 s** de promedio |

O sea: no molesta cuando sale solo, que es el 99% de las veces, y el segundo que cuesta se lo come la subida de la foto.

### Los dos flujos, ahora

| | multiupload | espejo |
|---|---|---|
| recortar si sale alguien más | ✅ | ✅ |
| leer las prendas | mismo lector | mismo lector |
| ¿ya la tienes? | avisa | filtra, y se puede desmentir |
| confirmar cada prenda | misma tarjeta | misma tarjeta (cerrada) |
| dibujar | obligatorio | opcional |
| "salió mal" | ✅ | ✅ |

Las dos diferencias que quedan son las únicas que estaban justificadas desde el principio: en el espejo estás saliendo de tu casa, no sentado catalogando.

## [0.2.189.0] - 2026-08-08

### Added — "salió mal", el paso del carrete que al espejo le faltaba

Roberto: *"no entiendo por qué no lo hacemos igual que con el multiupload… yo veo el flujo casi igual"*.

Tiene razón, y comparados paso por paso contra el código se parecen mucho más de lo que parecía. Al espejo le faltan **dos** pasos del carrete:

| | multiupload | espejo |
|---|---|---|
| recortar si sale alguien más | ✅ y dice cuánta gente ve | ❌ |
| leer las prendas | mismo lector | **el mismo** |
| ¿ya la tienes? | avisa | filtra, y se puede desmentir |
| confirmar cada prenda | misma tarjeta, abierta | **la misma**, cerrada |
| dibujar | obligatorio | opcional |
| **"es mía / no es mía / salió mal"** | ✅ | ❌ |

Y **lo que estaba justificado era poco**: que la tarjeta arranque cerrada y que dibujar sea opcional, porque ahí estás saliendo de tu casa y no sentado catalogando. Los otros dos no tenían razón de ser — simplemente no los había construido.

El del veredicto es el que costó caro: **es el paso que habría cazado el suéter deforme**. En el carrete lo ves dibujado y le das *"salió mal"*; en el espejo se quedaba tal cual. Ahora cada dibujo lleva su **"salió mal — rehacer"** y redibuja sólo ése.

Queda pendiente el recorte + el aviso de personas, que es el otro hueco real: en una foto de espejo de un hotel puede salir alguien más, y ahí no hay nada que lo cace.

## [0.2.188.0] - 2026-08-08

### Fixed — la pose no es parte de la prenda

Roberto: *"¿cómo se genera la imagen a partir de la foto que cargo, vs cómo lo hacemos con el multiupload? Ahí según yo sí lo hace bien"*.

**El camino es idéntico** — las dos puertas llaman al mismo `/api/render-prenda` con la foto y la descripción. Lo que cambiaba era **la descripción**, y se ve en lo que quedó guardado de su suéter:

> *"Suéter de punto fino de color azul marino, **llevado sobre los hombros**, con mangas largas dobladas de forma natural…"*

El lector describe lo que **ve**, y ahí veía una pose. El render la copió fielmente: un tejido a medio caer, fiel a la foto e inútil como imagen de catálogo. En el carrete casi nunca pasa porque la ropa va extendida o puesta normal — pose y prenda coinciden. En una foto de espejo, con la chamarra al hombro, dejan de coincidir.

Ahora el prompt del render dice explícitamente que **cómo esté puesta la prenda en la foto no es parte de la prenda**: colgada del hombro, atada a la cintura, doblada en el brazo, medio quitada, fajada o arremangada — se ignora y se presenta como producto, extendida y simétrica, como si se acabara de quitar.

**Va en el prompt del render y no en el del lector, a propósito.** Tocar el lector mueve otras lecturas —medido: z = 3.05 al añadirle un solo campo, sin cambiar una palabra del texto— y esa deriva se paga en el motor. Este prompt no alimenta ninguna lectura: sólo dibuja.

Verificado con **su misma foto y su misma descripción** (la que dice *"llevado sobre los hombros"*): sale un suéter de cuello redondo extendido y simétrico.

## [0.2.187.0] - 2026-08-08

### Added — poder desmentir el empate, y verlo en grande

Roberto, probando: *"debería poder ver en grande los thumbnails y confirmar o no si es correcto lo que leyó"*.

Tiene razón y era el hueco más serio de los tres: los emparejamientos se le presentaban **como hechos**. Si me equivoco al decir *"esto ya lo tienes"*, no sólo cuelgo una prenda ajena de lo que se puso hoy — **deja fuera la de verdad, y no había forma de sumarla**.

Ahora cada fila lleva **"no es ésa"**. Lo descuelga del look y pasa lo que la foto leyó a la lista de nuevas, para que pueda sumar la correcta. Sin esa segunda mitad el desmentido sería sólo una queja.

Y se toca para **verla en grande** (el visor de siempre): con un recuadro de 9×11 px no se puede decidir si ésa es la prenda que traes puesta, que es justo lo que se le está preguntando.

### Fixed — el recuadro en blanco

*"No apareció uno de los thumbnails."* Era una prenda recién sumada que todavía no se había dibujado. Ahora sale **su color** en vez de un hueco: un recuadro vacío se lee como un error de la app, no como *"aún no tiene foto"*.

### Nota — por qué el suéter salió raro

*"La imagen del suéter de punto quedó de renderaje raro."* Cierto, y la causa no se arregla con un modelo mejor: en esa foto el suéter iba **colgado del hombro**, no puesto. Imagen→imagen copia lo que ve, así que produjo fielmente un tejido a medio caer — fiel a la foto e inútil como imagen de catálogo.

Es el límite real de dibujar desde la foto, y rehacerla no ayudaría: partiría de la misma imagen. La salida sería un *"dibújala desde cero, sin mi foto"* que caiga a texto→imagen —genérica pero limpia—. No se construye todavía: primero hay que ver si pasa seguido o fue el caso de una noche.

## [0.2.186.0] - 2026-08-08

### Fixed — la misma prenda salía fiel o genérica según cuándo la dibujaras

Roberto, sobre acelerar el render: *"vamos con la segura mejor, manteniendo la calidad y consistencia del multi upload"*.

**El modelo no se toca** — sigue el mismo del carrete. Pero buscando esa consistencia apareció una grieta de verdad:

| quién dibuja | cómo | modelo |
|---|---|---|
| el carrete, y el espejo si le das *"dibujarlas ahora"* | imagen→imagen, desde tu foto | pro |
| el clóset, cuando le toca dibujarlas después | **texto→imagen, desde el nombre** | flash |

O sea: la misma prenda salía **fiel si la dibujabas en el momento y genérica si lo dejabas para luego**. Y el camino lento era el que se elige teniendo prisa, que es cuando menos se va a volver a mirar.

La causa: esas prendas entran **sin foto** a propósito, así que al clóset no le quedaba de dónde copiar.

**Ahora la foto de origen viaja con la prenda**, guardada aparte de `photo_path`. Aparte y no en la columna natural, por dos motivos concretos: esa columna decide la MINIATURA (sin render, el clóset enseñaría tu cuerpo entero como si fuera la prenda), y además cuenta como *"ya tiene imagen"* en la guarda del auto-sanado, que entonces no la dibujaría nunca.

Verificado con una prenda real: el dibujo diferido tardó **18.5s** — el tiempo de imagen→imagen, no los ~7s del texto. Mismo camino, mismo modelo, dibujes cuando dibujes.

## [0.2.185.0] - 2026-08-08

### Fixed — el dibujo del espejo disparaba sin tope

Roberto preguntó cómo ganar tiempo en el render *"no sé, sin paralelo, sin sacrificar calidad"*. **Ya iba en paralelo** —dos prendas son ~18s, no 36— pero con un `Promise.all` suelto, sin límite.

Es la lección que el carrete ya pagó y que aquí no heredé: disparar N renders a la vez pega el rate-limit de Gemini, y cada 429 deja una prenda sin foto. Con dos prendas da igual; con ocho no. Ahora usa el mismo pool de 4, para que las dos puertas se comporten igual bajo carga.

### Nota — la decisión de velocidad que sigue siendo suya

El archivo del render lleva anotado desde el 2026-08-06 que hay un modelo de imagen 2.5× más rápido, y que *"el cambio NO se hace de oído: lo decide Roberto viendo los renders"*. Su pregunta es exactamente ese momento, así que se midió otra vez con una prenda que **sí tiene detalle que preservar** (su chamarra militar, misma foto y mismo prompt):

| | |
|---|---|
| `gemini-3-pro-image` (el de hoy) | 16.6 s |
| `gemini-3.1-flash-image` (el rápido) | **6.5 s** |

Los dos salieron buenos. El pro se ve más de catálogo; el flash muestra algo más de construcción (botonadura, puños) y más caída natural en las mangas. **No puedo decir que el pro sea mejor** — pero es una sola prenda, y hoy ya me equivoqué una vez concluyendo de una muestra chica. El modelo NO se cambia hasta que Roberto elija.

## [0.2.184.0] - 2026-08-08

### Added — dibujarlas ahí mismo, y desde tu foto

Roberto: *"debería darme la opción de generar ahí las imágenes, no forzar a después, igual así evalúo si quedan fieles o no, como en el flujo del multi upload"*.

Las dos mitades importan, y **la segunda más**: no es sólo adelantar el dibujo, es poder **juzgar si se parece**. Dejándolo para el clóset, un render infiel se descubre días después y hay que ir a buscarlo. Es justo lo que el carrete hace —te enseña lo que dibujó y decides— y aquí faltaba.

Tras sumar aparece **dibujarlas ahora** con su tiempo estimado, y la rejilla se llena conforme llegan. Sigue siendo opcional: si tienes prisa, el clóset las dibuja después como hasta ahora.

**Y salen de tu foto, no de su nombre** (imagen→imagen, el mismo `/api/render-prenda` del carrete). Con la prenda delante el modelo copia el corte y el color reales en vez de inventar un *"suéter azul marino"* genérico.

**Medido con honestidad**, sobre su playera azul marino recién sumada:

| | |
|---|---|
| desde su foto (imagen→imagen) | 18.3 s |
| desde el nombre (texto→imagen) | 7.2 s |

Y en una prenda **lisa los dos resultados son indistinguibles**. El beneficio no es universal: aparece cuando la prenda tiene algo que preservar —el caso de sus botas Columbia, donde imagen→imagen conservó el logo, el zigzag y la suela gris, y el nombre habría dado una bota negra cualquiera—. Se elige imagen→imagen igual, por consistencia con el carrete y porque nunca es peor; pero los 11 segundos extra en un básico son reales y aquí quedan dichos.

Falla hacia adelante y con reintento: la que no salga se queda para el clóset, que es exactamente donde estábamos antes.

## [0.2.183.0] - 2026-08-08

### Added — la foto de la prenda que creo que ya tienes

Roberto: *"sería bueno que también ponga el thumbnail de las prendas que asume que ya tengo"*.

Es el mismo argumento que ya valía en el carrete y que aquí había perdido: *"creo que ya tienes unos mocasines café"* no le dice a nadie si son **esos** mocasines. Con la imagen delante, un empate equivocado se ve; sin ella, esa prenda no entra a su clóset nunca y él no se entera de por qué.

Se firman **después** de emparejar y sólo las emparejadas —dos o tres— en vez de las 138 del clóset entero, que era el motivo por el que no venían.

### Fixed — "les dibujo su foto en un momento" no decía cuándo ni dónde

Roberto: *"aquí no entendí en qué momento va a renderizar las nuevas"*. Con razón.

La prenda entra sin imagen a propósito —dibujar dos son ~35s y ahí está saliendo de su casa— y el **clóset** la dibuja solo, pero únicamente cuando se abre esa pantalla. Prometer un dibujo que ocurre en otro sitio, sin decir cuál, es una promesa que no se puede ver cumplir.

Ahora dice *"les dibujo su foto cuando lo abras"* y ofrece **ir**. Verificado contra sus dos prendas recién sumadas: las dos están en el estado exacto que dispara el dibujado (sin imagen de ningún tipo, `render_status` en `none`, `source` photo), así que la promesa era cierta — sólo faltaba decirla.

## [0.2.182.0] - 2026-08-08

### Fixed — "No sumé nada": el alta reventaba entera

Roberto: *"cuando le piqué añadir, me puso algo así como que no se pudo añadir. O sea, falló"*.

**`items.render_status` es NOT NULL con default `'none'`**, y yo mandaba `null`. El insert moría y el flujo decía *"No sumé nada"* sin más.

Lo peor es dónde estaba el error: en el comentario que escribí yo hace dos horas, *"el auto-sanado sólo recoge las que están en `none` (render_status nulo)"*. `'none'` es un **string**, no NULL — son dos cosas distintas y la base sólo acepta una. Escribí la explicación correcta y el código equivocado. El tipo ya no admite `null`, así que no puede repetirse.

Verificado contra la base en las dos direcciones: con `'none'` entra y guarda; con `null` truena con exactamente ese error.

### Added — marca y talla también al dar de alta

Roberto: *"todavía no aparece el campo para añadir la marca y la talla"*.

Estaban sólo en la ficha del clóset. La objeción que las dejó fuera sigue en pie —quince prendas por dos campos de texto es la fricción de catalogar que este producto existe para no tener— pero viven **dentro de "afinar"**, que arranca cerrado: quien lo abrió ya decidió corregir esa prenda, y negárselas ahí es mandarlo a la ficha a repetir un viaje que ya venía haciendo.

### Fixed — la tarjeta del espejo enseñaba su cuerpo entero, cuatro veces

En el carrete cada prenda viene de una foto distinta y la miniatura dice de cuál. En el espejo **todas salen de la misma foto**: repetir su cuerpo entero en cada fila no identifica nada, sólo llena la pantalla. Ahora ahí manda el color leído, que es lo único que distingue una fila de la siguiente.

Y *"afinar"* deja de ser un enlace subrayado suelto —que es lo que hacía ver el paso a medio terminar— y pasa a ser un botón con su borde, como el resto.

## [0.2.181.0] - 2026-08-08

### Changed — una acción, dos llamadas

Roberto: *"¿por qué no hacemos dos llamadas distintas, una que haga lo de la evaluación y otra lo del reconocimiento de imágenes, que es lo que ya tenemos, para no entorpecer el prompt inicial?"*.

**Eso ya era así.** `/api/espejo` evalúa con el modelo bueno y su propio prompt; `/api/espejo/prendas` reconoce con **exactamente el mismo `leerPrendas` del multiprenda**. Separadas desde el primer día, justo por lo que él dice: mezclarlas costaría lo que ya se midió — añadir un campo al schema de un lector mueve otras lecturas con **z = 3.05**, y seguía moviéndolas sin tocar una palabra del prompt.

Lo que faltaba es la otra mitad de su frase, *"para acción, dos cosas"*: el reconocimiento vivía detrás de un enlace (*"¿hay algo aquí que no esté en tu clóset?"*) y si no lo tocabas, la entrada del diario se quedaba sin prendas para siempre.

Ahora **las dos arrancan con la misma acción**, en paralelo. Medido con su foto real:

| | |
|---|---|
| evaluación (sonnet) | 4.7 s |
| reconocimiento (gemini) | **2.7 s** |
| en paralelo | 4.7 s |
| si fueran en serie | 7.4 s |

El reconocimiento termina **2 segundos antes** que el consejo: cuando la respuesta aparece, la lista de prendas ya está. En tiempo de espera sale gratis.

Y siguen siendo independientes: si el reconocimiento falla, el consejo sale igual y aparece un reintentar. Las prendas que ya son suyas se cuelgan solas del look —no hay nada que confirmar en algo que ya está en su clóset— y las nuevas siguen pidiendo confirmación antes de entrar.

## [0.2.180.0] - 2026-08-08

### Fixed — los thumbnails del espejo NO PODÍAN salir nunca

Roberto, con la pantalla delante: *"le piqué lo de las prendas, esa chamarra de hecho no la tengo, no vi que hiciera el proceso… está muy sloppy, y tampoco aparecen los thumbnails"*. Tenía razón en todo, y el bug de fondo era mío y certero.

**`ITEM_IMAGE_SELECT` no incluye `id`.** Ocho llamadas del repo lo saben y escriben `` .select(`id, ${ITEM_IMAGE_SELECT}`) ``; las dos que escribí ayer y hoy lo omitían. Sin el id, supabase devuelve las filas sin él y el `fila.id ?? String(i)` de al lado rellenaba con el **índice del arreglo**: las prendas reconocidas se colgaban del look con ids `"66"` y `"7"`, y la acción que las guarda los descartaba por no existir.

O sea que los thumbnails no podían aparecer **nunca**, y sin un solo error en ningún lado — sólo una entrada del diario vacía. Hay un test nuevo que caza a cualquiera que vuelva a pedir ese select sin id.

**Y el mensaje mentía.** *"No pude distinguir las prendas en esta foto"* salió sobre una foto donde el propio consejo acababa de nombrar cuatro (chamarra militar, playera, pantalón khaki, tenis). Verificado releyendo su foto real: la visión lee las cuatro en 3.2s. El fallo era otro —un tropiezo del servicio— y el `catch` lo tragaba entero, convirtiendo "falló ahora, reinténtalo" en "esta foto no se deja leer", que es lo único que no se puede reintentar. Ahora se registra la causa y aparece un **reintentar**.

### Fixed — el título del diario era un párrafo

La entrada se llamaba *"Chamarra tipo militar en azul muy oscuro, playera del mismo tono debajo, pantalón khaki y tenis blancos."* — el resumen entero, en la serif grande, al lado de looks que se llaman *"Blazer con oficio"*.

El resumen sirve para demostrar que miró la foto; para nombrarla hacía falta otra cosa. Ahora pide un título de dos o tres palabras. Con su misma foto: **"Casual de ciudad"**.

Y la pestaña *"las prendas"* deja de aparecer cuando no hay ninguna colgada: llevaba a una retícula vacía.

## [0.2.179.0] - 2026-08-08

### Added — la entrada del espejo se ve como un look

Idea de Roberto: *"cuando se extraigan las prendas, independientemente de que las tenga o no las tenga, que repliquemos el UI del generador de outfit — la foto de la persona con el outfit y junto los thumbnails"*. Y el porqué que da después es el bueno: *"si yo quiero ver mi historial, pues hay cosas que yo me puse y hay cosas que hice y no me puse"*. Las dos clases de entrada tienen que poder mirarse igual, o el diario son dos diarios.

**Las piezas ya existían sin parecerlo**: el empate contra el clóset ya se calculaba —para no proponerle sumar lo que ya tiene— y se tiraba el `id`, quedándose sólo con el nombre. Con ese id, la entrada se cuelga de sus prendas y el detalle la pinta con el mismo `TryonView` de siempre: su foto grande y los thumbnails al lado.

Se cuelgan **dos cosas**: las prendas suyas que la foto reconoció (en cuanto se saben, sin esperar a que sume nada) y las que dé de alta desde esa misma foto.

**Y lo que de verdad compra va más allá de lo visual.** Hoy *"me lo puse"* es por outfit y se usó **12 veces** en toda la historia del proyecto. Con esto, cada foto dice qué **prendas** se puso de verdad — la señal de oro, por prenda, sin pedirle que vote nada.

Un empate equivocado aquí cuesta una miniatura mal puesta en el diario; auto-crear una prenda equivocada cuesta ropa fantasma en el clóset para siempre. Por eso esto sí se hace solo y aquello sigue pidiendo confirmación.

### Fixed — dos botones que le habrían borrado su foto

Los cazó una entrada de prueba sembrada para mirar la pantalla. En una entrada del espejo había **dos** caminos para generar un try-on: el de `TryonView` y el CTA del pie (*"verme con este look"*).

Los dos escriben `tryon_path`, y al resolver la imagen **el try-on gana sobre la foto**. O sea que cualquiera de los dos le habría cambiado su foto real por un avatar dibujado, sin avisar y sin vuelta atrás. En una entrada del espejo no hay nada que imaginar: ya se lo puso.

Y dos textos que mentían: la pestaña decía *"así te queda"* (es cómo **saliste**, no cómo te quedaría) y el subtítulo enseñaba la clave interna — *"8 ago · espejo"*, ahora *"8 ago · me lo puse"*.

## [0.2.178.0] - 2026-08-08

### Added — la marca y la talla, donde de verdad sirven

Roberto explicando para qué las quiere: *"tengo dos playeras similares, pero una es de Express y otra es de Uniqlo, y me ayuda a llevar referencia de que son diferentes"*. Y acotando el alcance él mismo: *"ni la marca ni la talla van a afectar la generación, pero a la persona le van a ayudar de 'ah, ok, ya sé qué playera era ésa'"*. Exacto — y eso decide dónde tienen que aparecer.

**En el clóset, debajo del nombre.** Ese momento de *"¿cuál era cuál?"* pasa mirando la rejilla, entre dos miniaturas casi idénticas — no dentro de una ficha que ya abriste. Guardar el dato y esconderlo ahí sería pedirle que lo escriba para nada. Sólo aparece si lo escribió.

**En el aviso de "creo que ya la tienes".** *"Ya tienes Camiseta blanca"* no dice **cuál**, así que no se puede saber si la nueva es repetida o es la otra. Con *"Camiseta blanca · Express"*, sí. El aviso no decide: le da lo que necesita para decidir él.

**El formato de la talla cambia con la prenda**, también suyo: *"para sacos o trajes es 42, 44, 50; para calzado tiene un formato, para playera tiene otro"*. El campo sugiere el que toca y sigue a la categoría que elijas. Es un **ejemplo, no una validación** — también su criterio: *"la persona lo puede poner como sea, al final de cuentas es una referencia"*. Las tallas reales son un desastre (US, EU, MX, letras, 32x34, talla única), y un campo que rechace lo que dice la etiqueta de SU prenda estaría equivocado él, no ella.

**Y la marca separa dos prendas que se llaman igual**, igual que ya lo hacía el material. Con marcas distintas, el detector deja de avisar: son dos prendas de verdad.

Con una honestidad sobre su alcance: esa regla **casi nunca puede dispararse hoy**, porque la visión no lee marcas (2 de 336 prendas) y la nueva llega sin ella. Es correcta y estará ahí cuando el dato exista, pero lo que resuelve el caso de Roberto **hoy** es verla en el clóset y en el aviso. La ausencia de marca nunca cuenta como "marca distinta" — si contara, el detector se apagaría en silencio casi siempre.

## [0.2.177.0] - 2026-08-08

### Fixed — ahora se dice qué NO te propuse y por qué

Roberto: *"no sé si las cosas que no detectó es porque ya las tengo o porque no las detectó"*.

El espejo filtraba en silencio. Si leía cinco prendas y descartaba tres, aparecían dos sin ninguna explicación — y **tres cosas muy distintas** (ya la tienes / no la vi / la vi mal) se veían exactamente igual desde su lado.

Ahora lo descartado se dice, **con el nombre de la prenda tuya con la que lo emparejé**: *"Pantalón de lino beige → Pantalón de lino"*. No es un adorno: es la única forma de que un empate equivocado se pueda ver. Si son dos pantalones de lino distintos y no lo nombro, esa prenda no entra a su clóset jamás y él nunca se entera de por qué.

### Added — marca y talla, opcionales, en la ficha

Idea de Roberto. **Sí, pero no en la carga**, y eso es toda la decisión.

Son los dos únicos atributos que ningún modelo puede leer: medido, la visión capturó marca en **2 de 336** prendas de foto (las Columbia, por el logo), y la talla vive en una etiqueta por dentro — no está en ninguna foto, nunca. O sea, tecleo manual siempre.

Pedirlas al dar de alta —quince prendas por dos campos de texto en un teléfono— es exactamente la fricción de catalogar que mató al alfa de Replit y que este producto existe para no tener. En la ficha, en cambio, tienes el zapato en la mano y no hay prisa.

**No las lee el motor, a propósito.** Nada entra al prompt sin medirse: la marca es señal de estilo de verdad (un Meermin no es un zapato café cualquiera), pero eso se prueba con el instrumento pareado, no de oído. Hoy su consumidor es la persona mirando su propia prenda — un consumidor legítimo, a diferencia de los campos que se escriben y no lee nadie.

Y un desbordamiento que se cazó midiendo, no a ojo: sin `min-w-0`, un input no baja de lo que mide su texto de ejemplo, y *"Uniqlo, Massimo Dutti…"* empujaba la talla **32px fuera** de la ficha.

## [0.2.176.0] - 2026-08-08

### Fixed — el espejo confirmaba CERO campos y el carrete siete

Roberto, mirando lo que acababa de shippear: *"pero a ver, justo se reusa mucha de la lógica que hicimos hace rato a la hora de cargar multiprenda y además detectar si hay duplicado"*.

Tenía razón, y el hueco era peor de lo que suena. Medido: **el carrete confirma 7 campos editables; el espejo confirmaba 0.**

Las *libs* sí se reusaban —leer la foto, el aviso de duplicado, el alta—, pero la **pantalla donde la persona corrige** no: al espejo le escribí una lista propia de nombre, color y una casilla. Y al revés de como debería ser: la foto de espejo es el **peor** insumo que recibe el producto (oclusión, luz de ambiente, prendas a medio ver), o sea justo la que más necesita poder corregirse, y era la única sin nada que corregir.

Es el bug de siempre con otro disfraz —dato leído, guardado, usado por el motor, invisible e incorregible— sólo que esta vez lo construí el mismo día que lo estaba arreglando en otra pantalla.

**Ahora las dos puertas usan la misma tarjeta** (`components/prenda-draft-card.tsx`), con sus siete campos, su paleta de vecinos y su aviso de duplicado. Y lo que corriges en el espejo viaja como confirmado, igual que en el carrete: es el mismo contrato porque es el mismo componente.

**En modo compacto**, que es lo que la hace caber ahí: arranca cerrada con un *"afinar color, tipo y material"*. Saliendo de tu casa, exigirte siete campos por prenda convertiría un favor en un trámite — pero la puerta existe. **Y se abre sola** cuando el modelo declara baja confianza o marca campos inseguros: esconder justo lo que hay que revisar sería quedarse con lo peor de las dos formas.

**El carrete no cambia.** El cuerpo de la tarjeta se movió byte a byte: 228 líneas idénticas y 17 nuevas, todas del modo compacto. Sin `compacta`, arranca abierta — exactamente como estaba.

## [0.2.175.0] - 2026-08-08

### Added — el espejo también te llena el clóset

Idea de Roberto: aprovechar la misma foto para sumar las prendas que todavía no estén.

**Por qué vale la pena aunque la foto sea mal insumo para catalogar**: el enemigo declarado del proyecto no es combinar ropa, es la fricción de catalogar el clóset. Si vestirte lo va llenando, ese problema se resuelve **viviendo**.

Tras el consejo aparece una línea discreta: *"¿hay algo aquí que no esté en tu clóset?"*. Lee la foto, descarta lo que ya tienes y te propone sólo lo nuevo, marcado por defecto.

**Tres cosas que NO hace, y cada una por su motivo:**

- **No va en el mismo schema del espejo.** Medido esta mañana: añadir un campo al schema de un lector mueve otras lecturas con **z = 3.05**, y seguía moviéndolas sin tocar una palabra del prompt. Pedirle al espejo que además liste prendas degradaría el consejo, que es su trabajo. Va como llamada aparte, igual que el contador de prendas y el de personas.
- **No corre sola.** Sería una llamada de visión diaria por persona para algo que la mayoría de los días no aporta nada — te pones lo que ya tienes.
- **No suma nada sin que lo marques.** Una foto de espejo tiene oclusión, luz de ambiente y prendas fuera de cuadro; y con la misma camisa tres veces por semana, el alta automática llenaría el clóset de duplicados en un mes.

**El filtro es el de "creo que ya la tienes"**, calibrado contra la base real, usado al revés: en el carrete avisa, aquí descarta. El caso es otro — ahí estás catalogando y quieres verlo todo; aquí ya te vestiste, tienes prisa, y proponerte sumar la camisa blanca que llevas puesta desde junio es ruido que enseña a ignorar la función entera.

**Verificado contra el clóset real de Roberto** (138 prendas): de cuatro prendas leídas en una foto, emparejó y descartó su pantalón de lino y sus tenis blancos, y propuso sólo las dos que de verdad no tenía.

### Fixed — "sin dibujar todavía" dejó de ser lo mismo que "falló"

`addPhotoItems` sólo aceptaba `done` o `failed`. El espejo suma prendas sin pararse a dibujarlas (cinco renders son ~85s y ahí la persona está saliendo de su casa), y marcarlas `failed` las habría dejado **sin imagen para siempre**: el auto-sanado del clóset sólo recoge las que están en `none`. Ahora acepta `null`, y esas prendas se dibujan solas después.

## [0.2.174.0] - 2026-08-08

### Added — "¿me veo bien?": le enseñas cómo saliste vestida y te contesta

Idea de Roberto, y la primera entrada del producto que **no viene de la app**: los 177 outfits de la base los generó ella misma (`daily`/`viaje`/`capsula`). Nada había entrado nunca desde la vida real.

**No es una evaluación, y esa es la decisión de fondo.** Una app que te califica sin que se lo pidas te está juzgando, y la usuaria de esto es gente con crisis frente al clóset: si el tono se va un grado, se construye algo que le dice a alguien inseguro, cada mañana, qué hizo mal. Aquí ella **pregunta** y la amiga **contesta**. Misma foto y mismo consejo, contrato emocional opuesto — y el momento también: ya estás vestida y a punto de salir. Ése es el instante en que alguien saca el teléfono; *"documentar mi outfit del día"* es una tarea, y las tareas no se sostienen.

**Contesta tres cosas, y las tres se pagan HOY, sin un día de historial:**

- **Tu colorimetría sobre ESE outfit** — qué te hace a la cara lo que traes cerca de ella. Se expresa igual que en el motor (favorecen / apagan, y los neutros fuera de la balanza) para que las dos voces del producto no se contradigan: si el motor te pone un gris y aquí se te critica, la app discute consigo misma delante de ti.
- **El clima de tu día** — *"va a llover y sales sin nada encima"*. Sin dato de clima, el campo se omite entero en vez de inventarse el día.
- **UN ajuste** que puedas hacer ahora sin cambiarte. Si no hace falta tocar nada, lo dice: *"así como estás, sales"*.

**Lo que deliberadamente NO hace**: empatar la foto contra tu clóset. Es lo que más magia da y lo que más se equivoca, y un error visible a diario quema la confianza rápido. Y *"oye, siempre andas de azul"* necesita un mes de datos: prometerlo el día 1 sería vender lo que no se tiene.

**Queda en tu diario, marcado como puesto.** Nace con `favorited_at` porque no es una propuesta: es lo que de verdad te pusiste — la señal de oro que el resto del producto persigue a duras penas. En el historial reusa el hueco de la imagen grande (es lo mismo que el try-on, pero real) y lleva su sello: *"Me lo puse"*.

**Medido con cuatro fotos reales antes de shippear.** Lo correcto en los cuatro: el negro sobre invierno *"te queda increíble"*, el gris sobre primavera *"te apaga un poco"* con alternativa, las rayas azules declaradas fondo (*"no te apagan ni te levantan"* — la regla de los neutros funcionando), lluvia sin abrigo → aviso, 31°C con playera → *"vas fresca"*, y sin clima → campo omitido. 4-7s por respuesta.

Corre en el modelo rápido y no en el motor: es la única llamada del producto pensada para repetirse **a diario y para siempre**, y con Opus un hábito que funcione es justo lo que rompería la factura.

## [0.2.173.0] - 2026-08-08

### Added — "hay una versión nueva, recarga"

Sale de una investigación que no debió existir. Roberto reportó que al subir un chaqué y un traje gris claro **tampoco** le preguntó si eran conjunto — el mismo síntoma que se había arreglado 13 minutos antes.

**El arreglo sí servía.** Reconstruida su tanda real de las 12:01 —ahora se puede, porque la foto de origen ya se guarda— y pasada por el código nuevo, salen las dos preguntas: *"Saco de traje gris y pantalón de traje gris son un traje"* y *"Saco de chaqué gris oscuro y pantalón de traje gris oscuro son un traje"*. Lo que corría en su teléfono era el JavaScript de antes del arreglo.

**Y no había forma de saberlo sin excavar en la base de datos.** La app nunca decía qué versión traía. Es un caso normal, no raro: quien prueba una app tiene la pestaña abierta desde hace rato, y una pantalla ya cargada se queda con los trozos de JavaScript que bajó al abrirse.

Ahora la versión va **horneada en el bundle del navegador**, y se compara con la que el servidor tiene en ese momento. Si difieren, aparece una barra arriba de todo. Eso es un hecho comprobable —"el código que estás viendo correr es viejo"— no una corazonada.

**Avisa, no recarga sola**: recargar en medio de una carga de doce fotos tiraría varios minutos de trabajo, que es arreglar un problema creando uno peor. Se puede cerrar.

**Pregunta al abrir y cada vez que la app vuelve al frente.** Ese segundo momento es el que cuenta en una PWA instalada: se vuelve a ella horas después, justo cuando el bundle lleva más tiempo rezagado.

**Y es conservador a propósito** (`hayVersionNueva`, con casos): sólo avisa con dos versiones de verdad y distintas. Un fallo de red o un despliegue raro no pueden convertirse en *"tu app está vieja"* — a la tercera barra falsa nadie le vuelve a creer, y ahí el aviso queda inservible para cuando importe.

`/api/version` es público, como el resto de la información que ya va horneada en el JavaScript: pedirle sesión lo volvería inútil justo en la pantalla de entrar.

## [0.2.172.0] - 2026-08-08

### Fixed — subir dos trajes de una vez hacía que no preguntara por ninguno

Reportado por Roberto en vivo, **y diagnosticado por él**: *"cargué una foto donde salgo con jaquet y otra donde salgo con un traje gris, y en ninguna me preguntó lo de si eran conjunto… no sé si el bug fue que se cargaron dos cosas con conjunto en la misma tanda"*. Era exactamente eso.

Confirmado contra su tanda real de esta mañana (10 prendas, una sola carga): una chaqueta de cuero, el esmoquin completo y un traje gris cruzado. **Dos sacos.**

**La causa es una frase que escribí yo.** La pregunta *"¿el saco y el pantalón son un traje?"* se calculaba sobre la tanda **completa**, y la guarda decía: con dos sacos la pregunta tiene cuatro respuestas posibles, mejor no preguntar. El efecto perverso: **entre más trajes subes de una vez, menos te pregunta** — justo al revés de lo que debería.

**Y la ambigüedad que temía nunca existió.** Cada prenda sabe de qué foto salió, y **un traje se lleva puesto en UNA foto**. Dentro de su foto, el saco del esmoquin y el pantalón del esmoquin son el único par posible. Agrupar por foto no relaja la guarda: la aplica donde de verdad significa algo. Dos sacos en la **misma** foto siguen sin preguntarse, que es el caso genuinamente ambiguo.

**Las casillas ahora dicen cuál traje es.** Antes sólo podía haber una y *"el saco y el pantalón"* bastaba; ahora pueden salir dos o tres en la misma pantalla, y sin nombres marcar la correcta sería adivinar.

Los datos de Roberto ya estaban bien: ató los dos trajes a mano desde la ficha. Esto es para que no haya que hacerlo a mano otra vez.

## [0.2.171.0] - 2026-08-08

### Added — te aviso si en esa foto sale alguien más

Retoma la idea de Roberto del 2026-08-07 (*"que detecte quién es la persona y saque las prendas de esa persona"*), que quedó sin decidir porque la conversación pivoteó al traje y ahí se quedó.

**El hueco, verificado**: el lector de varias prendas mira la foto y lista TODA la ropa que ve. Si subes una foto donde sales con alguien más, lista la ropa de los dos y te ofrece la camisa de tu amigo como tuya. Lo único que lo tapaba era que lo notaras — o que hubieras recortado antes, y el recorte era una pregunta genérica idéntica en todas las fotos (*"¿sale alguien más en alguna?"*), que es la clase de aviso que se aprende a ignorar porque siempre está. El *"no es mía"* del final sí lo caza, pero para entonces ya se generó y se pagó el render de ropa ajena.

**Ahora el aviso va sobre LA foto que lo necesita** y antes de leer nada: la miniatura se marca con cuánta gente sale y el botón de recortar se enciende. Con doce fotos, *"en alguna sale alguien más"* obliga a buscarla, y buscar es justo lo que nadie hace.

**Y reacciona**: al recortar se vuelve a contar, así que el aviso desaparece si el recorte bastó — y se queda si no. Un aviso que no responde a lo que hiciste no se distingue de un aviso roto.

**No es reconocimiento facial, y esa es la decisión de fondo.** Contar no es identificar: no se compara ninguna cara con ninguna otra, no se guarda nada de la foto, y las caras de la gente que sale contigo —que nunca dio permiso para nada— no se analizan. Quién eres de las dos lo dices tú al recortar, que además acierta el 100% de las veces. La idea original pedía biometría; esto entrega el resultado sin ella.

**Es una llamada aparte**, como el contador de prendas: medido esta mañana, añadir un campo al schema del lector mueve otras lecturas con z = 3.05, y seguía moviéndolas sin tocar una palabra del prompt. Preguntando aparte, la deriva es cero por construcción.

**Medido antes de confiar en él** (`scripts/personas-en-foto.ts`, 3 corridas por caso): **15/15** en la decisión de avisar y 15/15 en el conteo exacto, sobre prendas extendidas, una persona, dos y tres.

Un caso se ganó su lugar por un error mío: el primer banco pegaba dos fotos de la **misma** modelo con outfits distintos, el modelo contestó "1" tres de tres veces y lo conté como fallo. No lo era — es una persona, fotografiada dos veces. Quedó como caso fijo porque es exactamente el selfie de espejo, donde avisar sería avisar de más y el aviso se gastaría solo.

## [0.2.170.0] - 2026-08-08

### Fixed — segundo pase: la trampa que se armó sola esta mañana

Roberto pidió otro doble check. El hallazgo principal lo causó el cambio de hace un rato, y es el tipo de bug que sólo aparece cuando dos piezas correctas se juntan.

**Renombrar una prenda y aceptar rehacer su imagen te devolvía la misma prenda equivocada.**

Tres piezas, cada una razonable por su cuenta:

1. Esta mañana `visual` —la descripción que escribe la visión al leer la foto— empezó a guardarse.
2. El generador de imagen le hace **más** caso a esa descripción que al nombre: es su Capa 2, si hay descripción, manda.
3. Al cambiar el nombre, la ficha ofrece rehacer la imagen.

Júntalas y sale el caso literal de Roberto: tenía un abrigo guardado como *"Blazer marrón de lana"*, lo corrigió a *"Abrigo de lana marrón"*, aceptaría la oferta… y la descripción vieja, que dice **blazer**, volvería a dibujar un blazer. Corriges, aceptas, y no cambia nada.

Ahora corregir el nombre o el color **tira la descripción vieja**: describía la prenda como el modelo la entendió, y si corriges lo que la prenda **es**, esa descripción dejó de valer. Se cae a la Capa 1 (nombre + atributos), que es como se renderizaba hasta ayer — se pierde detalle, no se gana un error. Y con la foto original delante, el detalle lo pone la imagen.

La regla vive en `descripcionObsoleta` (`lib/garment-desc.ts`) con sus casos: es del dominio, no pegamento de una pantalla.

### Fixed — se firmaba el doble de URLs de las que se muestran

`itemPrivatePaths` devolvía las dos candidatas (render y foto) y `pickItemImage` sólo usa una. Mientras 5 prendas en toda la base tenían foto original eso no costaba nada; desde hoy **toda** prenda del carrete guarda las dos, así que abrir el clóset iba a pedirle a Storage el doble de URLs firmadas, y la mitad de imágenes que nadie muestra (el render siempre gana). Ahora se deriva de `pickItemImage`, así que no se puede desincronizar.

### Added — cuánto tarda dibujar, antes de comprometerse

El paso de generación hace una imagen por prenda (~17s, de cuatro en cuatro) y **no se puede cancelar**. Con 12 fotos se puede llegar a 96 prendas: siete minutos mirando una barra sin salida. El número ya estaba en el botón; faltaba lo único que lo hace decidible. Se avisa a partir de 15 prendas.

## [0.2.169.0] - 2026-08-08

### Fixed — el doble check del alta de prendas: cuatro huecos, medidos

Roberto: *"hemos hecho bastantes fixes a esa parte del proceso, dale un double check para ver si no hay otras mejoras que nos falten o huecos"*. Se auditó contra la base real, no a ojo. Salieron siete; cuatro se arreglan aquí y tres quedan en su mesa (abajo).

**1. "Rehacerla" no usaba la foto original — el dato de ayer no tenía un solo consumidor.**

Ayer se empezó a guardar la foto de origen, y el commit prometía tres puertas: comprobar de qué foto salió un render raro, volver a leer la prenda con un modelo mejor, y **regresar a la fuente cuando el dibujo sale mal**. Esa tercera no existía: el botón que arregla un dibujo equivocado seguía yendo por texto→imagen.

No es un matiz. Describir la prenda en palabras **pierde** la prenda — hay mil cortes de saco negro y *"saco negro"* no distingue ninguno. Con la foto delante, el modelo copia el corte, el color y los detalles reales.

Verificado con una foto real (las Columbia): del piso de madera, con unas botas blancas y una puerta en el encuadre, salió el flat-lay de catálogo con el logo, el zigzag, la suela gris y las agujetas moteadas intactos. 16.8s.

El prompt de extracción vivía dentro de `app/api/render-prenda`; se sacó a `lib/extraer-prenda.ts` en vez de copiarlo — habría sido la cuarta copia del mismo prompt en el repo.

**2. La descripción visual se tiraba: 0 de 325 prendas la conservan.**

Al leer una foto, la visión escribe una descripción detallada (*"bomber de nylon negro mate, cierre metálico frontal, puños acanalados"*). Es lo que hace fiel al **primer** render — y no se guardaba. Cualquier render posterior partía sólo del nombre, así que la imagen del clóset sólo podía **empeorar** con el tiempo. Ahora se guarda como `visual`, que es el campo que el generador ya sabía leer.

**3. Lo que corriges en el alta ya cuenta como confirmado.**

La pantalla de confirmación del carrete es la revisión más fuerte de toda la app —prenda por prenda, campo por campo— y **no se registraba nada**: al motor le llegaba igual una prenda repasada a mano que una que nadie miró. Ahora los campos que **tocas** se marcan como tuyos. Sólo los tocados: todo viene preseleccionado, así que dejarlo como está no es confirmar, es no haber mirado.

**4. El tope por lote era silencioso.**

`addPhotoItems` cortaba en 30 y devolvía éxito. Con 12 fotos × 8 prendas el botón podía decir *"sumar 72 al clóset"*, entrar 30 y perderse 42 **sin una palabra**. El tope sube a 60 y ahora se dice cuántas quedaron fuera. Un tope está bien; un tope callado es ropa que desaparece.

### Added — ver el render en grande antes de juzgarlo

En *"¿cuáles son tuyas?"* se decide **es mía / no es mía / salió mal** mirando un recuadro de dos columnas, que es justo donde no se distingue si el dibujo salió bien. El visor ya existía —lo usan los looks, la maleta y desde ayer la ficha— y faltaba en el único momento del flujo que es un juicio puramente visual.

## [0.2.168.0] - 2026-08-08

### Added — ver el clóset por recién añadidas

Idea de Roberto. El clóset ordenaba de una sola forma: **tus queridas primero** (las de outfits favoritos y usados), que es lo correcto para el día a día. Pero hay un momento en que eso estorba — acabas de subir doce prendas y quieres ver **ésas**, no tus favoritas de siempre.

**El orden vive con los filtros, no en la fila de chips**: ahí competiría con las categorías, que es lo que de verdad se usa a diario. Y *"queridas primero"* sigue siendo el default: recién añadidas resuelve un momento concreto, no el uso normal.

## [0.2.167.0] - 2026-08-08

### Added — material y patrón en el alta múltiple

Idea de Roberto: *"ver también texturas o patrones como parte de la info cuando se está dando de alta una prenda con el flujo multiprenda"*.

Verificado antes de construir: el editor del carrete tenía **cero** menciones de material y patrón. La visión **sí los leía y los guardaba** — sólo que nunca los veías. El mismo caso que el corte de esta mañana: dato leído, usado e incorregible.

Y no son adorno: el **material** decide *"lana en calor"* y el **patrón** decide *"dos estampados que pelean"*.

**Son chips y no un campo de texto**, a propósito: esto es la carga masiva, y escribir *algodón* a mano en doce prendas es exactamente la fricción que este flujo existe para no tener. Vienen preseleccionados con lo que leyó el modelo, así que el camino normal es pasar de largo.

**Lo que el modelo lea fuera de la lista se conserva** y aparece como una opción más — sin eso, un material como *cashmere* o *gabardina* se vería como si no hubiera nada elegido (el bug del saco y el del color otra vez) y tocar cualquier chip destruiría un dato más específico.

## [0.2.166.0] - 2026-08-08

### Added — la foto original ya no se tira

Idea de Roberto: *"guardar también la imagen de referencia para consulta"*. Medido antes de construir:

| | |
|---|---|
| prendas dadas de alta por foto | **325** |
| que conservaban el original | **5** |
| que sólo tenían el render | **297** |

La foto vivía en el navegador durante el alta y **nunca subía**. Lo que quedaba era el dibujo generado a partir de ella, y eso cerraba tres puertas a la vez:

- **No se podía comprobar nada.** Cuando el render del esmoquin salió con el pantalón, no había forma de ver de qué foto salió.
- **No se podía volver a leer la prenda.** Midiendo la deriva de visión esta misma mañana **hubo que usar renders como sustituto** porque los originales no existen.
- **Si el render sale mal, no hay a dónde regresar.** Rehacerlo parte del texto, no de la prenda.

**Una subida por foto, no por prenda:** si de una imagen salieron seis prendas, las seis apuntan al mismo original. Y **falla hacia adelante** — si la subida no sale, la prenda se guarda igual sin referencia: la prenda es el trabajo, la foto es el respaldo.

**No cambia lo que ves:** el orden de imágenes prefiere el render sobre la foto, así que la miniatura sigue siendo el dibujo limpio.

*La otra mitad de la idea —"renderizar las imágenes para que se vean bonitas"— ya funcionaba: el flujo multiprenda genera el render de cada prenda desde que existe.*

## [0.2.165.0] - 2026-08-08

### Added — el color principal, editable en la ficha

Roberto: *"tampoco me deja cambiarle el color"*. Cierto, y era el hueco más caro de los que quedaban: la ficha dejaba corregir el **segundo** color y no el primero — que es el que alimenta las reglas de cuero, las de monocromo y la colorimetría entera.

Mismo criterio que en la carga: primero **el color que la prenda tiene**, luego los que de verdad se confunden con él, y la paleta completa a un tap.

### Added — al cambiar nombre o color, se ofrece rehacer la imagen

Idea de Roberto, y es correcta: *"si le cambio el color o nombre me debería preguntar si quiero generar nuevamente la imagen"*. El render **sale de esos dos datos**, así que cambiarlos lo deja obsoleto — una chamarra que renombras a gris sigue mostrándose azul.

**Se pregunta, no se rehace sola:** cuesta una llamada y a veces el cambio fue una tilde. La pregunta lleva el motivo delante, que es lo que la hace contestable: *"Su imagen se generó con el nombre y el color anteriores — ¿la rehago?"*.

### Fixed — el "blazer" era un abrigo, y yo me equivoqué

Le dije a Roberto que *"Blazer marrón de lana"* estaba mal categorizado y debía ser `saco`. Me pidió mirarlo bien y tenía razón: la imagen es un **abrigo corto de lana** —largo de abrigo, tweed grueso, bolsillos de parche—. La categoría `abrigo` estaba **bien**; lo que mentía era el nombre. Renombrado a *"Abrigo de lana marrón"*.

## [0.2.164.0] - 2026-08-07

### Added — ver la prenda en grande desde su ficha

Roberto: *"¿cómo le hago para ver en grande la imagen?"*. No se podía — y lo raro es que **el visor ya existía**: lo usan los looks, la maleta y "lleva puesto". Faltaba justo en el clóset, que es donde uno va **a mirar** su ropa. Ahora la miniatura de la ficha se toca.

### Fixed — "Chaqueta" no entraba en el subgrupo Chamarras

El clóset ya separa los Abrigos en **Chamarras · Sobrecamisas · Chalecos**, pero el patrón cubría *chamarra, cazadora, bomber, mezclilla, biker, moto* y **no "chaqueta"** — así que una chaqueta caía al cajón genérico junto a un abrigo largo.

**La categoría `abrigo` está bien** y no se toca: en este modelo `abrigo` significa *capa por clima* (frente a `saco`, que es capa por formalidad), y una chaqueta con cierre lo es. Lo que fallaba era el subgrupo visual, no la clasificación.

## [0.2.163.0] - 2026-08-07

### Fixed — "Esmoquin negro" también era un saco (migración 0127)

La misma clase de bug que arregló la 0126, que no lo cazó porque filtraba por nombres que empiezan con *"Traje"*: una prenda guardada —bien— como `saco`, pero **nombrada como el conjunto entero**.

No es sólo estética. El nombre llega al motor, y un ítem llamado *"Esmoquin negro"* en categoría saco es exactamente el patrón que hizo que un *"Traje marino de lana"* se leyera como traje completo y saliera un look **sin pantalón**. La categoría ya va al prompt; ahora el nombre deja de contradecirla.

2 filas · el pantalón no se toca (*"Pantalón de esmoquin negro"* ya dice lo que es) · idempotente, verificado corriéndola dos veces.

## [0.2.162.0] - 2026-08-07

### Fixed — "Pantalón de traje Esmoquin negro"

Roberto, tras crear el pantalón del esmoquin: *"creo también se tiene que editar el nombre"*. Tenía razón: mi derivación pegaba el prefijo `Pantalón de traje ` delante del nombre del saco, y con un esmoquin salían **dos prendas distintas pegadas** y con mayúscula a media frase.

El pantalón de un esmoquin se llama **pantalón de esmoquin**, y su prefijo es otro. De paso, lo que sigue al prefijo va en minúscula: *"Pantalón de traje Marino de lana"* también se leía a descuido. La fila que ya estaba mal quedó corregida.

### Added — rehacer una imagen que no es de esa prenda

El otro hallazgo del mismo caso: la miniatura del *"Esmoquin negro"* enseña **saco y pantalón juntos**, porque entró por una foto del traje entero y su render salió de ahí. Como prenda es un saco: **la imagen miente**.

Y no había forma de corregirla. El render es idempotente a propósito —para no gastar regenerando lo que ya está— y esa protección, que es la correcta el 99% de las veces, aquí bloqueaba justo lo que hacía falta. Ahora la ficha tiene **"la imagen no es de esta prenda — rehacerla"**, y sólo desde ahí se salta la guarda.

## [0.2.161.0] - 2026-08-07

### Fixed — los candidatos a pareja decían todos "Pantalón de…"

Roberto: *"del saco del traje azul no es claro cuál es el pantalón que va con ese"*. Y no podía serlo: las tarjetas medían 80 px con el nombre en **una línea y truncado**, así que sus cuatro pantalones de vestir se leían idénticos — *"Pantalón de…"*. Lo que los distingue (*marino*, *gris oscuro*) está **al final** del nombre, justo donde cortaba.

**Una lista para elegir cuyas etiquetas son todas iguales no es una lista.** Tarjetas más anchas y el nombre completo, en dos líneas si hace falta.

Y se marca el candidato que **ya es de otro conjunto**: atarlo ahí soltaría el traje al que pertenece, y eso pasaba en silencio.

### Fixed — "créalo" no parecía tocable

La salida para el pantalón que falta —el caso del esmoquin— era texto de color, sin borde ni fondo: se leía como una frase, no como un botón. Roberto: *"al smoking no sé cómo hacer que aparezcan sus pantalones"*. La respuesta estaba en pantalla y no se veía. Ahora es un botón con borde y dice qué hace: **"su pantalón no está en mi clóset — créalo"**.

### Nota — el traje gris que subió SÍ quedó atado

Comprobado en la base: el saco y el pantalón que subió a las 05:09 comparten lazo. La casilla del flujo funciona. El marino es de **antes** de que la función existiera, y por eso hay que atarlo a mano — no es que se hubiera perdido.

## [0.2.160.0] - 2026-08-07

### Fixed — "mala" no decía qué estaba mal

Roberto, en la pantalla de curación visual: *"¿qué significa mala?"*. Buena pregunta: la etiqueta no dice si lo malo es la prenda o el dibujo. Es el **dibujo** — y eso sólo se sabía leyendo el código.

Peor, el subtítulo lo escondía: *"Las que no coincidan no se pierden: nos ayudan a crecer la biblioteca"* explicaba una de las tres salidas y dejaba sin avisar la única que **sí** tira algo.

Las tres salidas, ahora dichas:

| botón | la prenda | la imagen |
|---|---|---|
| **es mía** | entra a tu clóset | se queda como su foto |
| **no es mía** *(antes "no es")* | no entra | se guarda para la biblioteca |
| **salió mal** *(antes "mala")* | no entra | se tira |

Y el subtítulo distingue los dos casos: *"Si no es tuya, la imagen nos sirve para la biblioteca. Si el dibujo salió mal, lo tiro."*. El título deja de ser *"¿Cuáles son tu prenda?"*.

## [0.2.159.0] - 2026-08-07

### Fixed — el cabo suelto de la visión: medido, y peor de lo que dije

Ayer marqué como riesgo la instrucción `varias` añadida al prompt que lee UNA prenda. Medirlo dio lo que no quería oír.

`scripts/vision-deriva.ts` lee la misma foto **tres veces**: dos con el prompt nuevo —eso es el **ruido**, cuánto cambia el modelo consigo mismo— y una con el viejo, que es la **señal**. Sin ese control ningún número significa nada.

| versión | n | z |
|---|---|---|
| 70 palabras a mitad del prompt | 67 | 2.4 · `material` 5 → 14 |
| una cláusula corta | 71 | 1.8 |
| la cláusula, muestra grande | 196 | 2.2 · `temporada` 3 → 16 |
| **nada en el prompt, sólo el schema** | **425** (2 corridas) | **3.05** |

Ni sacándolo del prompt por completo: **era el schema en sí**. `subtipo` z = 3.35, `temporada` z = 2.23. Replicado en dos muestras independientes.

**La solución no era elegir.** La disyuntiva —"o detecto varias prendas, o no toco las lecturas"— era falsa: preguntándolo en una **llamada aparte**, el lector queda byte a byte como estaba (prompt y schema idénticos, deriva cero por construcción) y la detección se conserva entera. Cuesta una llamada de visión más por foto, que en flash-lite es ruido en la factura.

**Y lo que se midió es CAMBIO, no DAÑO:** que una lectura cambie no prueba que empeore. Pero cambiar sin saber si mejora es justo lo que no se hace aquí.

### Fixed — mi propio veredicto estaba mal calibrado

El script cantaba "✅" si señal ≤ ruido × 1.5. Con 402 contra 323 —razón 1.24— dio verde cuando **z era 3.05**. Un cociente no sabe cuántas observaciones tiene detrás. Ahora el veredicto va por z.

## [0.2.158.0] - 2026-08-07

### Verificado — un día entero de cambios NO tocó ningún veredicto del motor

Roberto: *"me preocupa que rompamos algo que ya funcionaba bien… los trajes para bodas y así, yo lo hacía bien"*. La preocupación es correcta y no se contesta con palabras.

`scripts/regresion-reglas.ts` pasa las reglas de ejecución sobre **los 177 looks reales** que el motor ya generó, con el código de hoy y simulando el de ayer:

| regla | antes | hoy | Δ |
|---|---|---|---|
| capa-invisible | 1 | 1 | 0 |
| codigo-de-smoking | 1 | 1 | 0 |
| cueros-que-no-se-hablan | 1 | 1 | 0 |
| traje-desparejado | 2 | 2 | 0 |

**Idéntico.** El único cambio de hoy que llega al motor era la excepción del traje, y como ninguna prenda tiene lazo todavía, es un no-op sobre los datos reales. La métrica perceptual nueva (`kL = 2`) **no la usa ninguna regla** — sólo el clóset.

Lo que esto **no** cubre, y conviene tenerlo presente: el prompt de visión ganó una instrucción (`varias`), y eso sí puede mover otras lecturas. Se mide con el comparador de visión cuando haga falta.

### Added — el motor por fin VE el lazo (v50)

La excepción de la regla evitaba que el motor fuera *castigado* por juntar un saco con su pantalón, pero seguía sin **saber** que son un traje: su propio prompt le dice *"úsalos juntos sólo si de verdad son un traje (misma tela)"* y nada le decía cuáles lo eran. Ahora las dos piezas se marcan.

`PROMPT_VERSION` sube a **v50** aunque hoy salga byte a byte igual que v49 (cero prendas con lazo): sin subirla, el primer look con un traje atado quedaría registrado como v49 siendo otro prompt.

### Changed — de "traje" a "conjunto", y fuera lo imposible

Roberto: *"se ve horrible ahí… cómo va a ser un short parte de un traje"*.

Tenía razón, y **no era cuestión de orden**: ordenar por formalidad bajó la bermuda al tercer puesto, pero seguía ahí. Ahora hay una exclusión dura — short, bermuda, jogger, legging, deportivo, denim, jean, cargo — que **sólo aplica cuando el ancla es un saco**: un conjunto de dos piezas con short existe y es normal.

Y el mecanismo se generaliza: el dato siempre fue genérico (un id compartido), lo específico era la UI. Ahora ata saco ↔ pantalón, top ↔ pantalón, y el chip dice **conjunto** (un traje es un conjunto, no al revés).

**El límite no se mueve:** `conjunto` significa *"se vende como una pieza"*, NO *"me gusta con"*. Si se usa para gustos, la regla de traje desparejado deja de cazar el error para el que existe — y qué combina con qué es el trabajo del motor, no un dato a capturar a mano.

## [0.2.157.0] - 2026-08-07

### Added — crear el pantalón que le falta al saco, con su imagen

Roberto, sobre los trajes que quedaron a medias: *"si tengo el traje, tengo el pantalón y tengo el saco… está raro si no hay imagen del pantalón"*.

En la migración de hace un rato **no** lo creé, y con razón: no sabía si esa persona lo tenía, y crear ropa que nadie tiene es el problema de fondo de estos días. **Que él lo declare cambia las cosas** — deja de ser invención y pasa a ser un dato suyo.

En la ficha de un saco, junto a las candidatas a pareja, sale **"no está en mi clóset — créalo"**: crea el pantalón, lo ata al saco y le genera la imagen.

**Se deriva, no se rellena.** Color, material y temporada salen del saco que sí está fotografiado; lo único que se afirma de más es que un pantalón de traje es formal, que es la definición de la prenda. Lo que el saco no tiene, el pantalón tampoco: un material inventado alimenta las reglas de clima, y el motor sabe tratar un hueco pero no una mentira.

La certeza queda en **`generica`**: la prenda es suya a propósito, pero nadie la ha fotografiado.

El render va **aparte** de la creación: si tarda o falla, la prenda ya existe y el clóset la muestra con su color.

## [0.2.156.0] - 2026-08-07

### Fixed — los 4 "Traje …" que en realidad eran un saco (migración 0126)

Los residuos de la puerta que se arregló en la versión anterior: una foto del traje puesto entrando por "una prenda" dejaba el saco leído como prenda principal y un nombre que dice *"traje"* para algo que es sólo el saco.

No es cosmético: el motor recibe el nombre, y ya leyó una vez un *"Traje marino de lana"* como traje completo y armó el look **sin pantalón**.

**Sólo renombra**, y es a propósito: no crea el pantalón que falta. No sabemos si esa persona lo tiene ni cómo es, y no hay foto suya — inventarle una prenda al clóset es exactamente el problema que llevamos días persiguiendo. El pantalón se da de alta desde la biblioteca (hay *"Pantalón de traje azul marino"* y 4 colores más) y se ata al saco desde la ficha.

Idempotente: el filtro exige que el nombre empiece por "Traje", así que en cuanto se renombra deja de coincidir. Verificado corriéndola dos veces — la segunda toca 0 filas. *"Traje de baño"* queda excluido explícitamente.

## [0.2.155.0] - 2026-08-07

### Fixed — "una prenda" se tragaba el resto de la foto sin decirlo

Roberto: *"en la foto viene tanto el pantalón como el saco… no sé si en las pruebas se tomaba solo como una cosa, 'traje'"*. Tenía razón, y el origen no era el que yo pensaba.

**El catálogo está bien**: tiene *"Saco de traje X"* y *"Pantalón de traje X"* por separado, en 5 colores. Ningún arquetipo se llama sólo "Traje".

**El lector de VARIAS también está bien**: de la foto de un look saca las 7 prendas por separado.

El problema es la tercera puerta. El lector de **una prenda** devuelve UNA por diseño —*"si hay varias, elige la principal"*— y las demás **se perdían en silencio**. Así nacieron los *"Traje marino de lana"* de la base: una foto del traje puesto entrando por ahí, el saco leído como prenda principal, el pantalón desaparecido, y un nombre que dice "traje" para algo que es sólo el saco.

Ahora el lector puede **decir que hay varias**, y cuando lo dice no se limita a avisar: ofrece **"sepáralas todas"**, que pasa **la misma foto** al lector que sí sabe hacerlo — sin volver a elegirla ni empezar de nuevo.

### Fixed — el aviso salía en una puerta de tres

El flujo de una prenda se monta en **tres** sitios (la hoja "Agregar", el bloque "llénalo" del clóset y la hoja "Más"), y sólo cableé el primero. Las tres van iguales; si no, la misma foto avisa o no según por dónde entres.

## [0.2.154.0] - 2026-08-07

### Added — el traje se ve como traje, sin dejar de ser dos prendas

Roberto, viendo su traje partido en dos thumbnails: *"¿debería existir tanto individual como junto? Capaz cuando se guarda como traje se guarda doble"*.

**Guardarlo doble se descartó**, y con motivos concretos: el motor contaría el saco dos veces y podría meter los dos en un mismo look; los conteos del clóset mentirían (114 prendas pasarían a 116 con la misma ropa); y las dos copias se separarían en cuanto alguien editara una — la misma clase de bug que se arregló dos veces hoy.

**Lo que faltaba no era otra fila: era que el lazo se viera.**

- Las dos piezas de un traje llevan la marca **traje** en el mosaico.
- La ficha dice con qué va, con su foto, y deja **desatar**.
- Y deja **atar**: antes el lazo sólo se podía poner al subir la foto, así que quien pasara de la casilla —o quien tuviera el traje de antes— no podía atarlo nunca. Los 4 *"Traje …"* que hay en la base guardados como una sola pieza son justo ese caso.

### Fixed — a un saco de traje le ofrecía jeans

Las candidatas a pareja salían ordenadas sólo por cercanía de color, y a un saco gris carbón le proponía primero unos **jeans** y una **bermuda**. El color por sí solo no sabe que un traje no lleva jeans: en OKLCH el denim oscuro cae cerquísima del carbón — la misma vecindad que hace confundir carbón con azul medianoche. Ahora ordena por **formalidad primero** y color después.

## [0.2.153.0] - 2026-08-07

### Added — "creo que ya la tienes" al subir, no en la limpieza de después

Roberto: *"¿hay algún paso o algo para evitar que carguemos prendas que ya estaban en el clóset? ¿O un aviso?"*. No lo había. Medido:

| | |
|---|---|
| grupos con nombre repetido | 25 |
| de esos, **idénticas** | **10** |
| distintas de verdad (los tres pantalones negros) | 8 |
| **cuántos vinieron por foto** | **31 de 31** |

El flujo de biblioteca sí se protege (no reinserta un arquetipo que ya tienes); el de foto no tenía **ninguna** guarda, y el detector que existe vive en `/admin` — limpieza después del desastre, no aviso antes.

**Avisa, no borra.** 8 de los 25 grupos son prendas distintas de verdad. Apagarla sola quitaría ropa real sin que nadie se entere; un aviso que se ignora cuesta una mirada. Va con la foto de la prenda del clóset, porque sin ver las dos no se puede decidir.

### La regla salió de medir, y tres veces me corrigió

`scripts/calibrar-ya-la-tienes.mjs` contrasta cada variante contra la base real:

| regla | caza | falsas alarmas |
|---|---|---|
| categoría + nombre + color | 10/10 | 12 |
| + material distinto descarta | 10/10 | 2 |
| + material y corte descartan | 10/10 | **0** |
| + corte sólo si es de fiar | 10/10 | 2 ← **ésta** |

**1. El color no era lo que separaba.** El umbral daba exactamente igual de 0.04 a 0.20. Lo que distingue dos prendas que se llaman igual es **de qué están hechas**. La primera versión habría fallado más veces de las que acierta.

**2. Se eligió la variante con 2 falsas alarmas y no la de 0** — a propósito. El corte del catálogo lo traen **491 de 670 prendas asumidas** sin que nadie lo confirme, y se vio en vivo callando un aviso legítimo: una camisa blanca de vestir no avisó porque la "Camisa blanca" del clóset traía corte `recto` inventado. La medición **no puede ver los avisos que se callan** — su referencia son duplicados que ya existen. Una falsa alarma cuesta una mirada; un aviso callado, una prenda repetida.

**3. El umbral de color estaba flojo y lo cazó el navegador, no la calibración.** Unos *"Pantalón chino azul marino"* avisaban contra un *"Pantalón negro"*. Medido: dos lecturas de la misma prenda distan **0.006–0.010**; dos colores distintos, **0.054–0.208**. El umbral estaba en 0.08 — por encima de la diferencia entre marino y negro. Ahora **0.03**, en medio del hueco.

Y un cuarto, de un test escrito mal a propósito de otra cosa: **el color en el nombre no cuenta como parecido**. "Camisa negra" y "Camiseta negra" comparten la palabra *negra*, son las dos `top` y las dos negras. El color ya se compara aparte con matemática; dejar que además cuente como identidad es medirlo dos veces y encima mal.

## [0.2.152.0] - 2026-08-07

### Changed — sólo los colores que de verdad se confunden

Idea de Roberto: *"no tiene caso en cada prenda mostrar las mismas opciones de color; algo que cae entre negro o gris pudiera confundirse, pero nunca con rosa o amarillo"*.

Ahora se ofrecen los **4 más cercanos** al color leído, más un **"otro color"** que abre la paleta completa.

**La puerta abierta no es un detalle de UX, es la condición para que esto sea seguro.** Filtrar por cercanía da por hecho que la lectura es aproximadamente correcta — que es justo lo que falla cuando más falta hace corregir. Un saco marino con luz cálida se puede leer "café", y ahí el color bueno **no está entre los vecinos del café**. Con el filtro cerrado, el único error que importa sería el único imposible de arreglar.

### Fixed — la métrica de cercanía ponía al vino junto al gris carbón

Con las tres componentes de OKLab pesando igual, el vecino más cercano del carbón `#3A3A3C` salía **"Vino" `#5E2A33`**: comparten luminosidad casi exacta, y esa coincidencia pesaba más que la diferencia de croma (uno es neutro, el otro tiene color). A ojo nadie confunde un carbón con un burdeos, pero sí con un negro.

La luminosidad ahora pesa la mitad (`kL = 2`) — que **no es un ajuste a ojo**: es el factor que la CIE fija para textiles en ΔE94, contra `kL = 1` de artes gráficas. En ropa, cambiar de **familia** de color salta más que cambiar de claridad.

Y una corrección de un test mío, no del código: escribí que el segundo vecino del carbón debía ser el negro, y sale **azul marino**. El test estaba mal — *"¿es carbón o azul medianoche?"* es de las confusiones más comunes en sastrería, y en una foto todavía más.

## [0.2.151.0] - 2026-08-07

### Fixed — la paleta de colores invitaba a empeorar el dato

Roberto, sobre su traje: *"es gris muy oscuro, pero no es negro, y el gris que aparece se ve medio claro"*.

Tres cosas encadenadas, y la del medio es la mala.

**1. No se marcaba ningún swatch.** La comparación era por NOMBRE: la visión lee *"gris oscuro"* y la paleta tiene *"Gris"* → no empatan → nada encendido. Es el mismo patrón que el saco que faltaba: el dato existe, la UI no sabe enseñarlo. **123 de 312 prendas con foto (39%)** salían así — *plateado, dorado, marrón oscuro, azul claro, crema, marino, esmeralda…*

**2. Y "corregirlo" destruía el dato bueno.** El color real se guarda como hex exacto leído de la tela. Tocar el gris de la paleta lo reemplazaba: `#3A3A3C` (carbón) → `#8A8A8A` (gris de en medio). O sea que **la prenda se aclaraba**, sin vuelta atrás, y ese hex alimenta las reglas de cuero, las de monocromo y la colorimetría. Dejarlo sin tocar era lo correcto — y la pantalla invitaba a lo contrario.

**3. Faltaba el gris carbón.** No es un capricho: es media sastrería masculina (trajes, abrigos, pantalones de vestir) y el único gris disponible estaba a media escala.

Ahora: el color leído se dibuja como **su propio swatch, primero y encendido** ("el que leí"), la marca se decide por hex y no por nombre, el nombre que se muestra es el que leyó la visión —*gris oscuro*, no *Gris*—, y la paleta suma **Gris oscuro**. El swatch de lo leído no desaparece al corregir: volver es un tap.

## [0.2.150.0] - 2026-08-07

Los tres salen de una foto que subió Roberto —él con un traje puesto— y de lo que vio en la pantalla de confirmación.

### Fixed — faltaba "Saco" en los dos editores de foto

Roberto: *"no entendí… suponiendo que fuera un blazer, ¿en dónde entraría, en top, en abrigo? No sé ahí por qué no lo detectó"*.

**Sí lo detectó.** El schema de visión tiene las 7 categorías y la prenda salió con `categoria: "saco"` — pero la lista de botones sólo tenía 6, sin saco. Sin botón que le corresponda, la prenda aparece con **nada marcado**, y se lee como que el modelo falló.

Peor que cosmético: tocar cualquiera de las otras seis para "arreglarlo" rompía un dato correcto, casi siempre hacia `abrigo` — que es justo el error que el prompt de visión se esfuerza en evitar (saco = por formalidad; abrigo = SOLO capa por clima). **18 prendas de foto son categoría saco y todas pasaron por ahí.**

### Fixed — un traje de verdad disparaba la regla de "traje desparejado"

Roberto pidió que el traje se guardara como conjunto y no partido en dos. Partirlo es correcto y está medido: guardarlo como una sola prenda hacía que el motor armara looks **sin pantalón**. Pero su observación destapó algo peor.

Nada decía que esas dos piezas van juntas — y la regla `traje-desparejado` marca como error exactamente eso: saco y pantalón de vestir del mismo color. **O sea que subir un traje de verdad creaba el par que el motor tiene prohibido juntar.** Tener un buen traje impedía usarlo.

Ahora las dos piezas se pueden atar con un `conjunto`, y la regla deja pasar el par atado (pero sigue marcando el saco de un traje con el pantalón de otro).

**El lazo lo pone la persona, no el código**, y es deliberado: un blazer con un pantalón del mismo tono que NO son traje es justo el error que la regla existe para cazar. Atarlos por parecido apagaría la regla en el único caso donde sirve. Y la pregunta sólo sale cuando hay **exactamente** un saco y un pantalón formal: con dos sacos, "¿son traje?" tiene cuatro respuestas y se contestaría al azar.

### Added — corte y largo en la confirmación, con "no aplica"

Mi número de ayer —*"sólo 36 prendas se quedan sin corte"*— contestaba la pregunta equivocada: medía los **huecos**, no los **errores**. La visión llena el corte en 199 prendas y se guarda tal cual, sin que nadie lo vea nunca; una lectura mala es hoy invisible e incorregible. Es el mismo dato inventado de siempre con otro disfraz.

Ambos aparecen sólo donde cambian el look, y con **"no aplica"** explícito, como pidió Roberto: sin esa salida, la única forma de no contestar es dejar lo que el modelo puso — o sea, aceptarlo en silencio.

## [0.2.149.0] - 2026-08-07

### Fixed — las prendas con el dato inventado eran las únicas que no se podían corregir

Roberto pidió dos cosas: confirmar más atributos al leer fotos, y un icono en el mosaico que mostrara el corte. Medir mandó a otro lado.

**Lo de multiprenda ya estaba.** Nombre, tipo, color y formalidad ya son editables al revisar lo leído, y el modelo marca *"No la vi bien — confírmala"* donde dudó.

**El corte NO debe ir en ese flujo.** De 312 prendas con foto, 199 traen corte; de las 113 sin él, **77 son calzado y accesorios** — donde el corte no significa nada. El hueco real son 36 filas en toda la base. Cobrar un quinto campo por prenda, en el flujo cuyo propósito es la velocidad, para arreglar 36 filas, es mal negocio. La visión ya lo lee bien: el corte es propiedad de la prenda, no del cuerpo, y por eso se ve en una foto de la prenda extendida.

**El hueco real era otro.** La ficha de detalle sólo dejaba editar prendas fotografiadas (`item.source === "photo"`). Efecto: las **670 prendas del catálogo —513 en categorías donde el corte importa—** eran justamente las que traían el dato inventado, y las únicas que no se dejaban tocar.

Ahora la ficha es editable para cualquier prenda, con las siluetas del corte dentro y una línea que dice de dónde salió: *"La marcaste en la lista de básicos — lo de abajo es lo que supongo. Corrígeme."*

**El corte preselecciona pero no confirma.** Sólo un tap en una silueta lo marca como confirmado; guardar tras cambiar el material deja el corte como estaba. Si preseleccionar contara como confirmar, un guardado distraído marcaría como revisado un dato que nadie miró — la mentira exacta que la certeza vino a impedir.

**Sin badge en el mosaico**, y es deliberado: imprimir "recto" en 513 mosaicos donde nos lo inventamos publica una certeza que no tenemos, y frente al clóset propio no responde ninguna pregunta.

### Fixed — la precedencia dejaba invisible tu propia edición

El clóset mostraba el nombre y la categoría **del arquetipo** por encima de los de la prenda; el motor, al revés (`categoriaDeItem`). Con la ficha abierta a todas las prendas eso dejaba de ser un detalle: renombrabas un básico, se guardaba, y en pantalla seguía el nombre viejo. Ahora manda lo que la prenda declara, igual que en el motor. Hoy no cambia nada visible —los 670 nombres propios son idénticos al del arquetipo—; en cuanto alguien edite, sí.

## [0.2.148.0] - 2026-08-07

### Fixed — la pregunta del corte no se podía contestar: faltaba ver la prenda

Roberto, con la card enfrente: *"si me enseñaras una foto de los jeans sería más fácil, pero no sé si es una foto de los jeans que yo subí o porque estaban en la biblioteca y dije que yo los tenía"*.

Son **dos** problemas distintos en una frase, y el segundo es el grave.

**Sin imagen, la pregunta no se puede contestar.** Su clóset tiene varios pantalones oscuros; el nombre "Jeans azul oscuro" no identifica ninguno. Y una pregunta que no se puede contestar bien se contesta al azar — que es **peor que no preguntar**: el dato falso queda marcado como confirmado y el motor deja de desconfiar de él. Justo lo contrario de para lo que existe la certeza.

**Con imagen y sin letrero, la imagen miente.** Estas prendas son, por definición, las que entraron marcando el checklist: la imagen es del catálogo. Si parece suya, la persona contestaría mirando el dibujo en vez de acordarse de su prenda — o sea describiendo la nuestra.

Ahora la card lleva la miniatura, y lleva letrero: **"Imagen del catálogo, no es tu prenda — piensa en la tuya"**. El encabezado dice también de dónde salieron: *"Las marcaste en la lista de básicos: sé que las tienes, pero no cómo te quedan"*.

## [0.2.147.0] - 2026-08-07

### Added — siluetas para que la pregunta del corte se pueda contestar

Roberto, al ver la primera versión: *"poner referencias visuales para que sea un poquito más claro para las personas saber dónde cae"*.

Es la observación correcta, y redefine el problema: **no era cuántas opciones hay — era que "entallado / recto / holgado" no significa nada sin ver a qué se refiere.** Alguien que no piensa en ropa técnicamente no sabe si sus jeans son "rectos".

Tres siluetas monocromas por familia (pantalón y prenda de arriba), en fila para que se comparen **de un vistazo**. Apiladas y sin dibujo, "recto" y "holgado" son dos palabras que hay que imaginar por separado.

**Son dibujos y no fotos, a propósito:** una foto de unos jeans concretos sugeriría que la respuesta es *"los que se parecen a ésos"*, cuando lo que se pregunta es la silueta.

En cada familia solo cambia **una** cosa (cuánto se abre el bajo). Los hombros, la cintura y la cadera quedan fijos: moverlos dibujaría otro cuerpo en vez de otra prenda.

### Fixed — la primera versión de las siluetas no servía

Trazaba cada pieza por separado y salían **diagonales cruzándose por dentro**; las tres opciones se veían casi iguales — exactamente el problema que venían a resolver. Ahora cada silueta es **un contorno cerrado**, que no puede cruzarse consigo mismo. Se vio en el navegador, no en el código.

### Fixed — `certeza` decía dos cosas a la vez

Roberto: *"esta certeza genérica, no entiendo eso"*. **Tenía razón en no entenderla, porque estaba mal.** El campo se usaba para dos cosas:

1. **De dónde vino la prenda** (foto / catálogo / checklist) — un dato de origen, que no cambia nunca.
2. **Si ya confirmó algún detalle** — que sí cambia, atributo por atributo.

Mezclarlas hacía imposible lo que de verdad importa: si confirma el **corte** de unos jeans del checklist, el motor debe saber que el corte es suyo y que el **largo** sigue siendo del catálogo. Con un nivel global, o toda la prenda es confiable o ninguna.

Ahora los atributos confirmados viven en `attrs.confirmados` (`["corte"]`) y `certeza` vuelve a significar solo el origen. El motor deja de marcar APROXIMADO **el atributo confirmado**, no la prenda entera.

### Notes — la basura que salió al mirar los datos

**17 calzados y 7 accesorios tienen `corte`** en el catálogo. Un zapato "recto" no significa nada: el campo se rellenó por rellenar. No los toca nadie porque la pregunta ya excluye esas categorías, pero queda anotado.

## [0.2.146.0] - 2026-08-07

### Added — "afinemos 3 prendas": preguntar solo donde el dato cambia el look

La otra mitad de la certeza (v49). Guardar que un dato es asumido hace al motor **prudente**; confirmarlo lo hace **exacto**.

Pero preguntar todo sería deshacer justo lo que el checklist de básicos vino a resolver: **catalogar el clóset no debe tomar horas**. Así que se pregunta donde el dato **cambia el look** y donde la prenda **se usa**:

| filtro | por qué |
|---|---|
| solo prendas **asumidas** | las de foto ya tienen su dato |
| solo donde el corte **importa** | el corte de unos lentes no cambia ningún look |
| solo si hay un corte **inventado** | sin él, el motor no afirma nada falso |
| solo si **se ha usado** | preguntar una que nunca entró a un look es cobrar sin dar |
| **de a 3** | es un goteo, no un formulario |

Ordenadas por **usos**, que es donde el dato falso más pesa. En el clóset de Roberto: de 78 asumidas, **29 califican** — y las encabezan sus *"Jeans negros"* con **14 usos** y un `corte: recto` que nadie confirmó.

### Los detalles que hacen que no se sienta un formulario

- **Cada pregunta dice cuánto se usa la prenda** (*"la he usado en 14 looks"*). No es decoración: es la respuesta a *"¿y por qué me preguntas esto?"*.
- **"Ahora no" siempre visible** y **"saltar esta"** por pregunta — quizá ya no la tiene, o no se acuerda. Obligar a contestar convertiría el goteo en un muro.
- **Plural o singular según la prenda**: *"¿cómo te quedan?"* para unos jeans, *"¿cómo te queda?"* y *"entallada"* para una camisa.
- Las opciones están **en palabras de persona** ("ajustados al cuerpo"), no de catálogo ("entallado") — aunque se guarde el valor del catálogo.

### Al confirmar, la prenda pasa a `generica` — no a `exacta`

`exacta` está reservado a lo que la visión leyó de su foto. El resto de los detalles (largo, manga) siguen viniendo del arquetipo, y **prometer más certeza de la que hay es justo el problema que esto arregla**.

### Verificado en el navegador, contra el clóset real
Aparece con 3 preguntas, responder guarda (`corte: holgado`, `certeza: generica`) y avanza a la siguiente cambiando a singular femenino. La prueba se revirtió al terminar.

## [0.2.145.0] - 2026-08-07

### Added — la certeza de cada prenda (v49)

Roberto: *"el motor trata igual 'subí la foto de mis jeans' y 'marqué que tengo jeans'"*.

Al medirlo salió **algo peor que un dato faltante: uno inventado que parece real.** Al marcar el checklist de básicos, el alta **copia los atributos del arquetipo del catálogo**. Unos *"Jeans negros"* que la persona solo marcó llegaban al motor con **`corte: recto`** — un dato que nadie confirmó y que el motor no podía distinguir de uno leído en su foto. Con eso se alimentan reglas de proporción y tips de styling.

**En el clóset de Roberto son 79 de 114 prendas (69%).**

Tres niveles en `items.certeza`: **exacta** (su foto, leída por la visión) · **genérica** (eligió esa prenda del catálogo a propósito) · **asumida** (marcó el checklist). El backfill es conservador: todo lo que no venga de foto queda como asumida — equivocarse hacia menos certeza hace al motor prudente; hacia más, lo hace mentir con seguridad.

En el prompt van marcadas como **APROXIMADOS**, con la instrucción de qué hacer: *usar la pieza con confianza, no construir el look sobre esos detalles*. El corte **sigue yendo** — esconderlo dejaría al motor sin nada donde hoy tiene algo.

### Added — `scripts/prompt-comparar.ts`: el ciclo completo, estrenado

Congelar → correr → juzgar → comparar. **v48 contra v49**, los 14 briefs del pool, mismo clóset y mismo barajeo, **$1.64**:

| | |
|---|---|
| v49 gana | 9 |
| v48 gana | 5 |
| diferencia | +0.020 |
| **t** | **0.18 → dentro del ruido** |
| harían falta | ~35 briefs |

**v49 no muestra mejora medible, y hay una razón de fondo:** la rúbrica juzga por **nombre, color y material** — no ve el corte. El efecto de este cambio vive en proporción y fit, que ninguna dimensión mide directamente. **El instrumento no puede ver este cambio**, y decirlo es más honesto que buscarle un número.

Se queda igual porque **es corrección de información, no optimización de calidad**: el motor dejó de recibir un dato inventado como si fuera real. Eso es correcto tenga o no efecto medible.

### Notes — la limitación del método que la primera corrida destapó

`correrCongelado` ejecuta **solo el generador**, no el pipeline completo: no pasa por el critic ni por la reparación en código. Se vio en el `wow`, que salió **2.30 y 2.40** contra los ~3.0 del eval — porque **el tip lo produce el juez**, y aquí no hay juez.

Como el recorte afecta **igual a las dos versiones**, la comparación pareada sigue siendo válida. Pero los niveles **absolutos** de aquí no se pueden leer junto a los del eval. Quedó escrito en el archivo.

## [0.2.144.0] - 2026-08-07

### Added — congelar una versión del prompt para poder correrla después

Roberto: *"eventualmente sí tenemos que guardar los códigos para cuando saquemos la versión 49 y así hacer comparaciones… como los frontier labs, ver si sale mejor el 48 contra el 49"*.

**No podía esperar a "eventualmente", y por una razón de tiempo:** el prompt vive en el código y **dos versiones no se pueden cargar a la vez** en el mismo proceso. Cuando el repo vaya en v49, v48 seguirá en un commit de git pero ya no habrá forma de *ejecutarla* junto a la nueva. Congelarla mientras está viva es trivial; reconstruirla después es arqueología.

`scripts/prompt-congelar.ts` guarda el `system` y el mensaje de usuario **ya renderizado** para los 14 briefs del pool; `lib/engine/prompt-congelado.ts` lo ejecuta. El schema se reconstruye del clóset, así que la llamada es reproducible exactamente.

**v48 ya está congelado** (14 briefs, 374 KB) y **verificado ejecutándose**: 5s, $0.027, tres looks válidos.

### Notes — lo que el congelado no reproduce, y hay que saberlo

- **Si el clóset cambia**, el congelado pide prendas que ya no existen. `correrCongelado` lo detecta y **falla claro** en vez de generar looks fantasma con un enum recortado — eso mediría el clóset, no el prompt.
- **Las reglas y el juez son los de HOY**, no los de entonces. A propósito: lo que se compara es el prompt, y dejar el resto igual es lo que hace la comparación limpia.
- **El barajeo del clóset queda fijo** en el snapshot. Es lo correcto: las dos versiones verán el mismo orden y la diferencia no podrá venir de ahí.

### Added — el paso queda escrito en `docs/como-decidir-un-cambio-del-motor.md`

Congelar es **parte de subir de versión**, no un extra que se recuerda.

## [0.2.143.0] - 2026-08-07

### Added — el instrumento estrenado, y `docs/como-decidir-un-cambio-del-motor.md`

Primera decisión tomada con el comparador pareado: **¿la reparación en código (v47) ayuda o estorba?** Era el único cambio del día que **toca los looks por su cuenta** —añade una camiseta, cambia un zapato— y el único sin medir.

Flag `sinRepararEnCodigo` + variante en el catálogo, **regla pre-registrada antes de generar**, 12 pares, **$0.74**.

### Notes — el veredicto: indistinguible, y se queda

| | |
|---|---|
| Producción gana | 7 |
| Sin reparación gana | 5 |
| diferencia media | +0.019 pts |
| **t** | **0.13 → dentro del ruido** |
| para resolverlo harían falta | ~50 pares (~$12) |

**La regla pre-registrada decía:** *"si |t| < 2 se declara indistinguible y se QUEDA como está (ya está en prod y no hay evidencia de daño)"*. Se cumple lo escrito.

**Y hay un argumento que el marcador no mide y sí sostiene el cambio:** a igual calidad, la reparación en código resuelve el **47% de las violaciones sin una sola llamada** y deja limpios al **37% de los looks** que traían algo roto. Misma calidad, menos latencia y menos costo — eso basta.

**Una hipótesis que queda anotada, no concluida:** por dimensión, la reparación sale **peor en clima** (4.22 contra 4.54) y **mejor en color** (4.38 contra 4.04). Con 12 pares eso es ruido perfectamente posible, pero si se repite tendría sentido: añadir una prenda por regla puede desajustar la banda térmica.

### Lo que de verdad cambió

Antes: ocho versiones shippeadas en un día sin poder demostrar que ninguna mejorara, y ~$26 por corrida sin conclusión.

Ahora: **$0.74 y doce minutos para saber que no sé** — que es infinitamente mejor que creer que sé.

## [0.2.142.0] - 2026-08-07

### Added — el instrumento pareado: la rúbrica juzga A contra B sobre los MISMOS briefs

**El problema, medido:** dos corridas del eval **con el mismo código** dieron 76% y 88% de aprobación. Doce puntos. Con esa varianza, comparar dos versiones con una corrida cada una no distingue una mejora del ruido — y así se decidieron cuatro versiones del motor hoy, todas con la honestidad de decir *"esto no es concluyente"*.

**La varianza que domina es la del DÍA, no la del motor.** Un brief de lluvia con clóset corto produce peores looks que uno de diario templado, y qué briefs toquen a cada corrida mueve el promedio más que el cambio que se quiere medir. Comparar A y B sobre el **mismo** brief cancela esa varianza por construcción: es la diferencia entre medir dos personas con la misma báscula y medirlas en dos básculas distintas.

El comparador **ya** corría los dos lados sobre el mismo brief; solo esperaba el voto humano para decidir. `scripts/comparador-juzgar.ts` deja que la rúbrica juzgue, y el marcador sale en la pantalla de la corrida.

### Notes — validado contra el veredicto que Roberto ya había votado

Sobre las 20 parejas del veredicto Opus-contra-Gemini, **$1.40**:

| | |
|---|---|
| Gemini gana | **14** |
| Producción gana | 6 |
| diferencia media | **−0.196 pts** |
| **t** | **−2.65 → señal** |
| para detectar +0.2 pts | **~22 pares** |

Y dice **dónde**: la diferencia se concentra en **estilo (3.20 → 3.65)**, la dimensión que más ha costado todo el día.

**Ese "~22 pares" es el punto de todo esto.** Sin parear hacían falta ~169 looks por lado (~$26) y aun así el ruido del día se comía el resultado.

### Notes — y el aviso que impide que este número se use mal

Esa corrida **cambia de modelo**, y ahí la rúbrica **no decide**: un juez Claude tiende a preferir looks escritos por Claude. Está en `rubrica.ts` desde que nació, y sin el aviso el número saldría igual de convincente en pantalla. Se muestra en el script **y** en la UI.

Lo curioso, y lo que hace la señal más creíble no menos: el juez es Sonnet (Claude) y **prefirió Gemini** — o sea, contra su propio sesgo esperado.

**Lo que esto decide:** iteraciones de prompt y de reglas, donde los dos lados corren el mismo juez y su sesgo se cancela. **Lo que no:** coronar un modelo. Eso sigue siendo el voto ciego humano.

## [0.2.141.0] - 2026-08-07

### Added — la bota de montaña no es calzado de calle

Roberto, sobre unas Columbia de senderismo a 8°C despejado: *"no deberían ir a menos que esté nevando — se ve ruidosa, le rompe la madre al look"*. Es calzado **funcional, no estilístico**: suela dentada y refuerzos técnicos gritan montaña en una banqueta. Y en México no nieva.

**La excepción, que fue mi pushback y él aceptó:** con lluvia y sin otro calzado que aguante, la bota se queda. **Funcional feo gana a bonito empapado.**

### Changed — el color se juzga en OKLCH, no en RGB

`lib/engine/color-perceptual.ts`. La distancia euclidiana en RGB **no separa el matiz de la luminosidad**, así que dos colores oscuros y desaturados siempre "se parecen": café chocolate `#5C4433` y burdeos `#5C2A2E` medían **26.5** —por debajo del umbral de 60— y la regla de cueros los daba por el mismo café.

En OKLCH sus matices están a **40°**, que es lo que el ojo ve.

**Dos fuentes independientes apuntaban aquí**, que es cuando este proyecto actúa: el juez visual lo cazó antes que ninguna regla (*"el cinturón marrón chocolate desentona con los mocasines burdeos"*), y el research que trajo Roberto llega a lo mismo desde la literatura — *"conviene trabajar con CIELAB/CIELCH u OKLCH, donde están separadas perceptualmente la luminosidad, el croma y el matiz"*.

Se eligió **OKLab sobre CIELAB** por dos razones prácticas: se calcula desde sRGB con aritmética directa, y corrige el defecto conocido de CIELAB con los azules — que en este catálogo son media paleta (marino, denim, azul rey).

Un detalle que importaba: un color casi acromático **no tiene matiz**. El ángulo de un gris es ruido numérico, y compararlo haría que dos grises idénticos parecieran colores opuestos.

### Notes — verificado sobre los 295 looks de las siete corridas

`cueros-que-no-se-hablan` marca **16 (5%)** y **caza uno de los 👎 de Roberto**.

Marca **uno que él aprobó**, y vale la pena decir cuál: *"Mocasines burdeos + Cinturón café"* — **exactamente el caso que el juez visual había señalado**. Ahí Roberto y el juez visual discrepan, y con un solo caso no se puede decidir quién tiene razón. Queda para la siguiente calibración.

## [0.2.140.0] - 2026-08-07

### Added — dos reglas de clima que faltaban (v48)

De la calibración de v47 por Roberto: **30 looks, 26 👍, 4 👎 (87%)**, con el acuerdo más alto hasta ahora — **90% con el juez de texto y 90% con el visual**.

Pero **de sus 4 rechazos el código cazó CERO**, y tres eran de clima, que es justo lo comprobable. Dos se volvieron regla:

**`blazer-no-es-abrigo`.** La regla del frío se conformaba con cualquier pieza de zona "capa", y el blazer lo es — así que un saco de lana a 8°C pasaba como si abrigara. Roberto: *"para hacer frío ahí falta una capa; que tuviera un abrigo encima del blazer, o un crew neck entre la camisa y el blazer"*. Las dos salidas que él nombró son las que la regla acepta.

**`lana-en-calor`.** El prompt lo pide desde v4 (*"nada de lana ni tejidos pesados en calor"*) y aun así salió un pantalón de lana a 29°C soleado. Roberto: *"la lana es muy calurosa para soleado"*. Lo que el prompt pide y no se cumple, se comprueba. La **lana fría** queda excluida: existe justo para el verano.

### Fixed — la categoría manda sobre el nombre

La primera versión de `blazer-no-es-abrigo` marcó un look que Roberto **había aprobado**: un *"Blazer marrón de lana"* que en el catálogo tiene **categoría `abrigo`** — es una pieza pesada que sí hace de capa exterior, y la regla lo juzgó por su nombre.

El nombre es una heurística; la categoría es un dato.

### Notes — verificado sobre los 295 looks de las siete corridas

| | |
|---|---|
| looks marcados | **4 (1%)** |
| **de sus 4 👎, cazan** | **2** |
| looks aprobados marcados | **0** |

Precisas, no un colador: recogen los dos rechazos de clima sin tocar nada de lo que aprobó.

## [0.2.139.0] - 2026-08-07

### Changed — primero el código, después el juez (v47)

La pregunta de Roberto: *"¿cuando hay un intento, se rehace el outfit o se corrige? Muchas de las cosas que fallaban era nada más 'ay, te faltó esto'. Es como decir 'te faltó ponerte calzones' — no es que tengas que cambiarte toda la ropa porque no traes calzones."*

**Rehacía.** El reintento de v46 le devolvía el look entero al mismo juez, con libertad sobre las cinco prendas, para arreglar que faltara una camiseta. Podía volver con otro look completo — perdiendo lo que ya estaba bien y cobrando una llamada por ello.

`lib/engine/reparar.ts` lo hace **quirúrgico**: toca UNA prenda, la que causa la violación, y comprueba que no aparezcan violaciones nuevas. Y va **antes** del juez, así que en los casos que resuelve del todo **no hay segunda llamada** — ni latencia ni costo.

| se arregla en código | cómo |
|---|---|
| `sueter-sin-base` | **añade** la base más neutra del clóset |
| `frio-sin-abrigo` | **añade** el abrigo |
| `lluvia-sin-impermeable` | **añade** la capa que repele |
| `mocasin-en-frio`, `lluvia-calzado` | **sustituye** el calzado |

Lo que **no** toca, a propósito: `traje-desparejado`, `cueros-que-no-se-hablan`, `capa-invisible`, `codigo-de-smoking`. Elegir "otro pantalón cualquiera" no arregla un traje desparejado — hay que ver **cuál**, y eso es criterio.

### Notes — medido sobre las 135 violaciones reales del eval

**El código solo resuelve el 47%**, y deja **limpios sin ninguna llamada al 37%** de los looks que traían algo roto. Las dos violaciones más frecuentes las arregla **al 100%**:

| regla | resueltas |
|---|---|
| `mocasin-en-frio` | **31/31** |
| `sueter-sin-base` | **29/29** |
| `lluvia-calzado` | 1/1 |
| `cueros-que-no-se-hablan` | 2/17 |

La corrida de v47: **0% de violaciones** y `armado` en **4.37 / 4.69** — el más alto de las siete corridas del eval.

**Lo que sigue sin poder afirmarse:** que suba la calidad general. El aprobado dio 80%/86%, dentro del rango de 76-94% que las siete corridas han mostrado **con distintos códigos y también con el mismo**. Esa varianza es el problema de fondo, y el arreglo sigue siendo el diseño pareado.

## [0.2.138.0] - 2026-08-07

### Added — se comprueba la reparación del juez (v46)

Nadie miraba el resultado del reparador. Ahora, tras reparar, se vuelven a correr las reglas sobre el look que el juez devolvió; si queda algo roto se le devuelve **la lista exacta** y se le da **un** intento más — y el segundo resultado **solo se acepta si dejó menos roto que el primero**.

### Fixed — mi diagnóstico anterior era falso, con el número que lo prueba

Le dije a Roberto que *"el juez ignora hallazgos verificados"*. **Es falso.** Medido sobre las cuatro corridas del eval:

| | |
|---|---|
| violaciones antes del juez | **91** |
| reparadas por el juez | **87 (96%)** |
| quedaron rotas | 9 |
| **introducidas POR el juez** | **5** |

Vi el residuo sin su denominador. El juez repara casi todo; lo que nadie veía es que **introduce violaciones nuevas al arreglar otra cosa**. Ese es el hueco que esta comprobación cierra, y es más chico y más específico de lo que anuncié.

### Notes — el hallazgo que vale más que el cambio: la varianza entre corridas es ENORME

Las dos corridas de v46, **con el mismo código**, dieron **76% y 88%** de aprobación. Doce puntos.

Eso obliga a retirar varias lecturas de hoy: comparar dos versiones con una corrida cada una **no puede distinguir** una mejora de 5-10 puntos del ruido. La primera corrida de v46 dio 76% y llegué a escribir que el cambio había empeorado los looks (z = 2.19); la segunda mostró que era varianza.

Lo que sí sostiene la evidencia: **las violaciones de reglas bajaron de 8% a 0% y 3%** en las dos corridas — eso es consistente y es lo que el cambio garantiza por construcción, no por estadística.

Lo que NO se puede afirmar: que mejore (ni que empeore) la calidad general. **El instrumento sigue sin poder para eso**, y el arreglo es el mismo que ya está anotado: diseño pareado — las dos versiones sobre los MISMOS briefs.

## [0.2.137.0] - 2026-08-07

### Fixed — la regla del suéter aplicaba una convención masculina a todos

Roberto, calibrando: *"si hay un suéter, debe haber una playera abajo… al menos para hombre, no sé si para mujer, porque las mujeres son otro boleto"*. **Tenía razón, y el research lo confirma** (`docs/decisiones/base-bajo-el-sueter-2026-08-07.md`).

La base bajo el punto es **convención masculina**: la lana pica, absorbe el sudor, y el suéter se lava menos. En el guardarropa femenino **no es regla** — llevar el punto a piel es una elección normal y el camisol es opcional.

`sueter-sin-base` no distinguía género, así que marcaba como error algo correcto en la mitad de los clósets. Ahora solo dispara con `gender === "hombre"`, y **sin género declarado tampoco**: en la duda, no inventar el error.

Es el mismo sesgo que ya costó dos correcciones en `alcance.ts` — aquí al revés.

**Y una base que faltaba:** el cuello tortuga bajo un suéter de pico. Estaba excluido *como suéter* pero no contaba *como base*, aunque es el clásico de invierno.

### Fixed — el tenis de malla en lluvia

Roberto: *"sí vetaría lo de la lluvia, como unos Ultraboost, que son los tenis de tela; pero [el de piel] sí puede ser de preferencia"*.

`MATERIAL_SE_ARRUINA` solo tenía "lona" y "tela", así que la malla técnica pasaba limpia. Entran **malla, mesh, knit, primeknit, flyknit**. El tenis de piel **sigue pasando**: vetarlo daría falsos rechazos — mucha gente sale con tenis bajo lluvia.

### Notes — la calibración de Roberto sobre v45

**32 looks: 28 👍, 4 👎 (88%).** Acuerdo con el juez de texto **88%**, con el visual **78%**.

De sus 4 rechazos: el juez visual cazó **0** y el de texto **1**. Y el del suéter **el código SÍ lo cazó** — la regla disparó, el juez la recibió y el look llegó igual.

**Eso apunta a un fallo distinto y más grave: el juez ignora hallazgos verificados.** Medido en las cuatro corridas, **9 violaciones sobrevivieron al juez**, 5 de ellas `traje-desparejado`. No falta criterio — falta que lo que ya se detecta se aplique. Es el siguiente arreglo.

## [0.2.136.0] - 2026-08-07

### Added — el nombre (y el material) bajo cada prenda del calibrador

Roberto: *"si hay un pantalón o camisa, no sé si es de lino o qué, y eso influye"*.

Hay una razón más fuerte que la comodidad: **el juez de texto SÍ recibe el material** (`lookParaRubrica` se lo manda). Si quien calibra juzga sin él, el acuerdo compara dos criterios sobre **dos informaciones distintas** — y ese número es justo el que decide si la rúbrica sigue siendo confiable.

El material solo aparece **cuando el nombre no lo dice ya**: "Chamarra de piel negra" no repite "piel", pero "Pantalón de vestir gris" gana su "· lana". En una pantalla donde cada línea compite con la foto, repetir es ruido.

## [0.2.135.0] - 2026-08-07

### Added — el "por qué no" al marcar 👎

Roberto, calibrando: *"si pongo 'no', que me puedas dar un input box de por qué no"*. Ahora el 👎 **se detiene y pregunta**; el 👍 avanza solo.

Es el dato más valioso de toda la calibración: un 👎 sin motivo dice que algo falló, **con motivo dice QUÉ** — y eso es lo que se convierte en regla. La caja lo dice explícitamente: *"para funeral debe ser traje negro, no marino" sirve; "no me gusta" no*.

`⌘↵` guarda y sigue. Hay salida sin motivo, para no convertir la fatiga en abandono. Y en el revelado los motivos salen agrupados como **"candidatos a regla"**, separados de los desacuerdos con los jueces.

### Added — el render dentro del calibrador

Roberto: *"sin el render no estoy seguro"*. Botón **"ver cómo queda puesto"** (tecla `R`), bajo demanda y cacheado en `eval_briefs.tryons`.

**Nunca automático**: cuesta ~$0.13 y ~15s por look, así que renderear los 40 de una corrida costaría más que la corrida entera. Y va **después** de la cuadrícula a propósito — la cuadrícula mide la composición, que es lo que el motor decide; el render lo interpreta un modelo de imagen que alucina.

Usa `lib/tryon.ts`, el mismo núcleo que producción. La guarda del avatar quedó verificada en vivo: pedirlo desde la sesión de otro admin devuelve `closet_ajeno` en vez de renderear con la cara equivocada.

### Changed — el funeral pide NEGRO, y el marino queda descartado

Roberto, sobre un look real de la corrida: *"era un traje azul marino. Para funeral debe ser traje negro; sería menos peor una camisa blanca, pantalón negro y un suéter gris oscuro — se ve mejor, pero no azul."*

En México el luto es negro y **el marino se lee como oficina**. La regla entra completa, incluida su salida: si el clóset no da un traje negro, es mejor armar **piezas sueltas oscuras** que sacar un traje marino entero — *el conjunto correcto en el color equivocado se nota más que el conjunto suelto en el color correcto*.

## [0.2.134.0] - 2026-08-07

### Changed — el calibrador, rediseñado para que calificar sea rápido y ciego

Roberto: *"métele cabeza"*. Cuatro cambios, cada uno con su razón:

**Un look a la vez, grande.** Era una lista de 30 con miniaturas de 80px. Las prendas ahora van a **314px** en cuadrícula: calificar ropa mirando estampillas no es calificar.

**Con el teclado**: `←` 👎 · `→` 👍 · `↑` saltar · `⌫` atrás. Son 30 juicios seguidos y cada tap ahorrado se multiplica por 30.

**Los jueces NO se ven hasta el final.** Antes se revelaban look por look, y eso contamina exactamente lo que se mide: el acuerdo vale como evidencia sólo si la marca se emitió a ciegas. Mismo principio que el voto ciego del comparador.

**Sin `router.refresh()` por marca.** Se guarda en segundo plano y la pantalla avanza sola. Recargar entre look y look hacía la tarea lenta justo donde la fatiga decide si se termina o no.

Y la muestra **se congela al montar**: si se reordenara con cada marca, el look recién calificado saltaría de posición.

### Added — el revelado es la cosecha, no la calificación

Al terminar (o cuando se pida), aparece el acuerdo con cada juez **y la lista de desacuerdos** con lo que dijo cada uno. Ahí es donde salen las reglas nuevas: o el juez ve algo que el humano no, o el humano ve algo que a la rúbrica le falta decir. El porcentaje solo dice si la rúbrica sigue siendo confiable; los desacuerdos dicen qué hacer.

## [0.2.133.0] - 2026-08-07

### Added — el motor por fin puede decir "no puedo"

Roberto: *"boda de etiqueta y el usuario no tiene traje. Debería decir NO y no permitir; no es que 'ok, pues puede con unos jeans más un suéter'. Va a haber casos en los que no haya prendas y no se pueda."*

Tenía razón, y el motor estaba **construido** para no poder decirlo. El juez sí rechaza un look irreparable, pero el piso de 2 del pipeline lo rescataba igual, con este comentario al lado: *"mejor un look mediocre que menos de 2"*. Esa premisa es cierta para el día a día y **falsa para una boda de etiqueta**: ahí no hay nada que ponerse, y decirlo vale más que inventarlo. Un stylist que te manda de jeans a una boda no pierde medio punto de rúbrica — pierde toda su credibilidad.

`lib/engine/alcance.ts` lo comprueba **en código y antes de gastar un token**: "¿tiene saco?" es una pregunta verificable, no una opinión, y un modelo al que se le pide honestidad puede igual armar algo y llamarlo formal — es lo que ya hacía.

Solo se pronuncia en **formal y gala**; en casual y semiformal un "no puedo" sería falso. Y en gala el esmoquin **avisa pero no bloquea**: un traje oscuro impecable es una respuesta legítima, y el prompt ya lo decía.

En Hoy es una **pantalla propia, no un error**: dice qué falta, ofrece agregar esa prenda y deja la salida de pedir otra cosa (quizá el evento no era tan formal).

### Fixed — dos sesgos de género en mi propia regla, cazados midiendo

Al probar contra los **24 clósets reales** de la base, bloqueaba 8 — incluido el de una usuaria con **82 prendas**. Dos causas, las dos mías:

1. **"Sandalia" como excluyente duro.** Sus *"Tacones nude de tira"* vienen del catálogo con `subtipo: "sandalia"`, que es correcto — y mi regla los tiraba. Una sandalia de tacón es calzado de boda; el excluyente sólo valía para calzado masculino.
2. **El saco como indispensable para todas.** Para una mujer, blusa de vestir + pantalón de vestir + tacón es un look formal completo. Exigir blazer le negaba el código a media población.

Tras arreglar los dos: **6 de 24**, todos clósets de 11 a 24 prendas a los que de verdad les falta la pieza.

La lección quedó escrita en el archivo: un excluyente sólo entra si es categórico para **cualquier** persona; en la duda, dejar pasar. **Un falso "no puedo" es peor que un look mediocre**, porque le niega a alguien algo que sí tenía.

## [0.2.132.0] - 2026-08-07

### Changed — la mano de stylist deja de ser opcional (v45)

El prompt del generador decía *"cuando el clóset lo permita, el look lleva UNA decisión visible"* y remataba con *"si el clóset solo da para lo simple, lo simple BIEN HECHO es la decisión"*. **Dos puertas de salida en la misma frase**: no decidir nada siempre era defendible. Y el motor las usaba — el juez escribió *"la camiseta blanca, bomber negra y jeans negros son el básico más genérico posible; se siente más piloto automático que styling"*.

Ahora cada look debe llevar una decisión **nombrable**, y el campo `analisis` la escribe antes de comprometer el outfit. Más **la prueba del piloto automático**: *¿alguien que NO sabe de moda habría armado exactamente esto abriendo su clóset sin pensar?* Si sí, no hay decisión.

La guarda de siempre se queda y se refuerza: jamás forzar una pieza con tal de tener algo que nombrar. **Una decisión mala es peor que una decisión sobria.**

Va en el generador y no en el critic porque el paso anterior ya descartó al critic: la variedad de gestos subió 37% y el wow no se movió.

### Notes — el efecto es real en dirección, pequeño en tamaño, y NO significativo

| dimensión (texto) | v44+gestos | v45 |
|---|---|---|
| ocasión | 4.62 | 4.67 |
| clima | 4.51 | 4.53 |
| armado | 4.23 | **4.42** |
| estilo | 3.26 | **3.50** |
| color | 3.92 | **4.28** |
| **wow** | 2.90 | **3.08** |
| aprobado | 92% | 94% |

**Suben las 6 de 6.** Test de signos: p = 0.031 — pero **ese p está inflado**: las dimensiones no son independientes (un look bueno las sube todas a la vez), así que cuenta como evidencia direccional, no como prueba.

Por dimensión, nada alcanza señal. El Welch del wow contra su antecesor da **t = 1.18**; y dos corridas del MISMO prompt difieren en 0.08 (t = −0.51), que es la escala del ruido.

### Notes — el hallazgo metodológico: el diseño no tiene poder

Con sd = 0.65 y ~37 looks por corrida, detectar un efecto de +0.2 con 80% de poder pediría **169 looks por lado — 5 vueltas al pool cada uno, ~$26**. Estamos midiendo diferencias de 0.2 con una regla cuya resolución es ~0.3.

La salida barata no es más muestra sino **diseño pareado**: correr los dos prompts sobre los MISMOS briefs y comparar par a par elimina la varianza entre días, que es la que domina. Es exactamente lo que el comparador ya hace — con la rúbrica de juez en vez del voto humano, que es el uso para el que la rúbrica sí sirve (iterar prompt, no coronar modelo).

## [0.2.131.0] - 2026-08-07

### Added — el repertorio de gestos del critic, y la métrica que lo vigila

Atacando el wow (2.98, la nota más baja del eval). El diagnóstico no era falta de tips —eran 40 de 40— sino que **casi todos decían lo mismo**: "deja X abierto" en 24 de 40, seis veces más que el siguiente gesto.

**Y el prompt lo pedía, literalmente.** `critic.ts` decía *"NO ves la prenda (solo tipo/color/formalidad), así que prioriza movimientos SEGUROS: dejar una capa abierta"*, y marcaba fajar y cuffear como *"de RIESGO"*. La premisa **ya era falsa**: desde v38 `describeItem` manda corte, largo, manga y subtipo, y este juez los recibe. Llevaba versiones creyéndose más ciego de lo que estaba.

Ahora tiene un **repertorio explícito con la condición de activación de cada gesto** (fajar pide largo regular; cuffear pide que el calzado se vea; arremangar pide manga larga) y la orden de no caer en el gesto fácil por default.

También se quitó *"NO pongas tip en todos los looks"*: este juez revisa **un outfit a la vez y no ve los otros**, así que esa cuota era imposible de cumplir por construcción.

### Added — `lib/engine/gestos.ts`: variedad de gestos, la métrica anti-Goodhart

El wow lo califica un juez, y en cuanto se optimiza el prompt contra ese juez la nota deja de medir. La variedad de gestos es un **conteo sobre el texto que el motor produjo**: da igual lo que el juez opine. Es la métrica primaria del wow; la rúbrica queda de termómetro secundario.

**El principio, aprendido a golpes: el gesto es el VERBO, no el sustantivo.** Un tip nombra varias prendas y solo una es sobre la que se actúa; las demás son el efecto ("deja la chamarra abierta para que se vea la camiseta contra **los botines**"). La primera versión contaba cada mención y por eso reportaba variedad inexistente.

### Notes — qué pasó: la variedad subió, el wow NO

| | antes | después |
|---|---|---|
| **dominancia** (1.00 = un solo truco) | **0.60** | **0.38** |
| equilibrio | 0.69 | 0.80 |
| gestos distintos | 7 | 6 |
| abrir-capa | 24 | 15 |
| cuello | 4 | 12 |
| accesorio (el nudo de la corbata, nuevo) | 1 | 6 |
| **wow (juez de texto)** | **2.98** | **2.90** |

**La concentración bajó de verdad (−37%) y el wow no se movió** (0.08 sobre ~40 looks está dentro del ruido). Y el repertorio **se redistribuyó más que ampliarse**: bajó abrir-capa, subieron cuello y accesorio, pero desaparecieron proporción y abotonar y fajar casi. Cambió un monocultivo por un duocultivo (abrir-capa + cuello = 27 de 39).

**Conclusión: el gesto no es el cuello de botella del wow.** Eso descarta la hipótesis principal y apunta a la otra mitad — la decisión del look, que es del generador, no del critic.

### Notes — verificado antes: el 5 del wow SÍ es alcanzable

Cero cincos en 40 looks admitía dos lecturas, y la equivocada habría invalidado todo el trabajo siguiente. `scripts/wow-alcanzable.ts` le da al juez looks escritos a mano para sacar 5: **el caso extremo sacó wow 5** (y 5 en ocasión, armado, estilo y color); el control deliberadamente plano sacó **2**. La escala discrimina; el margen es del motor.

Dato de paso: el gesto del look que sacó 5 fue *"arremanga el blazer dos vueltas por encima del puño de la camisa"* — arremangar aparecía **3 veces en 40** looks reales.

## [0.2.130.0] - 2026-08-07

### Added — el juez con ojos de colorimetría (r8 / rv3), con los DOS extremos

Roberto: *"casi todo lo que me sugiere es verde esmeralda o vino — son los que me favorecen, pero hay colores que están bien; no un pastel ni un mostaza, pero sí un azul marino. No seamos estrictos forzando únicamente los que favorecen, permitiendo también los neutrales"*.

El juez ahora recibe su paleta (mejores / prestados / evita, **con hex** — dos "vino" distintos no son el mismo vino) y la califica con una vara de **dos lados**, que es lo que la hace útil:

- Un color de su EVITA cerca de la cara → **2**.
- Un **NEUTRAL** cerca de la cara (marino, gris, camel, blanco) → **4, y está bien**. Explícitamente: *"NO lo castigues por no ser uno de sus colores estrella"*.
- Uno de sus colores → **5**.
- **Y el otro lado:** repetir el mismo color estrella sin ninguna otra decisión de color → **baja a 3 aunque le favorezca**. *"Favorecer es el piso, no el objetivo."*

**Por qué el segundo lado no es opcional:** un juez que solo premiara "está en su paleta" volvería al motor MÁS monótono — que es exactamente el síntoma que Roberto describe. Y ya estaba pasando: en la primera línea base el **wow salió 3.16, la nota más baja de las cinco**.

Funcionó a la primera. De la corrida nueva, el juez escribió: *"todo el look se resuelve en el mismo negro/charcoal de siempre sin ningún guiño de color que hable de su arquetipo"*. Eso es la monotonía cazada, no el color que apaga.

### Added — catálogo de tipos de evento (v44)

*"Podríamos tener ya opciones: una comida, cena, cita, boda — y sobre eso vamos afinando más"* (Roberto). `lib/eventos.ts`: boda, cena con amigos, comida familiar, cita, comida de trabajo, fiesta, graduación, funeral.

**Sustituye la pregunta de formalidad; no se suma a ella.** Cada tipo trae su formalidad por defecto —que es justo lo que la gente no sabe traducir (*"si lee formal, coctel, gala o etiqueta no sabe cuál es el dress code"*)— editable detrás de un disclosure para el caso raro. Nadie tiene ese problema con "una boda". Si se sumara, "evento" pasaría de una pregunta a dos.

Y cada tipo aporta lo que la formalidad **no** captura: en la boda hay fotos y protagonistas a quienes no hacer sombra; el funeral pone el no-destacar **por encima del estilo y de la colorimetría**; la cita se ve de cerca, así que lo que toca la cara pesa más.

### Fixed — la boda de noche NO es black tie (lo cazó el propio eval)

La primera versión subía boda y fiesta un escalón de noche. El eval lo cazó en una corrida: el juez exigía **esmoquin con moño y charol** en los dos looks de boda. En México una boda de noche en salón es traje oscuro y corbata — el black tie se especifica en la invitación. El pool medía un estándar que no es el de aquí y el motor "fallaba" contra una vara equivocada. Ahora **solo la cena con amigos sube** (la diferencia entre comer y cenar con los mismos amigos sí es real).

### Notes — línea base v44 · r8/rv3 · pool v6 (40 looks, $2.70, cero errores)

| dimensión | texto | visión | vs v43 (texto) |
|---|---|---|---|
| ocasión | 4.58 | 4.95 | = |
| clima | **4.65** | 4.68 | **+0.27** |
| armado | 4.28 | 4.47 | −0.10 |
| estilo | 3.38 | 3.98 | −0.19 |
| color | 4.10 | 4.20 | *nueva* |
| wow | **2.98** | 3.33 | −0.18 |
| aprobado | **93%** | **95%** | +1 |

**Violaciones de reglas: 0%** (era 3%). El juez de producción reparó 50%.

**Estilo y wow siguen siendo las dos más bajas, y no bajaron por casualidad: la vara subió.** El motor cumple ocasión y clima casi perfecto y se queda en "correcto pero plano" — la etiqueta que Roberto inventó para el 3 del wow.

### Added — `N_POOL` exportado
El pool creció de 13 a 14 briefs (entró el funeral) y el 13 estaba escrito a mano en tres archivos. La clase de número que se queda atrás en silencio y deja un brief sin medir.

## [0.2.129.0] - 2026-08-07

### Added — el módulo de evales: la curva del motor contra sí mismo

Idea de Roberto: *"como los frontier labs, que tienen sus criterios de evaluación y van viendo cuando sacan un modelo nuevo cómo mejora comparado con los pasados — así vemos cómo nuestro motor va mejorando contra el motor pasado, aprovechando el learning loop y las reglas"*.

**`/admin/evales`** corre el pool congelado de días con el motor VIGENTE y lo califican los tres jueces automáticos (reglas de código + rúbrica de texto + rúbrica visual), **sin voto humano**. Todo queda clavado a `{prompt_version, modelo, pool, versiones de las rúbricas}` y la lista de corridas es la curva.

**Por qué es otra pantalla y no el comparador:** el comparador es la **balanza** (A contra B, ciego, voto humano, decide un cambio); el eval es la **banda de medir** (una variante, jueces automáticos, dice el nivel). Uno decide, el otro vigila.

**Y sobre quitar los jueces de producción** (Roberto: *"habría un punto en el que ya ni siquiera tendría que tener jueces"*): la pantalla mide la **tasa de reparación** por versión justamente para eso. Las rueditas se quitan cuando los datos muestran que ya no las tocas, no por fe — hoy repara 57%, así que todavía no.

### Added — la dimensión ESTILO en las dos rúbricas (r7 / rv2)

*"Un juez con sombrero de stailist: ¿el outfit es OK considerando los gustos de la persona y el estilo que buscaba?"*. Hueco real: el motor recibía la marca de estilo y **el juez no**, así que ignorar los gustos salía con 5. Ahora el juez lee las MISMAS líneas que el motor (referencia + sus palabras + arquetipo destilado).

**La excepción de Roberto, codificada:** *"si una persona tiene su estilo boho y va a una boda de gala, no tiene mucha holgura"*. **La formalidad ACOTA al estilo, no al revés** — en casual el estilo manda; en formal/etiqueta solo cabe en detalles y no se castiga por "no verse de su estilo". Y sin estilo declarado la dimensión queda neutra y **no se promedia**: un 3 constante con cara de medición ensuciaría la comparación entre corridas.

### Added — calibración humana, la defensa anti-Goodhart

Un juez contra el que se optimiza deja de medir. La pantalla sirve una muestra de **20-30 looks** (prioriza los no marcados y **los que texto y visión vieron distinto**, que es donde una marca humana informa más) y reporta el acuerdo de cada capa contra el humano. Los jueces solo se revelan **después** de marcar.

### Notes — la primera línea base (v43 · Gemini 3.5 Flash · r7/rv2)

37 looks, 13 días del pool v4, **$2.39**, cero errores.

| dimensión | texto | visión |
|---|---|---|
| ocasión | 4.59 | 4.92 |
| clima | 4.38 | 4.49 |
| armado | 4.38 | 4.49 |
| **estilo** | **3.57** | **4.19** |
| **wow** | **3.16** | **3.51** |
| promedio | 4.02 | 4.32 |
| aprobado | 92% | 92% |

**Las dos más bajas son las dos que no son "no romper nada": estilo y wow.** El motor cumple ocasión y clima casi perfecto y se queda en "correcto pero plano" — que es literalmente la etiqueta que Roberto usó para el 3 del wow.

Reglas de código: **3% de looks con violación** (1 de 37). El juez de producción **reparó 57%** y rechazó 0.

### Fixed
- `RUBRICA_TRUNCADA` real en la primera corrida: la dimensión nueva alargó el análisis y 700/900 tokens quedaron cortos. Truncar sale más caro que el margen — se paga la llamada entera y no queda nota. Ahora 900 (texto) y 1100 (visión).

### Added — `scripts/eval-correr.ts`
Correr un eval completo desde la terminal (media hora sin nadie mirando) y llegar al marcador ya hecho. Llama `lib/evales/paso.ts`, el MISMO archivo que la pantalla: no hay arnés que pueda derivar del producto.


## [0.2.128.0] - 2026-08-07

### Added — la rúbrica que MIRA

Idea de Roberto: *"hemos visto que yo veo cosas que tú no ves. Igual el modelo de visión ve cosas que yo hubiera visto, y nos podemos ahorrar; lo metemos como última capa del loop"*. El diagnóstico es exacto: **cuando él vota ve una cuadrícula de FOTOS; el juez de texto solo ve nombres**. Todo lo que vive en la imagen y no en el nombre —el tono real, la textura, si dos piezas se pelean a la vista— le es invisible.

`lib/engine/rubrica-vision.ts` le pasa al modelo de visión **las mismas fotos que ve el humano al votar**, con el mismo brief y el mismo schema que la rúbrica de texto (si cambiara la vara, la comparación no diría cuál ve más sino que miden cosas distintas).

**Lo que NO juzga, a propósito: el try-on renderizado.** Ese lo inventa un modelo de imagen que alucina, así que juzgarlo sería juzgar al renderizador y no la decisión del motor — un buen outfit con mal render saldría castigado. Y cuesta ~$0.13 y 16s por look, contra las fotos que ya existen.

### Notes — medido sobre los 116 looks marcados del veredicto

| | acuerdo | de sus 21 👎 |
|---|---|---|
| rúbrica de texto | 80% | caza 7 |
| **rúbrica visual** | **83%** | caza 7 |

**De los 11 👎 que hoy no caza nadie, la visión caza 2.** Modesto — pero el costo es **$0.19 por 116 looks** ($0.0016 cada uno, **5× más barato que el juez de texto**), y uno de los dos hallazgos es notable:

> *"La mezcla de café y gris carbón junto con el vino resulta discordante"*

Es **exactamente el patrón que los datos de Roberto habían mostrado** (café+negro+gris, 46% de 👎, p = 0.009) y que se decidió NO convertir en regla por muestra chica. El juez visual lo levantó solo, sin conocer ese análisis. Dos fuentes independientes apuntando al mismo sitio.

El otro: *"la camisa de lino de cuello cubano es demasiado informal para un blazer sastre"* — un desajuste de registro que el nombre de la prenda no delata.

**Cobertura combinada de los 21 👎: de 10 (48%) a 12 (57%).** Se gana el lugar como **buscador de reglas**, no como compuerta — por lo mismo que el juez de texto: lo que gatea la generación deja de poder evaluarla.

### Fixed

- **La puerta común solo admitía UNA imagen.** Juzgar un look es ver todas sus prendas juntas; ahora `Peticion.imagenes` acepta la lista y los tres adaptadores (Anthropic, Gemini, OpenRouter) la mandan en orden.
- **El schema de la escala, en el mínimo común denominador.** Anthropic rechaza `minimum`/`maximum` en enteros y Gemini rechaza `enum` de enteros — las dos se descubrieron corriendo, con 136 y 116 llamadas fallidas. Queda el entero pelón, con el rango en el prompt y la validación al leer (`normalizarNota`), que es donde una validación puede hacer algo.

## [0.2.127.0] - 2026-08-07

### Changed

- **El motor de outfits pasa de Opus 5 a Gemini 3.5 Flash.** Es lo que dice la regla que Roberto escribió **antes** de votar, sobre 20 pares ciegos del pool v4: pares **6-5** (con el voto huérfano excluido), defectos **5 contra 3** (dentro del doble permitido) y **clima 0 contra 1**. Las tres condiciones se cumplen.

  **Lo que esto NO dice es que arme mejores looks**: con **p = 1.000** son indistinguibles, y la regla obliga a declarar el motivo real — **costo −42%** ($0.152 contra $0.260 por generación) y **latencia −44%** (27s contra 48s), que es tiempo que la persona siente esperando.

  **Solo el motor de outfits.** La cápsula ideal y el viaje siguen en Opus: el veredicto midió outfits y nada más, y extrapolar a lo que no se midió es exactamente lo que este comparador existe para no hacer. Revertir es una línea.

  *(Corrección honesta: había recomendado esperar porque los espejos salieron 0/2. Investigándolo, **uno de esos dos flips fue el bug del voto huérfano**, no inconsistencia de Roberto. La razón para dudar era mía.)*

### Fixed

- **La guarda de "sin API key" seguía clavada a Anthropic** mientras el motor ya corría en Gemini: sin la llave de Google el motor habría tronado con un error opaco en vez del `sin_api_key` limpio que la ruta traduce. **Lo cazó su propio test en el mismo momento del cambio.** Ahora la llave se elige por proveedor.

### Notes — verificación de las 5 reglas nuevas, sin votar a nadie

6 briefs donde cayeron las violaciones, los dos motores, medido con el chequeo determinista:

| | veredicto (antes) | verificación (ahora) |
|---|---|---|
| violaciones totales | 41 de 117 looks (**35%**) | 3 de 35 (**8.6%**) |
| las 5 reglas nuevas | 26 | **0** |

Y el crítico cita las reglas al reparar: *"cambié los mocasines burdeos por botines para que no se congele con este frío"*, *"le meto la camiseta blanca"*, *"el blazer suelto con pantalón negro distinto lee como separates; lo cambié por el traje marino"*. **24 de 35 looks reparados antes de que nadie los viera** — que es exactamente el principio que pidió Roberto.

## [0.2.126.1] - 2026-08-07

### Added

- **`separates-en-evento-formal`**, y es la regla mejor respaldada de toda la tanda: salió de **dos fuentes independientes que no se hablan**. Roberto la escribió cuatro veces votando (*"No mantuvo el traje completo"*, *"a menos que el pantalón y saco sean del mismo traje, esto está mal"*) y **el juez automático la levantó solo**, en looks distintos: *"el blazer marino con pantalón gris es un combo de separates, no el traje oscuro que pide una boda formal de noche en salón"*. Blazer con pantalón de otro juego es correcto en la oficina y corto en una boda; la regla solo dispara con formalidad formal o de gala, y solo si el clóset tiene traje.

### Notes — medido: ¿debe el juez ser una compuerta del pipeline?

Roberto: *"si el juez está detectando cosas, podemos meterlas en una iteración antes… que se corrijan los errores que detecta"*. El principio es correcto — **si una máquina detecta un error, que no llegue al humano** — y ya está construido así: las reglas de código viajan al crítico como hallazgos verificados y él repara (`verdict: reparado` en los reviews).

Lo que los datos dicen sobre añadir el **juez** como segunda compuerta, medido sobre los 117 looks del veredicto:

| de los 21 looks que Roberto marcó 👎 | los caza |
|---|---|
| el código solo | 3 |
| **el juez solo** | **2** |
| los dos | 5 |
| **nadie** | **11 (52%)** |

El juez aporta **2 catches únicos de 21**. Como compuerta es débil, cuesta 3 llamadas más por generación, y —lo grave— el momento en que gatea la generación **deja de poder evaluarla**: todo look habría sido filtrado para pasarle.

Pero como **buscador de reglas** vale oro: sus 7 rechazos únicos son casi todos de registro (*"demasiado urbano/motero para una oficina"*, *"separates, no el traje que pide una boda formal"*), y de ahí salió la regla de arriba. El camino que sí compone: **el juez encuentra el patrón → se escribe la regla en código → el código hace la pasada previa**. Determinista, gratis, y no se puede adular.

## [0.2.126.0] - 2026-08-07

De la cosecha del veredicto: 4 reglas nuevas, un bug mío de la pantalla de votar, y **dos preguntas contestadas con datos en vez de con opinión**.

### Fixed

- **Se podía votar un look que solo un lado armó**, y ese voto contaba para la mayoría del par. Es lo que hizo que el par 6 saliera "empate" y su espejo "gana Gemini": la **única** diferencia entre los dos era un voto emitido contra un lado vacío. Se leyó como que Roberto fue inconsistente cuando el inconsistente era yo. Ahora ese look dice que no se vota y por qué.

### Added — las reglas, todas salidas de sus comentarios

- **`sueter-sin-base`**: la observación más repetida del veredicto — **7 comentarios** de "falta t-shirt abajo", en los dos motores. Textual: *"en un suéter tiene que haber casi siempre algo más abajo, tipo polo, playera o camisa, deberíamos añadir eso a la rúbrica"*. El cuello tortuga queda fuera: es cerrado y va a piel por diseño.
- **`zona-duplicada`**: *"metió dos pares de zapatos"* (mocasines burdeos + zapato formal negro) y *"metió suéteres repetidos"*. Dos criterios porque el cuerpo no es simétrico — pies y piernas admiten **una sola** prenda aunque sean de tipos distintos; el torso solo prohíbe repetir el **mismo tipo**, porque camiseta bajo camisa es exactamente lo que pide la regla de arriba.
- **`manga-corta-con-saco`**: *"Manga corta con saco jamás!!"* — dos veces en el mismo veredicto y con signos de admiración.
- **`mocasin-en-frio`**: ver abajo.

### Notes — las dos preguntas, contestadas con sus 309 looks marcados

Roberto pidió investigar el mocasín en frío y las combinaciones de color, reconociendo que era *"opinión personal"*. Sus propias marcas dan la respuesta:

| | 👎 | vs línea base 16% | p |
|---|---|---|---|
| mocasín **en frío** | **44%** (n=9) | frío sin mocasín: **6%** | **0.038** |
| mocasín fuera del frío | 16% (n=85) | igual que la base | — |
| **café + negro + gris** | **46%** (n=13) | — | **0.009** |
| café + gris (sin negro) | **4%** (n=23) | el mejor de todos | — |
| café + negro (sin gris) | 13% (n=24) | normal | — |

**El mocasín se volvió regla**: el problema no es el mocasín, es el mocasín *en frío* — el mismo escote y suela fina que ya lo descalifican en lluvia. Repartido en 4 briefs y los dos motores.

**El color NO se volvió regla, a propósito.** La señal es fuerte y limpia (p = 0.009, 11 briefs distintos), pero una regla de "café+negro+gris = mal" marcaría **7 looks que Roberto aprobó** — entre ellos *"Tortuga y lana en clave chocolate"* y *"Charcoal bien capeado"*. El patrón que se alcanza a ver es que el café falla cuando aparece **huérfano** entre neutros fríos, y funciona cuando se repite o cuando no compite con negro. Con n=13 eso es una hipótesis, no una regla: escribirla ahora sería castigar looks buenos por una correlación que no está aislada.

## [0.2.125.2] - 2026-08-07

### Fixed

- **La pantalla donde se califica el comparador mostraba la clave cruda.** Roberto, votando el veredicto: *"aquí no está tan claro al decir formal cuál era el dress code del evento"*. Decía `Pidió: "una boda de noche, en salón" · formal` — la misma jerga que la app ya le traduce al usuario, sin traducir para **quien juzga**. Un dato que no se puede leer no se puede calificar. Ahora dice **"traje y corbata (formal · etiqueta)"**, con el ancla del género del dueño del clóset.
- **Y la causa: esa tabla vivía escrita CUATRO veces** — wizard, prompt del motor, rúbrica y la pantalla de votación. Cuando el criterio cambió ayer ("formal es traje y corbata, no esmoquin") se actualizaron tres y **la cuarta se quedó atrás**. Ahora vive en `lib/formalidad.ts` y las cuatro la leen de ahí. Es la misma consolidación que ya se hizo con el código de trabajo (`lib/dress-code.ts`), por la misma razón.

## [0.2.125.1] - 2026-08-07

### Changed

- **Pool de briefs v4: el trabajo se parte igual que la lluvia.** Roberto: *"pero podríamos tener un día que sí veo cliente y otro que no"*. Y no es solo cobertura — **sin el flag explícito, un clóset con código "depende del día" haría que TODOS los briefs de trabajo corrieran en modo cubrirse-en-medio**, así que el veredicto habría medido el hedge en vez del criterio. Su perfil es justamente ese caso.

  Los tres briefs de trabajo declaran ahora si ve cliente, y entra **un par espejo a mismo clima** (templado con cliente / día normal, 18°C los dos): lo único que cambia es el flag, así que mide directo si el motor distingue. Un motor que arme lo mismo en los dos falló — y ese fallo no se veía en ningún lado.

  Verificado con el prompt real: el mismo brief a 18°C produce *"HOY NO VE CLIENTE: no lo sobrevistas de junta… sin saco obligatorio"* contra *"HOY SÍ VE CLIENTE: sube el registro — saco o blazer… hoy NO es día de jeans"*.

- Las etiquetas de esos briefs pasan de "oficina" a "trabajo", igual que la app.

## [0.2.125.0] - 2026-08-07

### Added

- **"¿Hoy ves cliente?" — la pregunta del día para quien dijo "depende del día".** Roberto preguntó qué pasaba si elegía esa opción, y la respuesta honesta era: **era la peor atendida de las cuatro**. El motor se cubría en business casual y le pasaba la pelota al tip, así que salía mal por los dos lados — corto el día de cliente, tieso el día que no. Y es precisamente la persona para quien la respuesta sí cambia (*"trabajo en home office pero cuando veo cliente me visto más formal"*).

  Elegir "depende del día" **es la persona diciendo que ese dato es del día, no de ella** — así que ahora desbloquea un toggle en el wizard, igual que el paraguas: solo lo ve quien lo eligió, default "no", y **no se persiste** (es del día). Con la respuesta el motor deja de hedgear: día de cliente pide saco y descarta jeans; día normal dice explícitamente que **no lo sobrevista**.

  Verificado end-to-end: con "sí veo cliente" el motor armó *blazer marino + camisa blanca + zapato formal*, y el tip fue *"deja el blazer desabotonado al caminar y abotónalo justo al sentarte con el cliente"*. Prompt **v43**, rúbrica **r6**.

## [0.2.124.1] - 2026-08-07

### Added

- **El código de vestimenta del trabajo, editable en Perfil** (`/perfil/trabajo`). Lo cachó Roberto antes de lanzar el veredicto: *"¿no debería yo antes en mi perfil contestar la info de trabajo para probar la calibración y así poder correr las pruebas bien?"*. Tenía razón por partida doble — **el comparador corre sobre el perfil de quien califica**, así que sin el dato los briefs de trabajo se generan sin calibrar y no prueban nada; y la pregunta del wizard se hace **una sola vez**, así que contestar mal era permanente y quien nunca eligiera "trabajo" no tenía forma de darlo.

### Fixed

- **La pregunta se sentía repetida, y con razón.** El quiz de estilo de vida ya pregunta *"¿cómo son tus días entre semana?"* con "Oficina formal / Oficina creativa o casual". Son cosas distintas —aquella describe la **forma** de la semana (multi: oficina, remoto, estudio) y alimenta la cápsula; esta el **registro** de la ropa y alimenta el piso de formalidad— pero si no se dice, nadie lo nota. Ahora las dos pantallas tienden el puente: *"Me dijiste que tu día es oficina creativa o casual — esto es lo que me falta: qué significa eso en ropa"*.

  Es justo la distinción que le faltaba a Roberto para poder calificar: *"oficina creativa o casual"* no dice si eso es camisa sin saco o jeans y camiseta.

## [0.2.124.0] - 2026-08-06

Última pieza de calibración antes del veredicto nuevo. Idea de Roberto: *"para desbloquear el modo de oficina el usuario debería de responder algunas preguntas de calibración"*.

### Added

- **"¿Cómo te vistes para trabajar?", una sola vez.** "Oficina" no es un registro: son cuatro, y sin saber cuál el motor adivinaba. Roberto no pudo calificar un look de trabajo en la corrida de verificación — *"depende del tipo de oficina… el look está padre pero depende"* — porque ni el motor ni él tenían el dato. Mismo patrón que "evento" a secas y que el clima sin traducir: **una pregunta que el producto nunca hizo, y sin la cual ni el motor acierta ni el humano califica**.
- **Se pregunta la primera vez que eliges "trabajo", no en el onboarding**: quien nunca use la ocasión no paga fricción. Se guarda en el perfil (`work_dress_code`, migración 0118) y no se vuelve a preguntar — es un dato de persona, no de día (a diferencia del paraguas).
- Cuatro opciones, con **la ropa de titular y la jerga de pista**, y **por género** (mismo criterio que la formalidad): *traje o al menos saco* · *camisa o polo, sin saco* · *jeans y estoy bien* · **depende del día**. Esa última no es relleno: Roberto la pidió sin nombrarla (*"igual hay una cena de trabajo importante donde sí importe ir de traje"*), y al motor le da una salida accionable — arma en business casual y explica en el tip cómo subir o bajar el registro.

### Changed

- **"Oficina" → "Trabajo"** en toda la app. La palabra dejaba fuera a quien no trabaja en una. La clave guardada no cambia (vive en `outfits` y en `last_objective`); solo la etiqueta.
- El motor (**v42**) y la rúbrica (**r5**) reciben el código. Sin él, la rúbrica lo dice explícitamente y **no castiga** por no acertarle a un registro que nadie declaró.

## [0.2.123.1] - 2026-08-06

### Fixed

- **La formalidad se preguntaba en jerga que la gente no entiende.** Roberto: *"la mayoría de la gente tiene el problema de que si lee formal, coctel, gala o etiqueta, no sepa cuál es el dress code que implica"*. Tiene razón — preguntar con una palabra que la persona no entiende no es preguntar. **Se invirtió la jerarquía**: la ROPA es el titular y la palabra de la invitación es la pista. Funciona en los dos sentidos: quien no conoce las palabras elige por lo que se pondría; quien trae la invitación busca su palabra ahí.
- **Y va por género**, porque el ancla concreta lo es: *"traje y corbata"* no le dice nada a una mujer — y la usuaria objetivo de este producto es mujer. Hombre ve "saco, sin corbata / traje y corbata / esmoquin"; mujer ve "de coctel / vestido largo o midi / vestido largo de gala". El wizard no recibía el género; ahora sí (Hoy y onboarding).
- **"Un evento" ya no se salta la pregunta de formalidad en el onboarding.** Quien elegía "un evento" en el onboarding recibía su **primer** look sin que nadie le preguntara si era una boda de etiqueta o una cena — justo el hueco que vuelve incalificable el resultado. Un tap de más para ellos; el resto no lo nota.

## [0.2.123.0] - 2026-08-06

De la corrida de verificación: los **dos** motores fallaron idénticamente en el brief nuevo de boda, y los comentarios de Roberto fueron quirúrgicos.

### Fixed

- **"Formal" mandaba al motor al esmoquin.** Los dos motores sacaron esmoquin para "boda formal de noche"; Roberto: *"en una boda mexicana formal jamás iría alguien así vestido… la gente va de traje y corbata"*. Es **el mismo hueco que el clima**: una suposición cultural que nunca se escribió. Ahora las etiquetas usan **el vocabulario de la invitación** — `formal` = traje y corbata (y prohíbe explícitamente el esmoquin), `etiqueta rigurosa` = esmoquin con su código completo. La clave guardada no cambia; sí la etiqueta, la ayuda en pantalla y lo que recibe el motor (**v41**) y la rúbrica (**r4**).
- **La regla del smoking tenía dos huecos, y son exactamente los dos comentarios de Roberto.** No miraba el **cinturón** (*"Smoking no lleva cinturón"* — era la única diferencia entre el esmoquin que aprobó y el que rechazó) y solo cazaba "corbata que no es moño", nunca "sin nada al cuello" (*"falta moño de Smoking"*, que marcó **incluso en el look que aprobó**). Las dos ahora se comprueban.

### Notes

Los votos de Roberto dan el estándar completo, y no es "esmoquin vs traje": traje marino + corbata → 👍 los dos motores · esmoquin sin cinturón → 👍 (*"falta moño"*) · esmoquin **con** cinturón → 👎 · blazer con cuello tortuga o camisa negra → 👎 los dos.

## [0.2.122.2] - 2026-08-06

De Roberto votando la corrida de verificación: abrió la pestaña "Look 3" y un lado estaba vacío, sin explicación.

### Fixed

- **"Este lado no armó un 3º look" se leía como un fallo, y no lo es.** Investigado: ese lado **generó 2 looks**, el juez no rechazó nada (2 looks, 2 reviews). El prompt pide *"2 o 3 outfits"* — entregar 2 es una respuesta legal. Ahora el mensaje lo dice, y la pestaña se marca con "–" para que no prometa una comparación que no existe.

### Added

- **"looks por par" en el marcador.** Entregar 2 es legal, pero **es menos**, y hasta hoy no se veía en ninguna parte — Roberto lo descubrió por accidente al abrir una pestaña vacía. Medido sobre los 93 lados de la base: **producción entregó 3 el 100% de las veces (47/47); Gemini, el 94% (30/32)**. Diferencia chica, pero es entrega real y ahora se mide en vez de aparecerse.
- El promedio se calcula **solo sobre lados que entregaron algo**: un lado que tronó ya se cuenta como error y bajarle además el promedio lo castigaría dos veces por lo mismo (con su test).

## [0.2.122.1] - 2026-08-06

### Fixed

- **El mocasín se colaba a la lluvia.** Roberto lo vio votando la corrida de verificación: un look con chamarra impermeable ✓ y **mocasines negros**. La regla nueva miraba solo el material, y el mocasín es de **piel** — pasaba limpio. Medido en la corrida: **5 de los 17 looks de lluvia** traían mocasín.

  Las dos cosas que dijo Roberto son ciertas a la vez: *"Mocasín en lluvia no aplica"* (su voto del veredicto) y *"tenis de piel o con suela grande, botines Chelsea… seamos un poquito más tolerantes"* (su criterio). No se contradicen porque **la diferencia no es de qué está hecho el zapato sino de cómo**: el Chelsea cubre el tobillo, el tenis de suela gruesa te levanta del charco, y el mocasín es escotado y de suela fina — el agua entra por arriba.

  Ahora **la forma manda sobre el material**: mocasín, náutico y sandalia caen siempre; bota, botín, tenis y zapato formal los sigue juzgando el material, como pidió. El orden importa — al revés, la piel absolvía al mocasín.

- El estándar se actualizó en los **tres** lugares que tienen que decir lo mismo: el código (`reglas-ejecucion`), el prompt del motor (**v40**) y la rúbrica (**r3**). Si el juez calificara con una vara distinta a la que el motor recibe, mediría otra cosa.

## [0.2.122.0] - 2026-08-06

### Added

- **La rúbrica automática (r2) + su medición de acuerdo.** Idea de Roberto: "la rúbrica va a tardar demasiado viéndolo yo — automatizarlo, un learning loop". `lib/engine/rubrica.ts` califica un look contra su brief con 4 dimensiones derivadas de sus 32 comentarios reales (ocasión, clima, armado, y **wow como escala** — su etiqueta "correcto pero plano" es el 3), más un `aprobado` global. El juez recibe **el mismo brief que el motor** (plan, formalidad, paraguas): calificar "evento" a secas era justo lo que a Roberto le impedía votar.
- **El gate que la mantiene honesta**: `scripts/rubrica-acuerdo.ts` la corre contra las 148 marcas 👍/👎 ya emitidas (a ciegas, ya pagadas) y mide el acuerdo. r1: 61%. r2 (un ancla precisada): **70%** — todavía nivel "filtro grueso", no autopiloto. Las discrepancias restantes están dominadas por el juez aplicando **el estándar de hoy** (calzado en lluvia, capas en templado) a looks v38 que Roberto marcó antes de fijar ese estándar — sus propios comentarios contradicen varios de sus 👍 ("mocasín en lluvia no aplica" en un look con 👍). La calibración real viene de marcas frescas sobre looks v39.
- Escrito en el código lo que la rúbrica **no** puede decidir: modelos. Un juez Claude prefiere looks de Claude; esa decisión se queda con el voto ciego humano.

## [0.2.121.0] - 2026-08-06

El clima, que resultó ser el hueco más grande del motor. Sale del veredicto de Gemini: 4 de los 6 defectos de clima de toda la corrida cayeron en el brief de lluvia — **y los dos motores fallaron ahí**, producción incluida.

### Fixed

- **El prompt decía la temperatura y nunca qué significa vestirse a esa temperatura.** Literalmente `Clima de hoy: 18°C, nublado.` y nada más. Que Opus acertara era suerte: adivinaba el registro mexicano. Gemini adivinó distinto y apiló lana sobre lana sobre lana a 18°, dos veces. La app **ya tenía** esa traducción —el selector de clima dice "Templado · manga larga ligera"— pero nunca llegaba al motor. Ahora sí, y con las **mismas cinco bandas** que ve la usuaria: si la pantalla promete una cosa y el motor entiende otra, pidió una cosa y recibió otra (`queSePoneA`, prompt **v39**).
- **La lluvia viajaba como una palabra suelta.** Ahora dice qué exige — y además **se comprueba en código**, porque una instrucción que se puede ignorar no es una garantía: producción, con el prompt afinado 38 veces contra Claude, igual mandó mocasines a la lluvia.

### Added

- **Regla `lluvia-calzado`**: el criterio es el **material**, no el tipo de zapato — palabras de Roberto: *"unos tenis de piel o con suela grande… seamos un poquito más tolerantes"*. Piel y sintético pasan; ante, gamuza y tela no; las sandalias caen aunque sean de piel. **Es el fallo que de verdad importa**: en 2 de los 3 casos de Gemini la chamarra impermeable SÍ estaba y el look se caía por unos tenis. Una regla sobre la capa exterior —lo que yo iba a escribir— habría pasado por encima de los dos.
- **Regla `lluvia-sin-impermeable`**, condicionada al paraguas.
- **"¿Llevas paraguas?"** en el selector de clima, y solo cuando dice que llueve (cero fricción para quien no le llueve). Idea de Roberto, y es más que un refinamiento: **el paraguas tapa el torso pero no los pies**, así que abre la capa de arriba y deja el calzado firme. Sin esa distinción, la temporada de lluvias entera colapsaría a la misma chamarra impermeable. Default en "no" — no contestar cae del lado seguro.
- **Pool de briefs v3**: la lluvia se parte en dos, con paraguas y sin él. El de "con paraguas" mide algo que hasta hoy no se medía: la **sobre-aplicación** de la regla (un motor que igual te encaja la impermeable aunque ya no haga falta).

### Fixed (de paso)

- **El mapeo brief → motor estaba copiado en dos lados y ya había derivado**: `scripts/ver-prompt.ts` no pasaba `paraguas`, así que imprimía "NO lleva paraguas" para el brief que sí lo lleva. Una caja negra que miente es peor que no tenerla. Ahora hay un solo traductor (`peticionDeBrief`).

## [0.2.120.1] - 2026-08-06

### Fixed

- **"No pude armar otros looks" ya dice por qué.** Era el TERCER `catch` mudo del día en un camino de IA: la acción devolvía `{ok: false}` sin registrar nada, así que al buscarlo en los logs de producción no había absolutamente nada — la única pista era el texto rojo en pantalla. Ahora el motivo se registra en el servidor **y viaja a la pantalla**, debajo del mensaje.
- Mismo tratamiento a los otros cuatro `catch` mudos de la cápsula y el viaje: armar la cápsula ideal, los swaps, regenerarla, y el juez de looks (que falla hacia adelante a propósito — pero "falla en silencio" no es lo mismo que "falla sin dejar rastro").

### Notes

Reproducido con los datos reales de Roberto (31 prendas empacables): **generar 18.9s + juez 7.8s, 10 looks, sin error**. El camino que falló es `generateTripOutfits`, que era **uno de los once** que heredaron el thinking encendido y se arregló en la 0.2.119.0 — desplegada a las 18:44, once minutos antes de su clic.

Que ya funcione con el código nuevo y le fallara a las 18:55 apunta a una **pestaña abierta desde antes del deploy**: las server actions de una página vieja siguen pegándole al deployment viejo. Es una hipótesis, no una conclusión — y no se puede confirmar porque el `catch` era mudo. **Recargar la página y reintentar** es la prueba.

## [0.2.120.0] - 2026-08-06

De Pablo: leer las prendas de una foto salió bien, pero **generar sus imágenes tardó**.

### Notes — medido

Un render de prenda tarda **17.3s de promedio** (3 corridas). Como el pool corre hasta 4 en paralelo, 3 prendas ≈ 17s, no 3×17. El culpable no es el pool: es el modelo.

El mismo prompt y la misma foto con el modelo **rápido** (`gemini-3.1-flash-image`, el que la app ya usa para los arquetipos del catálogo y para el fallback texto→imagen): **7.7s** — **2.2× más rápido**. Probado en las tres categorías difíciles (top, calzado, pantalón); las salidas no se distinguen a ojo. **El cambio NO se hace de oído**: queda para que Roberto decida viendo los renders.

### Fixed

- **Eran SEIS copias del mismo fetch a Gemini**, no dos. Al consolidar el try-on y el avatar aparecieron cuatro más: render de prenda, arquetipos, y los dos try-on de wishlist. Todas se habían quedado sin el reintento, el timeout y el motivo real de fallo — cada 500 pasajero dejaba una prenda marcada "failed" sin decir por qué. Todas pasan ahora por `lib/gemini-imagen.ts`, que ahora acepta modelo y proporción.

### Added

- **El guard se extiende a las imágenes**: `lib/thinking.test.ts` truena si algún archivo genera imágenes con su propio fetch en vez de la puerta común. **Encontró dos copias que yo no había visto** (los try-on de wishlist) en su primera corrida.

## [0.2.119.0] - 2026-08-06

### Fixed

- **La pantalla de esenciales estaba muerta para quien no tuviera su match ya calculado.** A Pablo le decía "No pude calcular — reintentar" para siempre. Roberto lo intuyó: **fue el cambio de modelo**, aunque no como parecía.

  La llamada que compara tu cápsula ideal contra tu clóset apuntaba a un Opus de la **familia 4**, donde el thinking viene apagado. El 2026-08-04 se centralizaron los modelos y pasó a uno de la **familia 5, donde el thinking adaptativo viene ENCENDIDO por default**. El thinking se comió los 4.096 tokens de salida, la respuesta llegó **sin bloque de texto**, y el `catch` mudo del caller lo convirtió en un botón de reintentar que nunca iba a funcionar. Medido en el caso que explotó: thinking ON = 2.963 tokens y 21.8s; OFF = 1.284 y 10.4s — ni siquiera compraba calidad, porque las reglas ya están escritas en el prompt. Verificado contra los datos reales de Pablo (34 prendas ideales × 17 reales): **7.5s, 34 entradas**.

- **Y había ONCE llamadas más con exactamente el mismo hueco**: viaje (outfits, cápsula, sustitutos), arquetipo, cápsula ideal, swaps, preguntas de estilo, ancla, análisis de cuerpo, itinerarios y estilo de referencia. Ninguna tronaba todavía — cada una era una bomba esperando una entrada lo bastante grande. Todas apagadas.

- **El error ya no se traga.** `recalcularMatch` devolvía `{ok: false}` sin registrar nada, que es por qué esto no se pudo diagnosticar leyendo un log: hubo que reproducirlo a mano contra la base.

### Added

- **Un guard que impide que vuelva a pasar** (`lib/thinking.test.ts`): recorre `app/` y `lib/` y truena si un `messages.create` no apaga el thinking. Probado por mutación — al quitarle el apagado a un archivo, falla nombrándolo. Es el tipo de deuda que un test caza y una revisión no.

## [0.2.118.0] - 2026-08-06

Tres fricciones de UX que reportaron Roberto y Pablo probando el flujo.

### Fixed

- **"rehacer el cuerpo" no dejaba rehacer el cuerpo.** Se leía como "déjame elegir otra vez mi cuerpo" y hacía otra cosa: regeneraba con exactamente los mismos datos. Quien quería cambiar su complexión o sus fotos tenía que irse por "ajustar la cara", avanzar, y recién ahí llegar al cuerpo — un camino que nadie adivina. Ahora son **tres botones que dicen lo que hacen**: `otra toma` (lo mismo, otra vez), `cambiar cuerpo` (vuelve al paso que lo define) y `la cara`. Medidos a 375px: 114px por columna, una línea, sin desbordar.
- **El clima ya no viene contestado.** Venía en "Templado" preseleccionado, con su borde de tinta y su bolita llena, y eso hacía **dos** daños: la lista se leía como "ya está resuelto" —así que la píldora de ubicación, que es el camino práctico y el **único que lee la lluvia**, se volvía invisible— y quien pasaba de largo le mandaba 19° al motor sin haberlo elegido. Lo segundo no es cosmético: **"rompe el clima" fue la etiqueta de defecto más marcada del veredicto (5 de 6)**. Ahora nada viene marcado y "armar mi look" espera a que elijas.
- **La salida del onboarding tenía peso de nota al pie.** "entrar a la app" era texto gris de 14px al fondo de la pantalla — el elemento más débil de la vista, siendo la única puerta a la app. Ahora es un botón: toma el lugar primario cuando ya hay render (ahí no compite con nada, porque el de "verme" desaparece) y queda como secundaria con borde mientras el render sigue siendo la invitación principal.

### Notes

- **El avatar no cambió de modelo, y aquí está la prueba**: la imagen la hace `gemini-3-pro-image` y el juez de parecido Haiku 4.5. Cero menciones de Opus en todo el camino del avatar. El último cambio a ese archivo antes de hoy fue el 2026-08-04, y lo único que hizo fue sustituir el string `"claude-haiku-4-5"` por la constante `GUARD_MODEL` — **el mismo modelo**, solo centralizado.

## [0.2.117.1] - 2026-08-06

Persiguiendo "el avatar tarda muchísimo, como tres minutos".

### Fixed

- **El juez del avatar podía bloquear minutos por una función opcional.** Se creaba con `new Anthropic()` a secas, y el default del SDK es **2 reintentos y 10 minutos de timeout** — en una función que Vercel corta a los 60s eso no protege de nada: convierte un mal momento de la API en una persona esperando hasta que la función muera, sin avatar y sin explicación. Y el juez es best-effort por diseño (si no contesta, el avatar pasa igual). Ahora: 15s y un reintento. Medido: 3.0 / 3.2 / 2.9s con las dos imágenes reales, así que 15s es holgado.
- **La segunda generación (la que pide el juez cuando el parecido sale bajo) ya no arranca si no cabe.** Si al llegar ahí ya pasaron 30s, insistir no mejoraba el avatar: mataba la petición contra el límite de 60s y la persona se quedaba sin nada después de esperar. Queda anotado cuando no cupo (`segunda_no_cupo`), porque eso también es un dato.

### Added

- **El evento del avatar ahora separa el tiempo en tres**: `ms_generacion` (Gemini), `ms_juez` y `ms_total`. Con un solo número no se puede decir si la espera fue Gemini, el juez, o todo lo demás — y son arreglos distintos.

### Notes

Cuatro hipótesis medidas y **descartadas** antes de tocar nada:

| Hipótesis | Medición | Veredicto |
|---|---|---|
| Cambió el modelo del avatar | `gemini-3-pro-image` + Haiku de juez desde 0.2.89.0, sin tocar | No |
| El timeout de 30s que puse hoy cortaba generaciones buenas | 4 corridas con el prompt e imagen reales: 15.6 / 16.0 / 16.4 / 17.0s | No |
| El payload pesa demasiado | Gemini devuelve 0.75 MB en base64; el POST del cuerpo ≈ 1.95 MB → 2-8s de subida | No |
| El juez es lento | 3.0 / 3.2 / 2.9s (2.806 tokens de entrada) | No en el caso normal |

Con eso, el camino normal da ~20s para la cara y ~20s para el cuerpo, no tres minutos. **La causa sigue sin identificarse**: la instrumentación que la contestaría se desplegó a las 18:12 y los intentos lentos fueron antes. El siguiente intento ya deja los tres tiempos.

## [0.2.117.0] - 2026-08-06

Del primer flujo completo de Pablo en Android.

### Fixed

- **En Android, el botón de foto abría el carrete directo en vez de ofrecer la cámara.** El `accept` llevaba las extensiones pegadas (`image/*,.heic,.heif`) y eso hace que Chrome resuelva el selector a documentos en vez de mostrar el chooser con la cámara. Ahora va limpio (`image/*`) en el avatar y en añadir prenda — fotografiar la prenda ahí mismo es medio punto de ese flujo. **No se pierde HEIC**: `toUsableImage` lo detecta por `file.type` **o** por la extensión del nombre, así que la conversión sigue igual; lo único que cambia es qué archivos ofrece el selector. (El de "importar carrete" se queda como está: ahí la cámara no aplica.)
- **El avatar no heredaba el reintento del try-on.** Tenía **su propia copia** del fetch a Gemini, así que se quedó fuera del retry y del timeout que `lib/tryon.ts` sí recibió — y el servicio devuelve 500 intermitentes (2 de 8 medidas). Un solo 500 mataba la generación de la cara. Ahora las dos pasan por `lib/gemini-imagen.ts`, la puerta común.

### Added

- **El avatar ahora deja rastro de cuánto tardó** (`ms_generacion` en el evento `avatar_judge`). El motor lo registraba desde siempre (`generation_timing`); el avatar no, y por eso "tardó muchísimo" no se podía contestar con datos: no había forma de separar "Gemini iba lento" de "la subida iba lenta" de "el juez pidió otra generación".
- **Y los fallos dejan rastro**, que antes eran invisibles: la fila de instrumentación se escribe al final del camino feliz, así que una generación que moría antes no dejaba ninguna — en la tabla solo se veían los éxitos. Evento nuevo `avatar_fallo` con el motivo real y el tiempo (migración 0117; el CHECK de `events` es lista blanca y un tipo sin agregar truena el insert en silencio — ya pasó con `trip_item_swap`).

### Notes

- La lentitud de Pablo **no vino de un cambio de modelo**: el avatar usa `gemini-3-pro-image` + Haiku 4.5 de juez desde la 0.2.89.0, y nada de lo de esta semana tocó ese camino. Sus dos generaciones salieron con score 8 y **sin reintento** del juez (el 12% global sí reintenta, que son dos generaciones seguidas).

## [0.2.116.3] - 2026-08-06

### Added

- **Al completar las marcas ya se puede decir cuál te late más de cada par**, look por look. Faltaba y se sentía: juzgando dos looks lado a lado, la opinión natural es comparativa, y la pantalla solo dejaba decir "este sirve / este no" en aislado.
- **Pero NO reescribe el veredicto.** Se guarda en una columna aparte (`prefs_look`, migración 0116) y la distinción es todo el punto: `voto` se emitió **a ciegas y antes** de que el marcador fuera alcanzable —es lo que lee la regla pre-registrada— y esto se anota **después**, con el resultado global ya visible. Sigue siendo ciego por par (las columnas nunca dicen qué variante son), así que es dato bueno; solo es dato **más débil**, y por eso se lee aparte en vez de mezclarse.
- **El marcador lo muestra en su propia sección**, etiquetada "no cuenta para el veredicto". Contesta algo que el voto no contestó: los primeros 16 pares del veredicto de Gemini se votaron mirando **solo el primer look**, así que la preferencia sobre los looks 2 y 3 no estaba registrada en ningún lado.

### Changed

- **La puerta de guardado al marcar ahora pide las dos cosas** por look: el 👍/👎 de cada lado y la preferencia entre ellos. Son preguntas distintas ("¿este sirve?" y "¿cuál de los dos?") y las dos se perdían si el botón dejaba pasar.

## [0.2.116.2] - 2026-08-06

### Fixed

- **El try-on fallaba y no había forma de saber por qué.** Roberto: "está fallando los renders de gemini". Medido contra la API real: de 8 llamadas idénticas a `gemini-3-pro-image`, con la llave y el prompt sanos, **2 volvieron `500 INTERNAL` en ~200ms** y otra corrida murió con `ETIMEDOUT` de red (las buenas tardan 13-18s). O sea: el servicio se cae solo, de forma intermitente, y del lado de Google.
- **Ahora se reintenta lo reintentable.** Antes no había retry: un 500 pasajero se comía el render y la persona veía "sin render (generacion)". Se reintenta una vez ante 5xx, 429 y cortes de red; un 400 (llave mala) o un 200-sin-imagen (filtro de seguridad) NO se reintentan, porque repetirlos da lo mismo.
- **Y se dice el motivo real.** El código nunca leía el cuerpo de la respuesta: 500 de Google, timeout de red, llave inválida y prompt bloqueado salían todos como el mismo `"generacion"`. Ahora el motivo se registra en el servidor y —en el comparador— se muestra en pantalla junto a un botón de **reintentar**.
- **Ninguna espera puede comerse la función.** No había timeout: una conexión colgada se llevaba los 60s de Vercel y la persona no veía ni el error. Ahora hay 30s por intento y 52s de presupuesto total, y el reintento no arranca si ya no cabe.

Todo esto vive en `lib/tryon.ts`, así que lo hereda **producción** ("verme con este" en el detalle del look), no solo el comparador. La lógica de reintento se extrajo a `pedirImagen()` para poder probarla: 6 tests con `fetch` inyectado cubren las cuatro decisiones (qué se reintenta, qué no, qué motivo se reporta, y que el presupuesto se respeta).

## [0.2.116.1] - 2026-08-06

### Fixed

- **"Completar las marcas" usaba otro layout, y era un error mío.** Tenía su propio componente: prendas a 56px, sin try-on, sin etiquetas de defecto y con los tres looks apilados en dos columnas — mientras que votar mostraba un look por pestaña con las prendas al doble y "verme con este". Juzgar un look es el mismo trabajo se entre por donde se entre; verlo peor aquí sólo hacía la marca peor que el voto. Ahora las dos pantallas son **el mismo componente** (`VotarClient`, modo `marcar`), así que marcar hereda try-on, prendas grandes, defectos y comentario por look. Se borró `marcas-client.tsx`.
- **Los defectos marcados en esa pantalla se perdían en silencio.** Las etiquetas ("rompe el clima", "color que choca") se pintaban pero `completarMarcas` no las guardaba. Ahora sí: lo sellado por el pre-registro es el VOTO, no el diagnóstico, y cada tag confirmado es candidato a regla comprobable en código.
- **La puerta de guardado también aplica al marcar**: pide 👍/👎 en los looks de los dos lados antes de dejar avanzar, por la misma razón que en el voto — una marca a medias deja el marcador diciendo "0 👎" cuando lo que pasó es que nadie los miró.

### Notes

- En modo `marcar` **no** hay botones de A/B, y no es un olvido: esos pares ya tienen voto y su corrida ya se puede leer con el reveal encendido. Re-votar con el marcador a la vista no completa una medición, la edita.

## [0.2.116.0] - 2026-08-06

### Added

- **Los eventos del comparador ya son eventos concretos** (pool de briefs **v2**). "Evento · noche templada" era incalificable: una boda y una cena con amigos comparten esa etiqueta y no comparten piso de formalidad, ni calzado, ni registro — marcar "no va para la ocasión" era emitir un juicio sin saber cuál ocasión. Ahora cada evento lleva su `plan` ("una boda de noche, en salón") y su `formality`, **los mismos dos campos que producción le pasa al motor** cuando el wizard los pregunta, no inventos del arnés; la pantalla de voto los muestra arriba. Entró además un evento **de día** (comida familiar) porque no existía ninguno: hasta v1 todo evento era de noche y `pisoDeFormalidad` tiene una rama para evento-de-día que nunca se había medido.
- **La versión del pool se congela en cada corrida** (`pool_version`, migración 0115) y la tabla "Qué modelo usamos" avisa cuando los retadores se midieron en pools distintos. El pool está congelado justamente para que corridas de meses distintos sean comparables; al cambiarlo, esa promesa deja de valer **entre** retadores. Cada corrida sigue siendo justa consigo misma (control y retador resuelven el mismo día); lo que ya no se puede es leer a Gemini contra Sonnet si corrieron pools distintos, y ahora la pantalla lo dice en vez de sumar peras con manzanas en silencio.

### Changed

- **El par no se guarda hasta votar todos sus looks.** Antes bastaba con uno: Roberto votaba el primero, el par se guardaba, y los looks 2 y 3 se quedaban sin ver — **99 de 119 looks del primer veredicto nunca se miraron**. Un botón que deja avanzar a medias termina midiendo lo que nadie miró. El botón ahora nombra lo que falta ("Faltan los looks 2 y 3") en vez de solo estar apagado, y solo exige los looks que **los dos** lados armaron: si un lado trajo dos, el tercero no tiene contra qué medirse. El 👍/👎 sigue siendo opcional — es diagnóstico, no voto.

## [0.2.115.1] - 2026-08-06

### Fixed

- **Las marcas por look ahora se leen con su denominador**, y sin él mentían. El marcador decía "9 👍 · 0 👎" sin aclarar de cuántos: ese "0 👎" se lee como "nada salió mal" cuando en realidad puede querer decir "nadie los miró". En el primer veredicto hubo **20 marcas sobre 119 looks generados**. Ahora dice "N de M revisados", en rojo cuando falta más de la mitad, con un aviso explícito de que lo no marcado NO es lo mismo que lo malo. El voto de cada par sigue siendo completo; lo parcial es el diagnóstico look por look.

## [0.2.115.0] - 2026-08-06

### Changed

- **Se vota look contra look, no conjunto contra conjunto.** Idea de Roberto a media votación del primer veredicto: comparar dos looks es mucho más fácil que sostener seis en la cabeza, y el resultado del par SE DERIVA de los individuales. Ahora los botones "Gana A / Empate / Gana B" viven **dentro de la pestaña del look** que estás viendo, y el par se resuelve por mayoría. La unidad estadística no cambia —sigue siendo el par— porque los 2-3 looks de un lado salen de UNA sola llamada al motor y no son votos independientes; contarlos por separado inflaría la significancia.

### Fixed

- **Los botones de voto estaban al final de la página y engañaban.** Se leían como si aplicaran al look en pantalla cuando en realidad cubrían los tres, y el texto que lo aclaraba estaba *debajo* de los botones. Roberto votó 16 pares de su primer veredicto guiándose solo por el primer look sin saberlo; esa corrida quedó anotada con el caveat para que no se lea de más.

## [0.2.114.0] - 2026-08-06

### Changed

- **La pantalla de votar, rehecha: una pestaña por look.** Antes apilaba los 3 looks de cada lado en dos columnas, y en un celular eso deja ~170px por lado: las prendas salían a 56px (imposibles de juzgar), el try-on era lo único legible porque ocupaba el ancho completo, y las etiquetas de defecto caían al fondo de la columna leyéndose como si aplicaran a los tres looks a la vez. Ahora cada lado muestra UN look, **las prendas se ven al doble de grandes**, y cada control —👍/👎, defectos, comentario, "verme con este"— vive dentro del look al que pertenece. Los dos lados siguen lado a lado: comparar A contra B es la tarea, y apilarlos obligaría a recordar uno mientras se mira el otro.
- **Los defectos ahora son POR LOOK**, no por lado. Era la pieza que había quedado fuera de sitio desde que el 👍/👎 y el comentario pasaron a ser por look. Las corridas viejas conservan sus defectos por lado y el marcador suma las dos formas, para no perder la cosecha de la primera corrida solo porque el formato mejoró.
- Los nombres de look se recortan a dos renglones para que las prendas de los dos lados arranquen a la misma altura: en una pantalla de comparar, que una columna empiece más abajo que la otra rompe justamente lo que se viene a hacer.

## [0.2.113.0] - 2026-08-06

### Added

- **"Qué modelo usamos": el resumen de todos los retadores en una sola tabla.** La decisión no vive en ninguna corrida sola — para contestarla había que abrir tres marcadores y sostenerlos en la cabeza. Ahora cada retador aparece contra producción con sus victorias, empates, costo por look, tiempo y fallos, sumando todas sus corridas. Son comparables entre sí porque los briefs están congelados: los tres resolvieron los mismos días.
- **Marca a quién no le alcanza la latencia**, aunque gane la votación: si el generador pasa de 60 segundos no cabe en producción (el juez todavía corre detrás). Kimi K2.6 corre a 129s de promedio y ahí queda descalificado por física, no por gusto.

## [0.2.112.0] - 2026-08-06

### Added

- **Try-on de CADA look, no solo del primero.** La primera versión rendereaba únicamente el look 1 de cada lado para no multiplicar costo y espera; se quedó corta en cuanto llegó el 👍/👎 por look, porque ahora se juzgan los tres y solo se podía ver puesto uno. Ahora cada carta trae su botón "verme con este". Sigue pidiéndose **de a dos**: al pedir el look 2 se renderean el 2 de los dos lados, para que el ruido del render quede simétrico entre variantes — un lado con foto contra otro con cuadrícula mediría el formato, no el look. Los renders ya hechos se conservan (no se re-pagan).

## [0.2.111.2] - 2026-08-06

### Fixed

- **Lo que falta por hacer estaba escondido abajo del marcador.** Roberto entró a completar las marcas de sus primeros pares, vio el resultado, concluyó "ya terminó" y nunca llegó a la tarjeta: vivía octava en la página, debajo de los costos y las notas. Ahora las tarjetas accionables (marcas pendientes, pares sin generar) van pegadas al título: el marcador es lectura, eso es trabajo.
- **La lista de corridas dice qué te falta en cada una** ("te falta: votar 5 · marcar looks de 3") sin tener que entrar a revisarlas una por una.
- **La lista solo muestra corridas sobre TU clóset.** El permiso de admin deja ver todas y eso sirve para depurar, pero en la lista de trabajo una corrida ajena es ruido: dice "te falta votar" de un experimento de otra persona sobre prendas que no son tuyas.

## [0.2.111.1] - 2026-08-06

### Changed

- **Generar un lado del comparador salió a `lib/comparador/generar-lado.ts`**, compartido por la ruta admin y por `scripts/correr-vistazo.ts`. Ahora se puede dejar un vistazo entero generado sin nadie mirando —para llegar solo a votar— sin escribir por segunda vez el mismo camino. La ruta pone HTTP y sesión; el script, el cliente de servicio; el trabajo real vive en un archivo.

## [0.2.111.0] - 2026-08-06

### Added

- **Un comentario por look, no solo por par.** El 👍/👎 dice CUÁL look arrastró el voto; el comentario dice POR QUÉ, que es lo único que se convierte en regla. Antes el porqué vivía a nivel del par: servía para explicar la comparación, pero no para señalar el defecto de un look concreto entre seis. Va en las dos pantallas —al votar y al completar marcas de pares viejos— y el marcador los muestra juntos, ya revelados a su variante, bajo "qué le viste a cada look".

## [0.2.110.1] - 2026-08-06

### Added

- **Completar las marcas 👍/👎 de pares que ya votaste.** El 👍/👎 por look llegó a mitad de una corrida y los primeros pares quedaron sin él, o sea con la mitad del diagnóstico. Ahora el marcador ofrece completarlos: **el voto no se toca** (eso es lo que sella el resultado) y **sigue ciego** — no se revela cuál columna es cuál en cada par, aunque ya se conozca el marcador global.

## [0.2.110.0] - 2026-08-06

### Added

- **👍/👎 por look, además del voto del par.** Un lado con un look excelente y dos flojos se votaba igual que uno con tres decentes, y esa diferencia se perdía entera. Idea de Roberto tras el primer vistazo real. Va como DIAGNÓSTICO, no como voto: los tres looks de un lado salen de UNA sola llamada al motor, así que contarlos como tres observaciones independientes inflaría la significancia. El voto del par sigue siendo la unidad del veredicto — que además es lo que la usuaria ve: el set completo.
- **"¿Por qué elegiste ese?"** ahora es un campo grande con su propio título, no una línea opcional al final. Es el dato más valioso de una corrida: "ganó A" no se convierte en nada, "ganó A porque el otro puso gamuza con lluvia" es una regla. El marcador lo muestra bajo ese título en vez de "notas por par".
- **Retomar un vistazo para generar los pares que faltaron.** Solo vistazos, y la restricción es el punto: un vistazo por diseño no declara ganador, así que ver su marcador antes de terminar no corrompe nada. En un veredicto sigue prohibido — ahí seguir después de ver quién va ganando contaminaría los votos restantes.

### Fixed

- **La pantalla de generación invitaba a cortar la corrida a la mitad.** Decía "6 de 12 lados" (la unidad que se vota son PARES) y ponía el botón de parar abierto justo debajo del de continuar. Roberto cortó su primer vistazo real creyendo que ya había terminado, y tres briefs —frío, calor y lluvia, justo los que más mueven el clóset— nunca se midieron. Ahora la pausa dice cuántos PARES faltan, y parar quedó detrás de un disclosure porque es la excepción, no el siguiente paso.

## [0.2.109.0] - 2026-08-06

### Added

- **"Ver los dos en mi avatar" al votar.** Un botón por par que viste tu avatar con el look de CADA lado, los dos a la vez y con el mismo render. Bajo demanda a propósito: el default sigue siendo la cuadrícula de prendas porque mide la composición (que es lo que el motor decide), y un render pobre puede hundir un look correcto. Pídelo cuando las prendas no te alcancen para decidir. Se cachea por lado: volver a pedirlo no cuesta.

### Changed

- **El try-on se extrajo a `lib/tryon.ts` y ahora lo comparten producción y el comparador.** El prompt, las referencias de identidad de tu avatar y el guard de prendas sin imagen son los de verdad, no una copia — el comparador no tiene filas en `outfits` (no ensucia tu historial) y antes eso obligaba a duplicar todo el pipeline. Misma regla que el motor: un solo archivo, dos caminos.

### Fixed

- **Las prendas con foto propia no acababan de cargar al votar** (se veían cuadros vacíos donde el catálogo sí aparecía). Tus renders son JPGs a tamaño completo y se estaban pintando crudos dentro de cuadros de 56 px, cada uno con URL firmada distinta que el navegador no puede cachear. Ahora pasan por el optimizador y pesan ~3 KB, y se piden de inmediato en vez de al hacer scroll: comparar imágenes ES la tarea de esa pantalla.

## [0.2.108.1] - 2026-08-06

### Added

- **Dos retadores más en el comparador de motores: Gemini 3.5 Flash y Kimi K2.6.** Antes solo se podía retar a producción con Sonnet. Ojo con cómo se leen: son de OTRO proveedor, y el prompt lleva 38 versiones afinadas contra Claude — si pierden, eso condena al combo modelo+prompt, no al modelo. La pantalla lo dice en cada variante para que dentro de tres meses nadie lea de más.
- **Haiku 4.5 NO entra, y eso también es un resultado**: su compilador rechaza el schema del motor porque el enum que impide inventar prendas lleva los ~113 ids de tu clóset ("Schema is too complex"). Correrlo sin ese enum sería medirlo con otro arnés, así que queda fuera en vez de degradado. Lo cazó el smoke antes de quemar una corrida entera.

### Fixed

- **Kimi devolvía JSON con saltos de línea sin escapar y la generación tronaba.** El JSON era correcto salvo por eso; ahora se rescata (el parse estricto sigue primero, así que Claude y Gemini ni se enteran). Tirarlo entero habría castigado a un modelo por un bug de serialización en vez de por su criterio de styling — y habría reventado a media corrida, con el voto ya empezado.

## [0.2.108.0] - 2026-08-05

### Added

- **El comparador de MOTORES** — la segunda mitad de `/admin/comparador`. Dos variantes del motor ({modelo + prompt + reglas encendidas}) arman looks sobre los mismos días y el mismo clóset; se vota a ciegas cuál quedó mejor ("Look A / Look B", orden sorteado por par y resuelto en el servidor), y al final se revela qué era cada una con un veredicto contra una regla escrita ANTES de votar. Dos tamaños con papeles distintos: **vistazo** (6 pares) para cazar defectos y sacar reglas — nunca declara ganador — y **veredicto** (20-40 pares) para decidir, con ~10% de pares espejo (mismos looks, orden volteado, gratis) que miden la consistencia del juez humano. Generación por bloques de 3 pares, abortable con nota, y el costo estimado ANTES del botón (calibrado con recibos reales: ~$0.52/par Opus vs Sonnet). Cada defecto se etiqueta por lado (clima, ocasión, color, proporción…) — la cosecha que se convierte en reglas comprobables del motor.
- **La banca de variantes**: producción (control), Sonnet 5 con el mismo prompt (la única comparación de modelo justa hoy: misma familia, 2.5× más barato), y apagar de a UNA las reglas del motor (marca de estilo, estructura de referencia, rotación, neutros-como-fondo). Un test exige que cada variante cambie una sola cosa — una que cambiara dos no diría cuál causó la diferencia.
- **Un voto no se cambia.** Una vez votado un par, queda; re-votar después de ver el reveal es exactamente lo que el pre-registro existe para impedir, y ahora lo impide la base, no la pantalla. Los lados que fallan por el proveedor (sobrecarga, límite de ritmo) sí se pueden reintentar sin re-pagar lo ya generado.
- Smoke barato del pipeline completo para verificar refactors del motor sin abrir la pantalla: `npx tsx scripts/smoke-motor.ts [variante]` (~$0.25).

### Changed

- **El contexto del motor vive en UN solo lugar** (`lib/engine/contexto.ts`) y el pipeline de generar→juez→piso-de-2 en otro (`lib/engine/pipeline.ts`): `/api/generate`, "Tu look de hoy" y el comparador corren EL MISMO código, no copias. La extracción destapó dos derivas silenciosas que ya existían entre las dos copias — "Tu look de hoy" nunca recibía tu preferencia de corte (recto/holgado), y `/api/generate` no filtraba placeholders del historial — y las dos quedaron unificadas hacia el lado correcto, así que los looks pueden variar ligeramente respecto a antes: es el arreglo, no una regresión.
- **El motor y sus jueces llaman por la puerta común** (`lib/proveedores`): cada generación sale con su recibo de tokens, costo y tiempo, y una respuesta cortada por tope de tokens ahora es un error distinguible en vez de un JSON roto opaco. El modelo resuelto de cada llamada queda congelado en cada resultado del comparador — un cambio de modelos a media corrida ya no puede mezclar dos motores sin dejar rastro.

## [0.2.107.0] - 2026-08-05

### Added

- **Tu clóset ya sabe distinguir un derby de un oxford.** Se releyeron las 953 prendas de la base para llenar el tipo fino que se agregó hace un rato y que hasta ahora venía vacío en todas. 529 quedaron con dato (las demás de verdad no tienen: una playera lisa no es de ningún tipo fino). En tu clóset, 69 de 113. Costó $0.54 — con el modelo anterior habrían sido $19.

### Changed

- **Etiquetar fotos de referencia (clima, paleta, silueta) también pasó a Gemini**, por la misma razón que leer prendas: percibir con las reglas ya escritas nunca fue trabajo para el modelo caro. Sin ahorro hoy —no hay nada pendiente de etiquetar— pero queda decidido en un solo lugar.

### Fixed

- **El tipo fino de las prendas del catálogo no llegaba al motor.** Se guardaba en el arquetipo pero no se resolvía al leer, así que el motor lo veía en 24 de tus 113 prendas en vez de 69. Nada truena cuando pasa eso: sólo empeora en silencio.

## [0.2.106.0] - 2026-08-05

### Changed

- **Leer tus prendas de una foto ahora corre en Gemini 3.1 Flash-Lite, no en Opus 5.** Lo ganó midiendo: cinco fotos reales, once modelos leyendo la misma foto con el mismo prompt, y Roberto calificando a ciegas sin saber qué columna era cuál. Empata con Opus en aciertos, cuesta **27 veces menos** y es **6 veces más rápido** — subir una prenda pasa de ~17 segundos a menos de 3. Y lo que decidió no fue el precio: Opus fue el único que inventó una prenda que no estaba en la foto, que es el error que nadie puede detectar hasta que aparece en un look semanas después. Todo el razonamiento y cómo retarlo cuando salga un modelo nuevo: `docs/decisiones/vision-2026-08-05.md`.

## [0.2.105.1] - 2026-08-05

### Added

- **Un campo de comentarios por modelo al calificar.** Para lo que no cabe en marcar una casilla: "la luz estaba imposible, le doy el beneficio de la duda", "esa prenda es de mi esposa", "dijo chelsea y son chukka". Aparece con el nombre del modelo enfrente en los resultados, y no cuenta como error.

## [0.2.105.0] - 2026-08-05

### Added

- **La app ahora distingue un derby de un oxford, un saco cruzado de uno sencillo, un pantalón con pinzas de uno sin ellas.** Ese detalle ya lo leían los modelos, pero vivía suelto dentro del nombre y de la descripción — y la descripción nunca llegaba al motor. O sea que llevábamos meses armando looks sin poder saber que unos zapatos cafés piden traje y otros van con jeans. Ahora es un dato propio: se guarda, se puede corregir, y el motor lo usa (prompt v38). Las prendas que ya tenías no lo traen; se les puede rellenar después.

## [0.2.104.3] - 2026-08-05

### Fixed

- **Al calificar, la ropa de otra persona ya no cuenta como "faltante".** En una foto donde sale alguien más, listar su reloj no es acertar: es meter una prenda ajena a tu clóset, que es el mismo daño que inventarla. El botón ahora dice "no es mía" y cubre los dos casos.

## [0.2.104.2] - 2026-08-05

### Fixed

- **Al calificar ya se ven todos los datos, no seis.** Faltaban corte, largo y manga —que sí llegan al motor y salen en los consejos de cómo llevar la prenda— y sobre todo la descripción, que es donde vive el detalle fino: zapato Derby contra Oxford, saco cruzado contra sencillo. Sin eso, se estaba calificando menos de lo que la app realmente usa.

## [0.2.104.1] - 2026-08-05

### Fixed

- **Un modelo que responde mal ya no pasa por uno que "no vio nada".** Si la respuesta no traía la lista de prendas, se registraba como "leyó 0 prendas" — y en el comparador eso lo premiaba por no inventar nada. Ahora se registra como el fallo que es.
- **Kimi K2.6 devolvía JSON cortado**, mismo síntoma que los Gemini grandes: los tokens de razonamiento se comían el presupuesto de salida. Se apaga el razonamiento donde el modelo lo permita —igual que en Claude y en Gemini, para que la comparación no mida dos cosas a la vez— y se le da holgura al presupuesto.

## [0.2.104.0] - 2026-08-05

### Added

- **Cuatro modelos más entran al comparador**, vía OpenRouter: Kimi K2.6, Qwen3-VL 32B, Llama 4 Scout y Mistral Small 3.2. El más barato cobra $0.09 por millón de tokens de entrada contra los $5 de Opus 5 — cincuenta y cinco veces menos. Se eligieron verificando contra el catálogo real que cada uno vea imágenes y acepte un formato de salida fijo: de los 340 modelos que ofrece OpenRouter, sólo 91 aceptan imágenes.

### Fixed

- **Los fallos de OpenRouter se leen en español.** Es el único proveedor de prepago del proyecto: sin saldo devuelve un bloque de JSON que hacía parecer que algo estaba roto, cuando sólo faltaba comprar créditos.

## [0.2.103.1] - 2026-08-05

### Fixed

- **Subir una foto al comparador ya no truena.** Salía "error de servidor" sin más pista. Faltaban dos cosas que el import del clóset sí hacía desde hace meses y que no reusé: convertir el HEIC de las fotos de iPhone, y comprimirlas antes de mandarlas. Una foto de celular pesa varios megas y las acciones de servidor cortan a 1 MB, así que la petición ni siquiera llegaba. Ahora se comprimen a 1280px (una de 10 MB queda en 0.5 MB) y se suben de una en una, con el avance a la vista.

## [0.2.103.0] - 2026-08-05

### Added

- **Comparador de modelos, adentro del admin.** Subes fotos —tú vestido, o el clóset sobre la cama—, varios modelos las leen, y tú marcas qué prenda no está, cuál se les fue y qué dato leyeron mal. Las columnas van sin nombre hasta que terminas de calificar, y el orden se sortea por foto: nadie califica igual sabiendo cuál es el modelo barato. Al final se revela quién es quién, con aciertos, costo real y tiempo. Compite Claude (Opus 5, Sonnet 5, Haiku 4.5) contra Gemini (3.6 / 3.5 Flash y Flash-Lite), y Kimi K2 y DeepSeek quedan listos para cuando haya llave de OpenRouter.

- **Cada llamada a un modelo ahora guarda su recibo**: tokens, costo en dólares y cuánto tardó. El proyecto llevaba dos meses sin poder contestar "¿cuánto cuesta leer una prenda contra armar un look?", porque la factura sólo llega por día y por modelo. Primer dato: leer una foto con varias prendas cuesta $0.034 con Opus 5 y $0.0014 con Gemini 3.1 Flash-Lite — 26 veces menos y 4 veces más rápido.

### Changed

- **Los prompts de visión salieron de sus rutas a un archivo compartido.** Leer una prenda y leer varias vivían dentro de sus rutas de API; ahora producción y el comparador llaman exactamente el mismo texto y el mismo schema. Es la única forma de que una comparación signifique algo: si el banco de pruebas tiene su propia copia del prompt, mide una app que no existe.

## [0.2.98.0] - 2026-08-05

### Added

- **Tu look del día se arma sobre un look real que funciona.** Antes la app partía de cero cada vez y salían combinaciones correctas pero sosas. Ahora, para el día a día, toma un look de calle de verdad —de los que tú mismo curaste—, lo descompone en su estructura (qué va con qué, en qué proporción, qué detalle lo hace funcionar) y lo rehace con TU ropa. No copia colores: la estructura dice "algo oscuro arriba sobre base clara" y tu colorimetría decide cuáles tonos. Y si tu clóset no da para esa estructura, no se fuerza nada: se arma como siempre.

## [0.2.97.0] - 2026-08-05

### Fixed

- **La sobrecamisa vuelve a contar como abrigo.** Una prenda llamada "camisa overshirt" se estaba leyendo como camisa de vestir, no como la capa que es. Efecto real: en un día frío la app no la veía como algo con que abrigarte, y podía proponerte salir sin capa teniéndola en el clóset.

## [0.2.96.0] - 2026-08-05

### Fixed

- **Un traje ya trae su pantalón.** El motor podía proponerte un traje azul marino y, encima, un pantalón de vestir distinto — dos piezas de juegos diferentes que se leen como error. Pasaba porque la app entendía el traje solo como "saco", así que creía que te faltaba algo de abajo. Ahora sabe que hay prendas que resuelven dos partes del cuerpo a la vez, y eso vale también para vestidos y jumpsuits: si llevas un vestido, ya no cree que estés a medio vestir. De paso empezó a reconocer 27 prendas más del guardarropa femenino.

## [0.2.95.0] - 2026-08-04

### Changed

- **El motor vuelve a armar sin el recetario en prosa.** La prueba a ciegas (12 pares, Roberto de juez, sin saber qué lado era cuál) dio 5-4-2: indistinguible de una moneda, y la regla escrita antes de correr decía "si no gana, se revierte". Se van las fórmulas de estilo, la paleta de familia y los vetos en prosa. Se quedan las dos piezas que son datos y no prosa: la marca de qué prendas del clóset pertenecen a tu estilo (esa sí ganó su propia prueba) y el aviso honesto cuando tu clóset no da para tu estilo.

## [0.2.94.1] - 2026-08-04

### Fixed

- **La prenda que no tenía foto salía sin foto — y salía mal puesta.** Una prenda del clóset puede sacar su imagen de cuatro lados: tu foto, su arquetipo, su render limpio, o una imagen prestada de una prenda muy parecida. Prestar se volvió estricto hace poco (antes te enseñaba un suéter donde el look decía camisa), y eso dejó a unas pocas prendas sin ninguna de las cuatro: aparecían como "sin foto" en el look. Peor: al verte con el look puesto, el avatar no recibía esa prenda y se quedaba con la playera blanca de base, así que la imagen contradecía al outfit. Ahora esas prendas generan su propio render, y si aun así faltara la imagen, al avatar se le dice qué prenda es y que no la sustituya por su ropa de base.

## [0.2.94.0] - 2026-08-04

### Changed

- **Cuando te gustan varios estilos, la app deja de promediarlos.** Si te gustan tres estilos distintos, la respuesta no es un look que intente ser los tres a la vez —eso no es de ninguno—: son tres looks, uno de cada estilo, y tú eliges cuál te queda hoy. Cada look se arma con su propia foto de referencia, y las referencias se reparten entre tus estilos en vez de salir todas del mismo. En pruebas, los tres looks pasaron de ser tres variaciones del mismo registro a ser tres registros distintos: uno más arreglado, uno intermedio y uno relajado.

## [0.2.93.0] - 2026-08-04

### Fixed

- **Ya no te toca un estilo por tener sus etiquetas más comunes.** Al leer tus swipes, cada etiqueta pesaba igual: la que define un estilo ("preppy", "gorpcore") y la que tiene medio catálogo ("pulido", "clásico"). Por eso a alguien cuyo estilo es minimalista y sobrio le salía "preppy" — la carta preppy comparte dos etiquetas genéricas con casi todo, y con eso le ganaba a la familia que de verdad le correspondía. Ahora cada etiqueta pesa por lo distintiva que es, así que un estilo solo te toca si de verdad se parece a lo que te gustó. A quien sí es preppy le sigue tocando preppy.

## [0.2.92.0] - 2026-08-04

### Added

- **Prueba interna: enseñarle al motor fotos de looks reales antes de armar.** De la biblioteca de 616 fotos de calle ya curadas se eligen tres que caigan en tu estilo, tu clima, tus colores y cómo te gusta que te quede la ropa, y se le muestran al motor mientras arma. La idea es que una foto no se comprime: se ve la proporción, cómo cae la tela y cuántos colores conviven — todo lo que se pierde al describir un estilo con palabras. Está a prueba a ciegas antes de decidir si entra al producto.

## [0.2.91.0] - 2026-08-04

### Fixed

- **Una prenda ya no puede mostrar la foto de otra.** Cuando describes una prenda sin subirle foto, la app le presta la imagen de una parecida del catálogo para que no salga como un cuadro de color. Esa comparación se hacía por palabras del nombre, ignorando una lista de colores… que no incluía "esmeralda". Así que una "camisa de lino esmeralda" acabó mostrando la foto de un suéter esmeralda — y no era solo la foto: el probador virtual te ponía el suéter, y la app creía que tenías una camisa fresca para 30°C cuando en pantalla había lana. Ahora la comparación es por tipo de prenda de verdad: un suéter nunca presta su foto a una camisa, ni un pantalón a un short. Si no hay una del mismo tipo, no se presta nada y se genera la imagen de tu prenda real.

## [0.2.90.0] - 2026-08-04

### Fixed

- **La app ya sabe qué es cada prenda de tu clóset, y dejó de armarte trajes sin pantalón.** Al armar tus looks nunca le llegaba la categoría de tus prendas —si algo es un pantalón, un saco o unos zapatos— así que la adivinaba por el nombre. Con una prenda llamada "Traje marino de lana", que en realidad es solo el saco, entendía que ya venía completo y armaba el look sin nada abajo; en el render aparecía un pantalón inventado. Dos de cada tres prendas de la app estaban así: el dato existía en el catálogo y no llegaba. Aplica a los looks del día y a "tu look de hoy".

## [0.2.89.0] - 2026-08-04

### Changed

- **Cada tarea de IA corre ahora en el modelo que le toca, no todas en el más caro.** Hasta hoy casi todo usaba el modelo grande, y eso no era una decisión: era lo que había quedado. Armarte un outfit, proponerte tu cápsula y leer tus prendas en una foto siguen en el mejor modelo — ahí un error se ve, o peor, se propaga a todos los looks que vengan después. Emparejar prendas contra reglas ya escritas, ponerle nombre a tu estilo o sacar las ciudades de un screenshot de vuelo pasan a modelos más rápidos, porque ahí el resultado lo confirmas tú en la misma pantalla. Un test impide que el nombre de un modelo vuelva a escribirse suelto en un archivo.

## [0.2.88.0] - 2026-08-04

### Changed

- **La app corre en Claude Opus 5.** Estaba en la generación anterior del modelo para armar tus outfits, leer tus prendas en una foto, proponerte tu cápsula y planear tu maleta. El nombre del modelo estaba escrito a mano en catorce archivos distintos, así que ahora vive en un solo lugar: actualizar de generación deja de ser una cacería en la que siempre se queda alguno atrás corriendo en silencio con lo viejo. La velocidad no cambia — se midió y quedó igual que antes.

## [0.2.87.0] - 2026-08-04

### Changed

- **El A/B a ciegas ahora corre sobre un perfil hecho con el onboarding actual.** El deck de swipes se rehizo entero y los pares de corte se añadieron después de que la gente ya estaba dentro, así que medir con un perfil de julio era medir el motor alimentado con datos viejos. Sale un dato de paso: con el deck nuevo, el mismo usuario pasa de leerse como "preppy y sastre" a "casual limpio" — el deck viejo le atribuía un estilo que no era suyo. Y son 12 pares en vez de 8, cargados hacia el día a día: la tanda anterior resultó ser 100% eventos de noche, el caso más difícil y el menos frecuente.

## [0.2.86.0] - 2026-08-04

### Fixed

- **"Rehaz tus gustos" ahora sí te pregunta cómo te gusta que te quede la ropa.** Los pares de fotos de corte —recta u holgada— se añadieron al onboarding cuando ya había gente dentro, y la pantalla de rehacer gustos nunca los mostró: quien ya se había registrado no tenía ninguna forma de contestarlos, así que el motor armaba tus looks sin saber ese dato. Y lo necesita: casi todas las recetas de estilo dicen que entre recto y amplio manda tu preferencia. Si ya estabas usando la app, vuelve a swipear desde tu perfil y al final te salen los pares.

## [0.2.85.0] - 2026-08-04

### Added

- **Pantalla interna de A/B a ciegas** (`/admin/ab`): el mismo día, el mismo clóset y la misma persona, resueltos por dos versiones del motor —con y sin las recetas de estilo destiladas—, lado a lado y sin decir cuál es cuál. El lado se sortea en cada par y la clave vive fuera del código que llega al navegador, para que el juicio sea sobre los looks y no sobre la etiqueta. Sirve para contestar la única pregunta que importaba: la reconstrucción del motor de esta semana, ¿suma o resta? Ningún usuario real la había visto — los 155 outfits con votos son todos de la versión anterior.

## [0.2.84.0] - 2026-08-04

### Added

- **La app ya sabe cuáles de tus prendas son de tu estilo, y te arma el look con ésas.** Antes le pasaba tu clóset entero como una lista suelta —hasta 45 prendas— junto con la descripción de tu estilo en prosa, y tenía que cruzarlas de memoria mientras cuadraba el clima, tus colores y la ocasión. Ahí se caía: probándolo, a alguien que le gusta el preppy le armó camiseta marino con pantalón negro y tenis de skate **teniendo polo, chinos y mocasines en el clóset**. No le faltaban prendas: no las reconocía como suyas. Ahora ese cruce se hace por código antes de pedirle nada, y el director de estilo ve las mismas marcas para no "arreglar" el look quitando justo la prenda que lo hacía tuyo.
- **Y si tu clóset de plano no da para ese estilo, te lo dice.** Con lo que tengas se arma el mejor look posible, pero sin bautizarlo con el nombre de un estilo que no es, y diciéndote qué prenda te abriría esa puerta.
- **Ya no te arma un smoking a medias.** Un smoking es un conjunto con código cerrado —su pantalón, camisa blanca, moño—, no un saco negro elegante. Salía saco de smoking con camisa azul, corbata burdeos y pantalón de vestir gris. Ahora, o se completa con lo que hay, o el smoking se queda fuera y el look formal se arma normal.
- **Ya no te manda a 8°C sin abrigo.** Si hace frío y el look no lleva capa **teniendo tú una en el clóset**, se corrige. Si no tienes ninguna, no se inventa: eso se dice, no se repara.

### Changed

- Los estilos ya no se leen como reglamento. La descripción de tu estilo dice qué **tipo** de prenda es de esa familia, no aprueba una prenda concreta: si la receta veta el calzado voluminoso, la receta manda sobre la marca.

## [0.2.83.0] - 2026-08-04

### Added

- **En la pantalla de barrido ahora se puede dejar veredicto y comentario en cada look.** Botones de "acertó" / "exageró" para calificar a la IA revisora, y un campo libre para escribir qué le ves de malo o de bueno. Guarda solo, sin botón: son cincuenta juicios escritos de corrido y no tiene caso arriesgarlos a que se cierre la pestaña. También se renderizaron los looks que la revisora dejó pasar, no solo los que marcó — para saber si se pasa de estricta hay que poder comparar contra los que aprobó.

## [0.2.82.0] - 2026-08-04

### Added

- **Cada ocasión ahora tiene un piso concreto de qué tan arreglado va el look.** Antes el motor solo leía cosas como "de noche, un punto más arreglado" — más arreglado que qué, nunca se decía. Ahora, para un evento o de noche, el look tiene que traer al menos una pieza que lo eleve (saco, camisa de vestir, punto fino sobre camisa o calzado de piel) y quedan fuera los tenis deportivos, la sudadera, el jogger y la bermuda; para oficina quedan fuera el short y lo deportivo. Y si tu clóset no da para eso, arma con lo más arreglado que tengas y te lo dice, en vez de pedirte ropa que no tienes.
- **Pantalla interna de barrido** (`/admin/barrido`): los looks que genera el motor en pruebas automáticas, con las fotos de cada prenda, para poder juzgar a ojo cuáles fallos son reales y cuáles son el revisor automático siendo demasiado estricto.

## [0.2.81.0] - 2026-08-04

### Changed

- **Cuando dos cosas se contradicen, la app ya sabe cuál manda.** Antes cada regla decía a quién le ganaba ella —tu colorimetría le gana a la paleta del estilo, tus palabras le ganan a tus gustos del swipe— pero nunca estaba escrito el orden completo, así que cuando chocaban dos que no se mencionaban entre sí (el estilo contra la ocasión, por ejemplo) el resultado salía distinto cada vez. Ahora el orden es uno solo y explícito: primero lo que nunca se rompe (tus vetos, tu género, la prenda que fijaste), luego el clima y la ocasión, luego los colores que te favorecen, luego lo que tú escribiste de tu estilo, y de ahí para abajo. Lo usan igual la stylist que arma el look y el director de estilo que lo revisa — antes tenían criterios distintos y el segundo podía deshacer una buena decisión del primero.

## [0.2.80.0] - 2026-08-04

### Added

- **La app ya no te arma looks donde una prenda desaparece encima de otra.** Salió probando: de los primeros cinco looks generados, dos caían en el mismo error —camisa negra abierta sobre camiseta negra (la capa no se ve, parece una sola prenda) y saco marino con pantalón marino sin ser un traje—, más un botín negro con reloj café. Ahora esos tres fallos se comprueban con los colores y materiales reales de tus prendas antes de enseñarte el look, y el director de estilo los repara con lo que hay en tu clóset. La regla no es "nunca repitas color": es que si repites color, cambie el material — por eso una chamarra de piel negra sobre un suéter negro sigue siendo válida, que es justo como se lleva el estilo edgy.

## [0.2.71.1] - 2026-08-01

### Fixed

- **Las prendas con foto propia salían sin imagen al generar outfits.** En las cartas de looks aparecía el nombre de la prenda y un cuadro vacío donde iba la foto. La imagen se leía de un solo lugar, y ese lugar solo lo llenan las prendas del catálogo: una foto tuya guarda su imagen en otro lado. Eran 252 de las 272 fotos propias de toda la base — el 93%, y le pegaba a todas las personas que han subido fotos. No fallaba ni avisaba: simplemente dejaba el hueco.

## [0.2.78.0] - 2026-08-03

### Added

- **Ahora la app sabe cómo te gusta que te quede la ropa, y no te lo pregunta con palabras.** Al terminar los swipes salen dos pares de fotos: la misma persona, la misma pared, la misma luz, la misma ropa del mismo color — lo único que cambia es el corte. Eliges una de cada par y listo, son unos diez segundos. Existía un hueco silencioso: ocho de las diez recetas destiladas dicen "manda la preferencia de la persona" entre recto y holgado, y esa preferencia no se guardaba en ningún lado, así que el motor elegía al azar entre el pantalón recto y el amplio del mismo clóset. Preguntarlo con palabras no servía —"¿corte standard o relajado?" da por hecho un vocabulario que justo no tiene quien no sabe vestirse—, pero ver dos fotos y señalar lo hace cualquiera. Si eliges distinto en cada par no pasa nada malo: significa que no tienes una preferencia fuerte, se guarda así, y el motor deja que mande la silueta del estilo en vez de inventarte una.

## [0.2.77.0] - 2026-08-03

### Changed

- **El deck de estilos de hombre, rehecho (25 cartas).** El de mujer se rehizo hace un mes y el de hombre se quedó atrás: las 25 cartas estaban contra la misma pared gris, con la misma pose, y sus outfits se escribieron antes de que existiera la destilación. Ahora cada carta tiene su locación —muelle con veleros para náutico, campus con hiedra para preppy, calle mojada con neón para glam de noche, tianguis de ropa para vintage— y su ejecución la manda la receta destilada de su familia. Ocho cartas además estrenan outfit porque el que tenían no leía el estilo: glam de noche parecía uniforme de mesero, Y2K no tenía nada de los 2000 y era gemela de streetwear, hipster leía a papá, y athleisure traía mallas bajo el short. Los outfits nuevos salen de fotos de calle —primero de las 616 ya curadas, y solo lo que ahí no existía se buscó aparte—; a la carta llega la ropa, nunca la foto. Los cuatro modelos quedaron repartidos con registros mezclados a propósito: si uno cargara los estilos arreglados y otro los de calle, el swipe mediría con quién te identificas en vez de qué ropa te gusta, y ese dato es el que alimenta al motor.

## [0.2.76.0] - 2026-08-03

### Changed

- **El motor de outfits ahora usa las 10 recetas destiladas, con clima (prompt v29).** Antes tenía 3 recetas de la taxonomía vieja —dos de esos estilos ya ni existen— y ninguna sabía de clima: la receta empujaba el mismo cuello de tortuga a 8 que a 28 grados. Ahora cada ❤️ del swipe apunta a una de las 10 familias (streetwear y Y2K → street urbano; hipster y vintage → thrift, etc.), el prompt recibe solo las fórmulas de la banda de temperatura del día, en frío añade cómo abriga ese estilo sin dejar de serlo, y lleva la paleta de la familia con la colorimetría personal por encima. Un test de guardia amarra el mapa cartas→familias contra el de los scripts: si divergen truena el CI, no el motor en silencio.

## [0.2.75.3] - 2026-08-03

### Fixed

- **Las cápsulas de las recetas nombraban prendas que no existen.** Renglones como "Suéter de ochos azul marino y crema" querían decir "hay dos suéteres, uno de cada color", pero se leen igual de bien como un suéter bicolor — y así salió en la reconstrucción de preppy en frío: medio marino, medio beige. La cápsula es lo que el motor le va a decir a la IA que busque en tu clóset, así que la misma frase podía hacerle pedir una prenda imposible en vez de aceptar la que sí tienes colgada. 17 renglones corregidos en 6 familias: los colores alternativos ahora van con "o", y las prendas distintas en renglones separados.

## [0.2.75.2] - 2026-08-03

### Fixed

- **La pantalla de recetas tardaba muchísimo en abrir.** Servía 30 imágenes de tamaño completo (19 MB en total) y las cargaba todas de golpe, aunque solo se ven tres a la vez. Ahora pesan 2 MB entre todas y bajan conforme se hace scroll; además el hueco de cada foto se reserva antes, para que la página no salte mientras se lee.

## [0.2.75.1] - 2026-08-03

### Fixed

- **La pantalla de recetas reventaba en producción.** Cargaba los JSON con un import dinámico armado desde un arreglo de nombres: en desarrollo funciona, pero el bundler de producción no puede resolver una ruta que solo existe en tiempo de ejecución. Ahora son imports estáticos, uno por familia.

## [0.2.75.0] - 2026-08-03

### Added

- **Las 10 recetas destiladas y su prueba de reconstrucción, en el admin** (`/admin/recetas`). Cada familia se destiló mirando sus fotos aprobadas —616 en total— y de ahí salieron sus fórmulas (etiquetadas por clima), su paleta, su silueta, cómo abriga y qué la arruina. Los tres looks de cada familia se generaron usando ÚNICAMENTE el texto de la receta, sin que el generador viera ninguna foto de referencia: si el look se ve como el estilo, la destilación capturó el estilo. La receta va junto a sus imágenes porque juzgar "¿esto es sastre?" sin ver qué dice la receta obliga a adivinar de dónde viene el error.

## [0.2.74.6] - 2026-08-03

### Fixed

- **El conteo del panel ahora lo hace la base, no la pantalla.** El primer intento de arreglo (pedir hasta 50,000 filas) no sirvió: el corte de 1,000 es un límite del servidor de Supabase que un range explícito tampoco pasa. La vista `referencias_resumen` devuelve una fila por familia y el volumen deja de importar.

## [0.2.74.5] - 2026-08-03

### Fixed

- **Dos familias desaparecieron del panel del destilador al pasar la tabla de mil filas.** Supabase corta en 1,000 filas sin avisar, y el panel trae todas las filas para contarlas: thrift-vintage se esfumó con 20 fotos pendientes y utilitario completo, mientras el panel decía "no queda nada por curar". Con 1,070 filas de hombre, las familias cuyas filas caían después del corte simplemente no existían para la pantalla.

## [0.2.74.4] - 2026-08-03

### Added

- **Botón "ya vi este outfit" en el destilador** (tecla ↓). Una sesión de fotos produce varias tomas del mismo look y el dedup por píxeles no las caza: basta con que el modelo gire para que el hash cambie. Un look repetido cuenta como patrón repetido, así que la receta acabaría describiendo la sesión de fotos de alguien en vez del estilo. Va aparte de "no va" porque la foto puede ser un ejemplo perfecto del estilo — solo que ya lo contamos.

### Removed

- El dedup por visión que comparaba pares de fotos. Era sobre-ingeniería: quien cura ya está mirando las fotos una por una y reconocer un outfit repetido le toma medio segundo, contra doce minutos de máquina y una llamada de IA por par.

## [0.2.74.3] - 2026-08-03

### Fixed

- **La estrella del destilador no hacía nada al tocarla.** El contenedor de la carta llama a setPointerCapture para poder seguir el arrastre, y un puntero capturado por el padre nunca completa el click en el botón de adentro — así que "así me vestiría yo" era inalcanzable salvo con el teclado. También se hizo más grande: era un blanco chico para el pulgar.
- **Al agrandar la foto a 82vh, el nombre de la familia se salía de la pantalla** y había que subir a ver cuál se estaba juzgando. Ahora va sobre la foto, abajo a la izquierda: la pregunta es "¿es buen ejemplo de esta familia?" y no se puede contestar sin ver de cuál se habla.

## [0.2.74.2] - 2026-08-03

### Added

- **Tercera dimensión de las referencias: la silueta** (ceñida / recta / holgada), etiquetada por visión en las 675 fotos. El fit era el hueco más grande del perfil — no había ninguna pregunta ni columna sobre cómo le gusta a alguien que le quede la ropa; lo que existía (body_type, body_build) describe el cuerpo, que es otra cosa. El motor llevaba meses aplicando una regla universal ("evita todo holgado o todo pegado") igual para todas las personas. El desglose por familia separa dos grupos: las que tienen silueta propia (street urbano es holgado en 69 de 77) y las que admiten las tres (clásico arreglado: 77/82/65, sastre: 8/7/8) — en esas el fit es preferencia personal y la receta no debe imponerlo.

## [0.2.74.1] - 2026-08-03

### Added

- **Flechas del teclado en el destilador y foto más grande en escritorio.** La curaduría se diseñó para el celular con una mano, pero las tandas grandes (300+ fotos) se hacen sentado, y ahí arrastrar con el mouse es más lento y más cansado que una flecha: ← no va, → sirve, ↑ marca tu gusto. Y como en escritorio se decide con el teclado y no con los botones, la foto pasa de 68vh a 82vh — lo que se juzga es el corte de la prenda, y para eso hay que verla.

## [0.2.74.0] - 2026-08-03

### Changed

- **Taxonomía v2 de referencias: 10 familias generables + el color como dimensión.** La lista v1 mezclaba familias reales (sastre), paletas (tonos tierra) y cualidades (casual effortless) como si fueran alternativas — medido: de 362 fotos de invierno, tonos-tierra se llevó 52 y sastre 1, porque el color le ganaba la casilla a la construcción. Y peor: el conjunto salía de lo que se cosechó primero, no del espacio real de estilos — 15 de las 25 cartas del deck (streetwear, gorpcore, utility, hipster...) no tenían ni una referencia. Las familias v2 se derivan del deck agrupando por vocabulario de prendas: sastre, clásico arreglado (fusión de clásico elegante + smart casual, indistinguibles en los datos), casual limpio (minimalista + effortless, ídem), preppy, edgy, y cinco nuevas — street urbano, deportivo, utilitario, thrift/vintage y resort/boho. La paleta (tierra/neutra/oscura/color) ahora es columna, como el clima, y conecta con la colorimetría.
- Al re-clasificar contra el catálogo completo, 126 de 206 fotos huérfanas encontraron familia — 48 en street urbano, el registro que el catálogo viejo ni siquiera podía nombrar.

## [0.2.73.2] - 2026-08-03

### Fixed

- **La segunda vuelta del destilador pedía revisar descartes que hizo un script, no una persona.** Después de barrer las imágenes generadas por IA, las 4 fotos en cola de revisión eran justo esas 4 —una con la marca de agua de KlingAI a la vista— presentadas como "esta sí es del estilo, la rechazaste, ¿por qué?". Revisarlas las habría devuelto a la destilación. La cola ahora solo trae rechazos humanos: preguntarle a alguien por qué descartó algo que no descartó no tiene respuesta posible.

## [0.2.73.1] - 2026-08-03

### Fixed

- **En la segunda vuelta del destilador no se podía decir "me equivoqué".** Las tres salidas asumían que el descarte había sido correcto en algún sentido; la más cercana —"es del estilo, pero no es lo mío"— rescata la foto pero de paso registra que no gusta. Quien descartó una foto por error del dedo tenía que declarar un "no me gusta" falso para poder recuperarla, justo en el campo que separa el estilo del guardarropa de quien cura. Ahora hay una cuarta salida que rescata sin mentir sobre el gusto.

## [0.2.73.0] - 2026-08-03

### Added

- **El destilador ya sabe de clima.** Cada referencia se etiqueta como calor, templado o frío mirando la ropa que trae puesta — no la palabra de la búsqueda. El primer intento fue cosechar con "winter" en el término de Pinterest y falló medible: de 22 fotos "de invierno", solo 7 eran de frío. La ropa visible no miente; la etiqueta de la búsqueda sí.
- **Reparto automático de estilo** (`scripts/clasificar-estilo.mjs`). La cosecha de clima se busca genérica —por técnica ("layering", "cold weather street style") y con una canasta ancha de prendas de abrigo— y es un pase de visión el que decide a qué estilo pertenece cada foto. Así la búsqueda deja de decidir con qué prenda abriga cada estilo, que era el mismo sesgo de "old money" en otra dimensión.

### Changed

- **El filtro de cosecha ahora juzga cómo está puesto el look, no solo si es una foto de outfit.** Antes pasaba cualquier cosa que técnicamente fuera una foto de una persona vestida, incluidos looks amateur y de disfraz — Pinterest rankea por engagement, no por calidad. Ahora califica ejecución de 0 a 10 y descarta de 4 para abajo, y tira lo que es de otro registro (gala, pasarela, cosplay). Calibrado contra los juicios humanos ya existentes: mata el esmoquin y no se lleva ninguna foto buena.

### Fixed

- **23 imágenes generadas por IA estaban coladas entre las referencias aprobadas** (~9% del total, una con marca de agua de KlingAI). Destilar de ahí es aprender moda de una copia de copia, con fits idealizados que no existen — y con más razón cuando el producto mismo genera imágenes. Se marcan con motivo `render-ia` y quedan fuera de la destilación, recuperables si alguna resulta ser foto real.

## [0.2.72.3] - 2026-08-02

### Fixed

- En el destilador no se veía en qué estilo estabas parado: el panel decía cuántas faltan en cada uno y el contador de abajo decía "1 de 34" sin decir de qué. Ahora la fila activa se resalta y el contador lleva el nombre del estilo.

## [0.2.72.2] - 2026-08-02

### Changed

- **Las referencias se re-cosecharon con búsquedas genéricas.** Las búsquedas eran demasiado específicas ("smart casual men outfit **wide trousers**", "**old money** men outfit") y eso no busca el estilo: busca las prendas que ya se habían decidido que son el estilo, así que las fotos no pueden contradecir la hipótesis. Medido: de lo que devuelve una búsqueda genérica, solo coincidía el 10% en smart casual y el ~26% en los otros dos. El hueco es real y concreto — el recetario de clásico elegante llegó a declarar que "el negro no pertenece al estilo", y las búsquedas genéricas lo traen repetido.
- Se retira el sello de "aprobado" de clásico elegante y minimalista. Sí pasaron la prueba visual, pero contra las mismas fotos sesgadas de las que salieron: el test medía fidelidad al material, no cobertura del estilo, y por construcción no podía detectar lo que faltaba.

## [0.2.72.1] - 2026-08-02

### Fixed

- Las fotos del destilador se recortaban para llenar la carta, y lo primero que se perdía eran los zapatos y el largo del pantalón — justo lo que hay que ver para decidir si un outfit sirve. Ahora se muestran completas, aunque queden bandas a los lados.

## [0.2.72.0] - 2026-08-02

### Fixed

- **El destilador no terminaba nunca.** La lista traía TODAS las fotos con las pendientes al principio, así que al acabar lo pendiente seguía mostrando lo ya juzgado sin nada que lo indicara: se sentía como si el trabajo no se guardara. Ahora solo trae pendientes y avisa cuando el estilo está completo.
- **No había forma de saber en qué punto va cada estilo** sin acordarse. Se agregó un panel de estado que dice, por estilo, cuántas faltan y cuáles ya pasaron la validación visual del recetario. Los chips de navegación se quitaron: duplicaban el panel y tener dos formas de llegar a lo mismo era parte de la confusión.

### Changed

- **Recetario afinado contra la prueba visual.** Se generaron outfits usando solo el texto destilado, sin pasarle ninguna foto al generador, y se compararon contra las referencias de origen. Salieron tres fallas que ninguna prueba automática caza: (a) faltaba la regla de que la pieza abierta de encima nunca va del mismo tono que el pantalón — se confirmó contra las 12 referencias antes de escribirla; (b) una fórmula pedía justo lo que la regla prohíbe, y **una fórmula que viola una regla la deja muerta** porque el generador obedece lo concreto; (c) un detalle redactado como estadística ("la camisa abierta es la tercera pieza más repetida") se leía como orden y metía camisas donde la fórmula no las pedía. Clásico elegante y minimalista quedaron aprobados.
- Smart casual pasa de 12 a 67 fotos de referencia. Con 12, una foto suelta pesaba como patrón — de ahí salía una fórmula que no representaba al estilo.

## [0.2.71.0] - 2026-08-01

### Added

- **Segunda vuelta del destilador.** La primera curaduría pedía dos juicios distintos con un solo botón: si la foto es del estilo (taxonomía) y si se ve bien (ojo). Son preguntas distintas, y quien cura contesta la que puede contestar — si se lo pondría. Medido contra un juez que solo sabe taxonomía: 35% de acuerdo en smart casual, con 17 de 26 fotos rechazadas que sí eran del estilo, y ese estilo quedó con 3 aprobadas de 26. Ahora las 31 discrepancias se revisan con la pregunta separada: "es del estilo pero no es lo mío" (vuelve a destilar), "está mal puesto" o "de verdad no es de ese estilo". Con el sesgo metido en la taxonomía, el recetario deja de describir el estilo y describe el guardarropa de una persona.
- **Juez de estilo independiente** (`scripts/juez-estilo.mjs`): clasifica cada referencia por taxonomía sin ver el veredicto humano, y marca dónde discrepan.

### Fixed

- `referencias_juez` se había creado desde un script y quedó en producción con RLS activo y **cero políticas** — ilegible desde la app y sin versionar en migraciones. Ahora está en `0096` con su política de admin.

## [0.2.70.0] - 2026-07-31

### Added

- **Destilador (herramienta interna, solo admin).** Una pantalla para curar, foto por foto, las referencias con las que se le enseña al motor cómo se lleva cada estilo. Funciona por swipe desde el celular, porque la curaduría son ~90 fotos por tanda y se hace en ratos muertos, no sentado frente a la computadora. Dos señales separadas a propósito: "sirve" define el estilo y el ★ ("así me vestiría yo") guarda el gusto personal aparte — si se mezclaran, el motor acabaría copiando el clóset de una persona en vez del estilo.
- **Filtro de visión sobre las referencias cosechadas.** De 178 fotos traídas de Pinterest, 85 no servían: portadas de blog con el título encima, collages, anuncios de tienda con precios, flat-lays sin persona y looks de mujer colados en una búsqueda de hombre. Antes eso se lo iba a comer el humano a mano; ahora lo tira un pase de visión y las descartadas se guardan aparte por si se equivoca.
- **Recetario de estilos, todavía DESCONECTADO del motor.** El motor recibía los gustos como tres palabras sueltas ("pulido, clasico, elegante") y ninguna de sus 432 líneas de prompt decía qué significan, así que improvisaba. El recetario las cambia por fórmulas concretas a nivel prenda. Está escrito y probado pero sin conectar: la primera destilación salió de las fotos SIN curar, y no se le cambian los outfits a gente real con material que sabemos malo. Se conecta cuando la curaduría termine y gane un A/B contra el motor actual.

### Fixed

- La barra del admin ya no se parte en dos filas en el celular; ahora hace scroll horizontal. En el destilador, esa segunda fila empujaba los botones de decisión abajo del fold.

## [0.2.69.0] - 2026-07-31

### Changed

- **Las cartas del swipe de estilos, rehechas de cero (mujer).** Tatiana lo dijo revisando la app: "muchos de los outfits no están tan padres" y "se ven muy señoriales". Tenía razón, y al revisarlas de cerca el problema no era uno solo. Las 27 cartas se rehicieron con fotos reales de referencia que ella y Roberto curaron, en vez de describirle la ropa a la IA con palabras — que era lo que hacía que saliera lo más promedio posible. Ahora cada estilo tiene su propia calle, su propia pose y su propio peinado, en vez de las 25 contra la misma pared gris.
- **Las cartas ya no dicen cómo se llama el estilo.** Un rótulo como "Minimalista" o "Coreano" hace que contestes con tu autoimagen —"¿yo soy minimalista?"— en vez de con tu gusto —"¿me quiero poner esto?"—. Y si no conoces el término, quedas descalificado de opinar sobre una foto que sí entiendes. Ahora solo ves el look.

### Added

- **Una carta nueva: "de salir".** De los 26 estilos, ninguno mostraba ropa que marcara la silueta — todo era holgado y cubierto. A quien le gusta lo ceñido no le aparecía ninguna carta suya, así que nunca nos enterábamos de ese gusto. Es el hueco que detectó Tatiana.

## [0.2.68.1] - 2026-07-30

### Changed

- Interno: el detalle de look del Historial pasa a llamarse `HistorialLookDetail`. Había dos componentes llamados `LookDetail` —el único nombre repetido del repo— y al arreglar el corazón se editó uno y se probó el otro. No lo ves en la app.

## [0.2.68.0] - 2026-07-30

### Fixed

- **Guardar un look ahora te dice dónde quedó.** Le dabas al corazón, el corazón se llenaba y ahí terminaba todo: nada te decía que el look se había guardado en algún lado ni cómo volver a él. El sitio siempre existió —el filtro "favoritos" del Historial, también en el menú "más"—, pero si nada te lo dice, guardar se siente como que no pasó nada. Ahora el corazón confirma y te ofrece ir.

## [0.2.67.0] - 2026-07-30

### Changed

- **"Tu cápsula" ahora se llama "tus esenciales".** "Cápsula" es jerga de moda: viene del oficio, no del idioma de nadie. La voz del producto prohíbe la jerga técnica de moda desde el día uno, y ésta se nos había colado en la navegación, en la franja del clóset, en el cuestionario, en el correo semanal y en la landing. "Esenciales" ya era la palabra que la app usaba sola cuando tenía que explicarse ("te faltan 3 esenciales").

### Added

- **La primera vez que entras a tus esenciales, te explico la idea.** Una lista de 20 prendas que no compraste se lee como una lista de compras que la app se sacó de la manga. Ahora antes de la lista va la lógica, en una imagen: 3 prendas de arriba × 3 de abajo = 9 looks. Y de dónde viene — los estilistas llevan desde los setenta armando los clósets así. Se muestra una vez; "volver a ver los tips" en tu Perfil la trae de vuelta.

### Fixed

- **Las corridas de pruebas ya no cuentan código de otra rama.** Las tareas en segundo plano crean copias del proyecto dentro de la carpeta, y el corredor de pruebas las estaba incluyendo: el conteo se inflaba (264 reales se reportaban como 541) y una rama ajena podía pintar de rojo un árbol sano. Interno, no lo ves en la app.

## [0.2.66.0] - 2026-07-30

Los primeros arreglos del feedback de Alberto, el segundo tester real.

### Fixed

- **La pantalla ya no se queda negra y sin salida.** Si un tip te iba a señalar un botón que estaba más abajo de lo que se veía, se pintaba el velo oscuro con el foco y el texto fuera de la pantalla — y con el scroll bloqueado. Quedaba todo negro, y recargar no lo arreglaba. Ahora el tip primero trae el botón a la vista, y si aun así no cabe, se salta y le cede el turno al siguiente. La nota nunca puede quedar fuera de la pantalla.
- **"¿Me va este color?" ya lee la prenda y no el fondo de la foto.** En una foto de producto de tienda, el fondo blanco del estudio ocupa más espacio que la prenda: el veredicto salía sobre un blanco que nadie iba a comprar. Ahora lo lee la misma IA que ya usa tu wishlist. En la foto de prueba, antes leía un gris `#e0e0e0` (el fondo) y ahora lee `#26314d` (el azul marino real). Además te dice qué prenda vio, no solo un código de color.
- **Terminar un paso del "qué sigue" ya no te deja tirado.** Al crear tu avatar desde la lista de Home acababas en tu Perfil, sin rastro de los otros pasos que ibas siguiendo. Ahora vuelves a Home, con el paso tachado y el siguiente esperándote. Igual para "afina tu estilo" y "cuéntame de tu cuerpo".

### Changed

- **Tu cápsula ya no se ve como una pared de recuadros grises.** Las imágenes de las prendas sugeridas se generaban solo cuando las tocabas, así que la primera vez que veías tu cápsula estaba casi toda vacía. Ahora las de arriba se van generando solas de fondo y aparecen mientras la ves.
- **Te avisamos antes de que se rompa.** Crear tu avatar o armar tu cápsula tarda cerca de un minuto, y si te sales de la app el navegador corta el proceso a media. Ahora se avisa desde el principio en el avatar, y en las demás esperas el aviso aparece solo si se está tardando.
- **"Chequea un color" ahora se llama "¿me va este color?"** — el título nombraba el mecanismo en vez de la pregunta que traes en la cabeza cuando estás parada en la tienda. Alberto entró al módulo y salió sin saber para qué servía.

## [0.2.65.0] - 2026-07-30

### Changed

- **"Decide si te sirve" ahora es un duelo parejo.** La prenda sugerida salía 55% más ancha que la tuya: el diseño ya había votado antes de que tú compararas. Ahora las dos columnas miden exactamente igual, con la foto completa (no recortada) y sin nada preseleccionado. Cuando picas una, aparece un solo botón de ancho completo que dice qué estás eligiendo — "elegir la sugerida" o "elegir la tuya" — en vez de dos botones al 50% que se leían como el pie de la columna de al lado.
- **Cada card resuelve una sola cosa.** El card mezclaba elegir prenda, calificarla, mandarla a wishlist y descartarla. Ahora eliges primero, y las salidas aparecen después, cuando ya hay algo sobre qué opinar.
- **Al decidir, el card se convierte en la misma tarjeta de sugerencia del resto de la app** — con su foto, su razón en la voz del coach y "cambiar" para deshacer. Antes, quedarte con tu prenda te dejaba una palomita y una línea de texto; ahora ves cuál prenda te quedaste.
- **"Ninguna de las dos me va" ahora te pregunta por qué.** Antes cambiaba la sugerencia a ciegas: la IA proponía otra sin saber qué había fallado. Ahora abre la misma hoja de motivo que ya usa "no me va", y con el motivo en mano decides si quieres un reemplazo o quitarla — y ese motivo es justo lo que el motor necesita para no repetir el error.
- **El rótulo del card nombra el hueco, no la prenda.** El nombre salía dos veces (de título y otra vez bajo su foto). Ahora arriba dice de qué hueco se trata ("te falta · pantalón no denim") y la prenda se nombra una sola vez, en su columna. Las cápsulas nuevas traen ese nombre; las de antes muestran solo "te falta".

### Fixed

- **Las prendas sugeridas ya no salen recortadas.** Se mostraban con recorte de relleno, y a las camisas les comía el cuello y a los zapatos la punta. Ahora se ven completas sobre su fondo.

## [0.2.64.0] - 2026-07-30

### Changed

- **Las tres cosas que puedes hacer con una prenda guardada están juntas, abajo.** Ver cómo te queda · ya la compré · quitar. Antes "quitar" vivía arriba, separada de las otras dos, y no había razón: las tres son decisiones sobre esa misma prenda.

## [0.2.63.0] - 2026-07-30

### Changed

- **Las prendas de tu wishlist ahora se ven como las sugerencias de tu cápsula.** Estaban en una reja de dos columnas, con tarjetas tan angostas que las acciones se apilaban una encima de otra en botones diminutos. Ahora cada prenda ocupa el ancho: su foto a la izquierda, el nombre y el veredicto de color a la derecha, y las acciones abajo, a lo ancho. Es la misma tarjeta que ya usan la cápsula y el viaje — una prenda guardada es lo mismo que una sugerida: algo que estás considerando, con su veredicto y sus salidas.

## [0.2.62.0] - 2026-07-30

### Added

- **"Ya la compré": la prenda de tu wishlist pasa a tu clóset de un toque.** Antes, comprar algo que habías guardado te obligaba a volver a fotografiarlo y volver a esperar el análisis. Ahora se muda con su foto y todo lo que ya sabíamos de ella, y el motor puede armarte looks con ella de inmediato.
- **Las prendas que ya te probaste se distinguen.** El botón deja de decir "pruébatela" y dice **"así te queda"**: ya está generado, así que verlo otra vez es instantáneo — y de un vistazo sabes cuáles ya viste puestas y cuáles no.

### Fixed

- **La nota del probador ya se lee.** "Así te verías con esta prenda" era texto blanco flotando sobre la foto, y sobre una prenda clara desaparecía. Ahora se apoya en un degradado —el mismo recurso que usa el probador de Hoy— y la advertencia de que es una aproximación se lee de verdad.

## [0.2.61.0] - 2026-07-30

### Changed

- **Al agregar una prenda a la wishlist, tu foto entra al instante.** El análisis se tarda unos segundos, y hasta ahora eso era un botón congelado que decía "agregando…" sin más. Ahora tu prenda aparece en la reja de inmediato —la foto ya la tienes— y adentro te va contando qué está pasando: leyendo la prenda, sacando su color real, viendo si va con tu paleta. La tarjeta se queda del mismo tamaño, así que nada salta cuando termina.

## [0.2.60.0] - 2026-07-30

### Fixed

- **El veredicto de color de la wishlist ya juzga la prenda, no el fondo de la foto.** Un pantalón de lino oliva de Zara se guardó como `#f2f2f2` —el blanco del estudio— y con eso te dijo "va contigo": una respuesta sobre el fondo, no sobre el pantalón. El cálculo que hacía el navegador ignoraba lo "casi blanco" a partir de 244, y el fondo de esas fotos es 242; y aunque el umbral fuera otro, en una foto de producto hay más píxeles de fondo que de tela. Ahora el color lo lee el mismo analizador que usa tu clóset, que sí distingue la tela de la luz.
- **Y la prenda que subes por foto ya tiene nombre.** La app siempre lo supo, pero la tarjeta nunca lo mostraba: veías una imagen, un color y nada más. Ahora dice qué es — "Playera blanca oversize", "Chinos azul marino".

## [0.2.59.0] - 2026-07-30

### Fixed

- **"Armar maleta" ya no te manda a un asistente en blanco teniendo viajes guardados.** El atajo solo te llevaba a tu maleta si el viaje salía en los próximos 7 días; con uno guardado más lejos te abría el asistente de cero, como si no existiera. Ahora, si no hay viaje inminente, entras a tu lista de viajes — donde está el tuyo y también el botón para armar otro.

### Changed

- **Los atajos de "más" ya no repiten viaje dos veces.** Había "armar maleta" y "viajes", y la lista de viajes ya abre con "armar una maleta nueva" como acción principal: uno contenía al otro. Quedó un solo atajo, **viajes**, y en su lugar entró **tu cápsula**, que estaba a dos toques y no tenía atajo en ningún lado.
- **Los atajos de "más" ahora funcionan también en una pestaña que estaba en segundo plano.** Navegaban dentro del reloj de animación del navegador, que se congela cuando la pestaña no está al frente.

## [0.2.58.0] - 2026-07-29

### Fixed

- **"Cambiar" vuelve a significar lo que siempre significó: deshacer tu decisión.** En el card nuevo de ayer lo usé también como "búscame otra sugerencia", revolviendo dos cosas distintas (lo cachó Roberto). "Cambiar" solo aparece cuando ya elegiste entre tu prenda y la sugerida, y te deja volver a elegir. Punto.
- **Pedir un reemplazo ahora vive dentro de "no me va" — con el motivo por delante.** Tocas "no me va", dices por qué, y con eso en mano decides: "búscame un reemplazo" (el motor usa tu motivo para no repetir el error) o "solo quítala". Antes el reemplazo salía sin motivo, así que el motor buscaba a ciegas. Si ya agotaste los reemplazos de ese hueco, el motivo va directo al retiro sin preguntarte de más.

## [0.2.57.0] - 2026-07-29

### Changed

- **El card de prenda sugerida, rehecho — y ahora es el mismo en cápsula y en viaje.** Arrancaba con meta-texto ("preferiste la sugerida — sigue en lo que falta") partido en dos renglones, y el nombre de la prenda, que es el tema, entraba en tercer lugar. Ahora abre con el nombre, la razón va en la serif itálica del coach (la misma voz del detalle del look), y la foto se ve completa: caja 4:5 sin recortar, porque recortar una prenda ya recortada la decapita.
- **De cuatro acciones a tres, y sin dos que signifiquen lo mismo.** "cambiar" y "esta no me convence — cámbiala" eran la misma cosa dicha dos veces. El pie tiene ahora las tres respuestas posibles a una sugerencia —**ya la tengo · wishlist · no me va**— y "cambiar" vive arriba, con la categoría: no es un veredicto sobre la prenda, es "enséñame la otra opción".
- **En viaje, "buscar en mi clóset" pasó a ese mismo lugar de arriba** (como "en mi clóset"): es la misma idea de "enséñame otra cosa", no un veredicto.

### Added

- **"No me va" ahora pregunta por qué, y sí lo guarda.** Antes el motivo era opcional y se perdía. Ahora la hoja es obligatoria con seis motivos —no es mi estilo · muy formal · muy casual · no me gusta el color · ya tengo algo así · fuera de presupuesto— y el card se queda en su acuse: "vale — ya tengo algo así. no te la vuelvo a sugerir." Los dos motivos nuevos también le dicen al motor qué buscar distinto la próxima vez.

## [0.2.56.0] - 2026-07-29

### Changed

- **"Así funciona" ya cuenta las tres cosas que faltaban.** La pantalla que explica la carga en bulto decía "una foto con tu outfit" — el singular, justo lo contrario del argumento de la función. Ahora dice **varias fotos de una vez (hasta 12)**, que **puedes recortar cada una** (útil si sales acompañada en la foto) y, la más importante, que **nada entra a tu clóset sin que lo apruebes**: repasas prenda por prenda y lo que no sea tuyo se va. Son cuatro pasos en vez de tres, y cada uno es una pantalla real del flujo — así el explainer es un avance de lo que viene y nada sorprende a medio camino.

## [0.2.55.0] - 2026-07-29

### Changed

- **En el clóset ya solo hay una forma de añadir ropa a la vista, no dos.** Mientras el bloque de las tres opciones esté arriba, el botón "agregar" no se muestra: abría una hoja con exactamente lo que ya estaba desplegado abajo, y siendo el elemento más fuerte de la pantalla dejaba la jerarquía al revés. Cuando subes tu primera foto el bloque se retira y el botón vuelve, ya como la puerta de siempre. Siempre hay uno de los dos — y "más → añadir prendas" sigue estando en los dos estados.

### Added

- **Un aviso cuando los dos cambian de lugar.** Al subir tu primera foto, el bloque que venías usando desaparece y aparece un botón donde antes no había nada. Ahora un tip señala el botón nuevo y explica el relevo: "ya subiste lo tuyo, así que quité el bloque de arriba — desde aquí le sumas más ropa cuando quieras". Sale una sola vez, y pasa antes que cualquier otro tip del clóset porque explica algo que acaba de cambiar en la pantalla.

## [0.2.54.0] - 2026-07-29

### Added

- **Las tres formas de sumar ropa ahora están a la vista en el clóset, no escondidas tras "agregar".** Mientras tu clóset sea puro catálogo, arriba de la reja aparece "este clóset todavía no es tuyo" con las tres salidas desplegadas: subir varias fotos de golpe, marcar prendas de la biblioteca (sin tomar una sola foto) o subir una prenda suelta. Se va solo en cuanto subes tu primera foto. El dolor número uno de estas apps es catalogar el clóset, y las dos salidas que lo esquivan vivían detrás de una palabra —"agregar"— que suena precisamente al trabajo de una prenda a la vez.

### Changed

- **Las tres formas de añadir dicen lo mismo en todas partes.** La hoja de "agregar" y el drawer de "más" tenían dos versiones distintas de los mismos textos, así que mejorar uno dejaba el otro atrás. Ahora hay una sola copia — y la de la biblioteca por fin dice lo único que importa: que llenas tu clóset **sin tomar una sola foto**. También cambia el orden: primero las dos formas rápidas, la foto suelta al final.

### Removed

- **Fuera el tip de "súmale tu ropa real".** Señalaba el botón "agregar" para anunciar las tres formas; ahora esas tres formas están en la pantalla. Un tip que explica lo que ya se ve es una puerta que dice EMPUJE. Quedan 7 tips.

## [0.2.53.0] - 2026-07-29

### Fixed

- **El primer tip de la app ya no promete algo que no hace.** Decía "cada día te espera un look nuevo aquí", pero el look no se genera solo: lo armas cuando se lo pides. La propia pantalla debajo del tip decía "tu look de hoy, aún no". Ahora dice lo que de verdad pasa: dime qué traes hoy y te armo el look, con tu clima y lo que hay en tu clóset.
- **El tip de sumar ropa ya nombra el camino rápido.** Decía "con una foto" y anunciaba el más lento; ahora dice que subas varias de golpe y que yo saco cada prenda, que es lo que de verdad te ahorra la tarde.

### Removed

- **Fuera el tip de "márcale me lo puse".** Vivía en Historial, pero esa acción se mudó a Hoy —la card "¿te lo pusiste?" del día siguiente— así que mandaba a buscar un botón que ya no está ahí. La card pregunta sola, con sí o no de un tap. Quedan 8 tips.

## [0.2.52.0] - 2026-07-28

### Changed

- **Los tips ahora son una tarjeta, no un texto suelto sobre la pantalla apagada.** El texto blanco flotando funcionaba cuando estas pantallas estaban vacías; con el rediseño se llenaron de fotos y prendas, y el tip caía encima de una camiseta blanca y se volvía ilegible. Ahora tiene fondo propio: el contraste ya no depende de qué haya debajo.
- **El tip apunta a lo que te está señalando.** Una punta lo conecta con el elemento iluminado, y la tarjeta va centrada en él — antes se alineaba a un lado y se leía como dos cosas sueltas.
- **Se coloca donde quepa.** Debajo del elemento si hay lugar, arriba si no, midiendo su alto real. Antes caía siempre debajo asumiendo un alto fijo, y por eso aterrizaba encima de la fila de filtros o de la primera prenda.
- **La pantalla se apaga más (de 72% a 84%).** Es el mismo nivel que ya usaban los tips centrados, los únicos que se veían bien.

## [0.2.51.0] - 2026-07-28

### Fixed

- **Revive el tip del try-on, muerto desde hace cuatro días.** El rediseño del detalle del look se llevó por delante la marca que le decía al tip a qué botón apuntar, así que "aquí te lo pruebo puesto en ti" dejó de salir. Y no fallaba solo: como no se dibujaba, tampoco se marcaba como visto, así que se quedaba con el turno en cada visita y **enterraba al tip de viaje** en cualquier día con look ya generado.
- **Un tip que no encuentra a quién señalar ahora cede el turno.** Los tips de una pantalla van en orden de prioridad y se muestra el primero que se pueda dibujar, no el primero a secas.
- **Los tips ya funcionan en pestañas de fondo.** Buscaban su elemento con el reloj de animación del navegador, que en una pestaña oculta se congela por completo (medido: cero avances en tres segundos). Una PWA restaurada o una pestaña abierta y vista después podía quedarse sin tip para siempre. Ahora la búsqueda corre con un temporizador normal y se rinde a los 500 ms.

## [0.2.50.0] - 2026-07-28

### Fixed

- **El "qué sigue" del inicio ya muestra TODOS los pendientes.** Decía "2 pendientes" y enseñaba uno: anunciaba un dato y lo escondía. Ahora se listan todos, con jerarquía en vez de cinco filas iguales — el siguiente en grande y con su gancho, los demás en renglones compactos y tocables (si te late más el tercero, entras directo a ese). El bloque sigue cabiendo arriba del botón de armar tu look.
- **El estilo de una stylist ya no se le ofrece a quien no le sirve.** El guardarropa de Carla es de mujer y le estaba apareciendo a hombres: faldas al bies y mules como propuesta de estilo. Ahora un estilo se ofrece solo si es de tu segmento; a los hombres la sección desaparece hasta que sembremos un guardarropa de hombre.
- **"Afina tu estilo" con su página completa.** Entrando desde el inicio, el renglón de "¿algo más que deba saber?" salía vacío aunque tuvieras texto guardado, y sumar una foto ahí se llevaba por delante las que ya tenías. La página tenía media card; ahora es la misma que en Perfil.

## [0.2.49.0] - 2026-07-28

### Fixed

- **El recorte de tu foto ya no se pierde.** Ajustabas el encuadre, dabas "usar" y volvía tu foto sin recortar, como si nada. La causa: el recuadro se creaba al terminar de cargar la imagen, pero si en ese instante todavía no tenía tamaño en pantalla, no se creaba **nunca** — y sin recuadro el botón salía sin hacer nada. Ahora se crea en cuanto la imagen tiene medidas, y si la pantalla cambia (giras el teléfono, aparece el teclado) el recuadro se re-escala en vez de desencuadrarse.

### Changed

- **En la foto del avatar, el recuadro es el botón.** Se veía tocable pero no hacía nada, y la acción estaba en dos botones debajo. Ahora tocas el recuadro: vacío abre el selector de fotos, con foto abre el recorte. Los dos botones se fueron — iOS ya ofrece "Cámara / Fototeca" en su propia hoja.

## [0.2.48.0] - 2026-07-28

### Changed

- **Vuelve "usa el estilo de una de nuestras stylists", ahora con sus prendas a la vista.** Se había apagado esta mañana porque eran dos nombres y un párrafo: te pedía adoptar un estilo que no podías ver. Ahora la tarjeta abre con cuatro piezas reales del guardarropa de Carla —una falda de satén mostaza, un pantalón ancho de lino, unos jeans de leopardo y unas mules negras— y su estilo se entiende de un vistazo. La regla nueva es que un estilo **solo se ofrece si trae fotos de su guardarropa**: por eso María todavía no aparece, y aparecerá cuando el suyo esté sembrado.

## [0.2.47.0] - 2026-07-28

### Fixed

- **Si eres mujer, el checklist del registro ya te deja marcar ropa formal.** Te ofrecía 33 prendas y solo 9 servían para una ocasión formal: **ni un solo par de tacones**, ningún abrigo formal, y un único pantalón. Terminabas el registro con un clóset que no podía vestir una boda ni una junta — y después la cápsula te reportaba esos huecos como si no tuvieras la ropa, cuando en realidad nunca te la ofrecimos. Ahora se suman 12 básicos que ya existían en la biblioteca: tacón negro y nude, pantalón de vestir, falda lápiz y midi, abrigo de lana, gabardina, blazer negro, camisa oxford, blusa de seda y vestido de trabajo.

## [0.2.46.0] - 2026-07-28

### Changed

- **Que una prenda no sea de calle ahora es un dato suyo, no una corazonada por su nombre.** Antes se deducía del texto ("si se llama traje de baño, no es de calle"), así que renombrar tu bikini bastaba para que el motor volviera a tratarlo como ropa normal. Ahora la biblioteca marca sus prendas de baño, tus fotos nuevas se marcan solas al analizarlas, y el nombre queda solo de respaldo para las prendas viejas.
- **A propósito NO se marcó la ropa deportiva.** En la biblioteca hay 24 prendas que suenan a "no es de calle", pero casi todas son athleisure —leggings, joggers, sudaderas, tenis— y esa ropa hoy se usa en la calle todos los días; se sembraron justo para eso. Marcarlas las sacaría de tus looks normales. Solo se marcó lo inequívoco: las 5 de baño.

## [0.2.45.0] - 2026-07-28

### Fixed

- **Un pantalón largo ya no cuenta como "parecido" a un short.** El motor trataba el largo de pierna como trata la manga —un matiz menor— y no lo es: a la playa no vas en pantalón, ni a una junta en bermudas. Son prendas distintas, no versiones de la misma. Ahora un pantalón nunca cubre un short o una bermuda (ni al revés), y una falda no cubre un pantalón. Cuida la trampa del español: "pantalón corto" ES un short y se clasifica como tal. Tu emparejamiento se recalcula solo en la próxima visita.
- **Las imágenes de prendas del catálogo dejaron de verse recortadas.** Se generaban cuadradas y se muestran en un hueco vertical, así que el navegador las ampliaba un tercio y les cortaba los lados: la prenda salía grande y chaparra. El generador ya crea en la proporción correcta desde hace días, pero **98 de las 102 imágenes existentes** eran anteriores al arreglo. Se corrigieron todas, extendiendo el papel del fondo en vez de regenerarlas — así la prenda queda idéntica, solo deja de recortarse.

## [0.2.44.0] - 2026-07-28

### Changed

- **El checklist de setup en Hoy ahora enseña una sola tarea.** Listaba los cinco pasos con los hechos tachados: ~450 px para contarte algo que ya sabías, y el CTA quedaba empujado hacia abajo. Un paso completado no es información — solo el pendiente lo es. Ahora hay un encabezado que resume ("4 de 5 listos · ver lo hecho") y debajo únicamente lo que falta. Los completados siguen ahí, en un plegable que abres si quieres revisarlos: con check y en gris, sin tachado (el tachado sobre gris no se lee y era lo que ensuciaba la pantalla). Si te faltan dos o más, se muestra solo el primero y el encabezado te dice cuántos quedan.
- **Copy más humano en Hoy.** "sube un look que ames" → "sube un look que te encante". Y la card de prenda pasó de "PRENDA NUEVA · aún no estrenas camiseta vinotinto" a "SIN ESTRENAR · camiseta vinotinto": el eyebrow ya lo dice, repetirlo gastaba dos renglones.

## [0.2.43.0] - 2026-07-28

### Added

- **Ahora te avisamos que cambiar tu estilo deja tu cápsula desactualizada.** Ya pasaba —cambiabas tu referencia o tus palabras y la próxima vez que abrías la cápsula te salía "se quedó atrás de ti"—, pero te enterabas después y sin relacionarlo con lo que acababas de hacer. Ahora el aviso sale ahí mismo, con un enlace directo, y solo si de verdad ya tienes cápsula.
- **Medimos si alguien abre perfil → estilo.** Sus dos campos llevan semanas vacíos y no podíamos distinguir dos cosas muy distintas: que la petición no convenza, o que nadie llegue a esa pantalla. Sin este dato, cualquier rediseño se estrenaría con las mismas cero personas. Se registra una vez por visita y aparece en el admin como cuántas personas entran, de cuántos perfiles.

## [0.2.42.0] - 2026-07-28

### Changed

- **Tus fotos de referencia ahora se SUMAN, ya no se reemplazan.** El botón decía "cambiar", y subir una foto nueva borraba las que ya tenías — del perfil y del storage. Nadie lee "cambiar" como "vas a perder las anteriores". Ahora dice **"sumar foto"** y agrega hasta 3; cuando llegas al tope te dice "3 de 3 fotos" en vez de ofrecerte un botón que no haría nada. El análisis se recalcula sobre el conjunto completo, así que el resumen describe tu estilo entero y no la última foto.
- **Las fotos de referencia ahora se ven.** Vivían en una columna de 64 px al lado del texto: en un teléfono de 375 px eso dejaba el texto en 163 px, con el resumen partido en 8 renglones y las etiquetas cayendo una por fila. Ahora van arriba, a lo ancho de la card — que es lo mínimo en una sección cuyo argumento es que tu referencia es visual. De paso: antes solo se mostraban 2 fotos aunque hubieras subido 3.

### Fixed

- Si el análisis de un estilo fallaba al sumar fotos, se borraban también las que ya tenías guardadas y tu perfil quedaba apuntando a archivos inexistentes. Ahora solo se limpian las nuevas.

## [0.2.41.0] - 2026-07-28

### Changed

- **"Cuál es tu estilo" ahora se pregunta una sola vez.** Eran dos bloques pegados haciendo la misma pregunta con el mismo peso: uno pedía fotos de un estilo que te gusta y el otro, justo debajo, pedía que lo describieras por escrito. Ni Roberto sabía cuál era cuál. Ahora es una sola card: las fotos son la petición (señalar es fácil; describir tu propio estilo con palabras casi nadie puede), y el texto libre bajó a un renglón opcional adentro — "¿algo más que deba saber?", cerrado hasta que lo abras, para lo que las fotos no dicen: un corte que odias, algo que nunca te pondrías. Lo que ya hayas escrito sigue igual y sigue llegando a todos tus looks, tu cápsula y tu maleta.

## [0.2.40.2] - 2026-07-27

### Changed

- **Escondido el atajo "usa el estilo de una de nuestras stylists" (Carla / María).** En pantalla eran dos nombres y un párrafo: sin una sola imagen no le dicen nada a nadie, y estábamos pidiéndote adoptar un estilo que no puedes ver. Sigue estando el camino que sí tiene sentido — subir 1-3 fotos del estilo que te gusta. Apagado, no borrado: cuando cada stylist tenga fotos de su guardarropa se vuelve a prender. Nadie lo había usado, así que no le quita nada a ningún perfil.

## [0.2.40.1] - 2026-07-27

### Fixed

- **En el try-on ya no sales abotonado hasta el cuello.** Las camisas salían cerradas al cuello y los polos con todos los botones puestos — nerd, y como nadie se viste de verdad (lo cachó Roberto). El prompt cuidaba la pose ("nada de pose de catálogo") pero no cómo se lleva la ropa. Ahora la camisa va con el primer botón abierto (dos si el look es casual) y el polo con la tira abierta. Se respeta la excepción real: con corbata o traje formal, la camisa sí va cerrada. Y si el consejo de styling del look dice otra cosa, ese manda.

## [0.2.40.0] - 2026-07-27

### Changed

- **En los looks de cápsula y viaje, tu foto es ahora la protagonista de la card.** Antes el render quedaba en una miniatura de 42 px con un "toca para verlo en grande": un toque de más para ver algo que tarda ~20 s y cuesta en cada generación. Ahora, en cuanto existe, ocupa el sitio de la tira de prendas y ellas se van a una columna al lado, con la lupa a pantalla completa arriba a la derecha — la misma anatomía que ya tenía el detalle del look, no un tercer diseño distinto.
- **Una sola fila de acción por look.** Sin foto: "verme con este look" en negro (es la acción que casi nadie sabe que existe) con el 👍/👎 al lado. Con foto ya no hay nada que generar, así que la fila es solo "¿te gusta?" y sus botones, sin nada que les compita — el feedback es la señal más escasa que tenemos.
- **La card ya no brinca al terminar el try-on.** El sitio de la columna de prendas se reserva desde que arranca la generación; antes el marco se angostaba de golpe al aparecer la foto y todo lo de abajo saltaba.

## [0.2.39.3] - 2026-07-27

### Fixed

- **La app ya no te propone prendas que no existen.** Al rearmar su cápsula, a Roberto le salió una "playera de lino": el lino es fibra rígida, no se teje en punto, así que esa prenda no se vende en ninguna tienda — y una cápsula es una lista de compras, así que pedir algo inexistente la vuelve inservible. Ahora los dos motores que inventan prendas (la cápsula del clóset y la maleta del viaje) tienen que proponer cosas que se puedan comprar tal cual: en lino hay camisa, pantalón, short y saco, no playeras ni suéteres; y a unos jeans no se les pone otra tela porque ya son de mezclilla. La regla vive en un solo lugar para los dos motores.

## [0.2.39.2] - 2026-07-27

### Fixed

- **La foto de una prenda ahora dice de qué prenda es.** Al abrir una miniatura de "ya lo tienes" se veía TU prenda pero con el nombre de la pieza de la cápsula encima: la foto de un traje de baño titulada "Short de lino marino" (lo cachó Roberto, y se lee como que la app confunde una prenda con otra). Ahora el título es tu prenda y debajo dice qué pieza de la cápsula cubre. Si se llaman igual, solo dice "en tu clóset".

## [0.2.39.1] - 2026-07-27

### Changed

- **Los trajes de baño de hombre ya se llaman "traje de baño", no "short de baño".** El nombre viejo empezaba con la palabra de otra prenda, y eso fue justo lo que hizo que el motor tomara el traje de baño de Roberto por el short de lino de su cápsula (mismo primer sustantivo, mismo color, misma categoría). El arreglo de fondo ya estaba en 0.2.38.0; esto quita la trampa de raíz, y de paso es como se dice en español de México. Si tenías uno guardado, se renombró solo — la prenda, su foto y los looks donde aparece siguen igual.

## [0.2.39.0] - 2026-07-27

### Added

- **Ahora te puedes probar un look sin dar vueltas.** Para verte con un look de tu cápsula (o de un viaje) había que marcarlo favorito, irse al Historial y probárselo allá. Ya no: cada look tiene su "verme con este look" ahí mismo, y la foto queda guardada — no se vuelve a generar cada vez que entras.
- **Los looks de tu cápsula ya tienen corazón y 👍/👎.** Guardar uno lo manda a tu Historial con su etiqueta "Cápsula". Y el voto de la cápsula por fin cuenta: alimenta lo que la app aprende de tus gustos, cosa que el voto de los looks de viaje nunca hizo.
- **"Generar más" en los looks de la cápsula**, y si alguna ocasión de tu vida no se pudo armar (trabajo, salir de noche), ahora se dice en vez de omitirla en silencio.
- **Toca la foto de una prenda dentro de un look para verla en grande**, y si aún no tiene foto, para generarla. Antes eso solo existía en los looks de viaje.

### Changed

- **Los looks del viaje y los de la cápsula ahora son la MISMA pieza.** Eran dos, y la de la cápsula se había quedado atrás sin que nadie lo notara: sin corazón, sin voto, sin zoom. Ahora lo que se le agregue a una llega a las dos.
- **Los looks de la cápsula y del viaje ya no le quitan ideas al look de Hoy.** El motor diario evita repetir lo que te propuso las últimas dos semanas; ahora que estos looks viven en la misma tabla, 15 de cápsula lo habrían dejado casi sin combinaciones. Solo los diarios cuentan para eso.

## [0.2.38.0] - 2026-07-27

### Fixed

- **El aviso "actualizar mis looks" ya se va cuando los actualizas.** Al generar los looks de tu cápsula se guardaba una marca del clóset distinta a la que la pantalla comparaba, así que nunca coincidían: el cartel amarillo quedaba pegado para siempre y volvía a salir aunque acabaras de regenerar. Ahora hay una sola marca.
- **Un traje de baño ya no cuenta como que tienes un short.** A Roberto su "short de baño marino" le tapaba el "short de lino marino" de la cápsula — y su lectura fue "de shorts solo me puso un traje de baño". Lo que no es ropa de calle (baño, pijama, ropa interior, gym) ya no cubre ropa de calle ni al revés, y va blindado en código, no solo pidiéndoselo a la IA. Los emparejamientos ya calculados se recalculan en tu próxima visita.

### Changed

- **Si viajas a un clima caluroso, la cápsula ahora sí te viste allá.** Antes sumaba "1 o 2 piezas" para el clima de viaje y trataba igual al frío que al calor. No es lo mismo: el frío se resuelve con capas encima de lo que ya tienes, pero un viaje de calor te cambia el outfit completo. Ahora el calor pide un set de 3 o 4 (traje de baño, un short de calle, tops frescos) y esas piezas quedan exentas de la regla de que todo debe combinar con al menos otras tres — que era, en silencio, lo que dejaba fuera al traje de baño.

## [0.2.37.0] - 2026-07-26

### Added

- **Toca la foto de una prenda en la cápsula y la ves en grande.** Las miniaturas de "ya lo tienes" miden 38 px y no se distinguía qué prenda era; ahora un toque la abre completa, con su nombre y qué prenda tuya la cubre. También funciona en la tira compacta y en las piezas que te faltan (ahí, si la foto aún no existe, el primer toque la sigue generando).

## [0.2.36.2] - 2026-07-26

### Fixed

- **Las prendas generadas ya no salen achatadas.** Se creaban cuadradas pero se muestran en un hueco vertical, así que la app las ampliaba un tercio y les recortaba los lados: la prenda se veía grande, apretada y corta (lo cachó Roberto con un polo negro que salía más chaparro que el suyo). Ahora se generan en la misma proporción en la que se ven. Aplica a las piezas sugeridas de la cápsula y a las fotos que la app genera para tu clóset.

## [0.2.36.1] - 2026-07-26

### Fixed

- **Marcar "ya la tengo" en una pieza que antes comparaste ya no la deja como hueco.** Si primero elegiste "quiero la sugerida" en una comparación y después marcaste esa pieza como tuya, seguía apareciendo en "lo que más te suma" con un cartel sin sentido: "dijiste que tu Traje marino de lana no la cubre". La decisión vieja se quedaba pegada y cambiaba de significado. Ahora decir "ya la tengo" borra cualquier decisión previa sobre esa pieza, y lo mismo al recalcular el match. Se corrigieron también los perfiles que ya tenían el resto pegado.

## [0.2.36.0] - 2026-07-26

### Fixed

- **Un reloj ya no se compara contra unos lentes.** El motor tenía una red que impide cruzar categorías (un pantalón no lo cubre un zapato), pero reloj, lentes, cinturón y bolsa son todos "accesorio", así que los daba por intercambiables. Ahora distingue la clase fina dentro de accesorios, en código y no solo pidiéndoselo a la IA. Los emparejamientos ya calculados se recalculan solos en tu próxima visita.

### Changed

- **Al decidir una comparación, se abre sola la siguiente.** Antes volvías al estado neutro y tenías que tocar una por una; con cuatro pendientes eran cuatro toques de más.

## [0.2.35.1] - 2026-07-26

### Fixed

- **Armar la cápsula ya no se corta a la mitad.** Terminar el cuestionario devolvía un "esta página no se pudo cargar": armar la cápsula tarda ~40 segundos y el límite estaba en 60, así que un perfil rico se pasaba y el servidor cortaba la llamada. El techo sube a 300 segundos, que es el máximo de la plataforma.
- **Y si algo falla, ya no pierdes el cuestionario.** Tus respuestas ahora se guardan **antes** de armar la cápsula. Antes se guardaban solo si la generación fallaba "por las buenas" — un corte por tiempo mataba el proceso entero y las 10 respuestas se iban con él. Ahora un fallo cuesta la cápsula, no volver a contestar todo.
- **Quien no viaja podía quedarse atorado**: la pregunta nueva del clima de viaje se validaba aunque nunca se hubiera mostrado, así que el cuestionario se rechazaba con un "te faltó responder una" imposible de resolver. Ahora solo se exigen las preguntas que de verdad viste.

## [0.2.35.0] - 2026-07-26

### Added

- **La cápsula ya considera a qué clima viajas, no solo el de tu ciudad.** Si vives en un clima templado pero viajas al frío, tu clóset ideal salía correcto para tu ciudad y genérico para tu vida: nunca te iba a proponer un abrigo de verdad — y no puedes empacar lo que no tienes. Ahora, **solo si dijiste que viajas seguido**, aparece una pregunta más: "¿a qué clima viajas?", con casillas para marcar frío, playa o nada distinto. Quien no viaja no ve ese paso.
- El motor suma **1 o 2 piezas** para ese clima —un abrigo de lana de verdad, un traje de baño— no un guardarropa paralelo, y en tu paleta para que sirvan también en tu ciudad.

## [0.2.34.0] - 2026-07-26

### Changed

- **La cápsula deja de pedirte tres cosas a la vez.** La pantalla abría sus tres secciones con el mismo peso —comprar, decidir, revisar— y la más grande era la que menos importa. Ahora "lo que más te suma" manda y las otras dos arrancan cerradas, a un toque. Con cinco piezas, la pantalla que antes pedía scroll ahora cabe de un vistazo.
- **La comparación "decide si te sirve" empieza en una fila.** Las dos miniaturas, el nombre y en qué difieren; un toque la abre a la comparación grande de siempre, con sus fotos y sus acciones. Antes cada una era la card más alta de la pantalla.
- **Las prendas sin foto ya no son un bloque de color.** Un rectángulo saturado se leía como imagen rota y era lo más llamativo de una app en blanco y negro. Ahora es el papel de la app con una percha y el color en una banda delgada al pie — el dato de color sigue ahí, sin gritar.
- **Se fue el "no me late".** Sonaba a relleno, no a la voz de la app. Ahora es **"esta no me convence — cámbiala"**, y lo mismo en Viaje, que arrastraba la misma frase.

## [0.2.33.1] - 2026-07-26

### Fixed

- **Los enlaces de la cápsula ya se pueden tocar bien.** Nueve de quince controles estaban por debajo del mínimo táctil (el "no me late" medía 17 px de alto) y encima quedaba pegado al botón "ya la tengo": un dedo que fallaba por 4 px disparaba un cambio de pieza con IA en vez de marcarla como tuya. Ahora todos miden 44 px y esas dos acciones opuestas están separadas.
- **Un solo vocabulario para "no me gusta"**, que antes eran tres frases distintas para dos cosas distintas: **"esta no me late — cámbiala"** y **"ninguna me late — cámbiala"** cambian la pieza sugerida; **"esta no la cubre"** corrige el emparejamiento del match. Rechazar una prenda y corregir un error ya no se dicen igual.

## [0.2.33.0] - 2026-07-26

### Added

- **"Ya lo tienes" ahora se puede abrir y corregir.** Era la única sección sin acciones: miniaturas mudas que no decían de qué prenda tuya te estaba acreditando, y si el match se equivocaba dándote cobertura de más, no había forma de arreglarlo — el "N de M" solo se podía corregir hacia abajo. Ahora:
  - Un **"ver cuáles"** despliega la lista: cada pieza ideal con **"la cubre tu «X»"**. Va **cerrada por defecto** — si no la abres, la pantalla se ve igual que siempre; no es una tarea que la app te pida.
  - **"no la cubre"** desmiente el emparejamiento: la pieza pasa a "lo que más te suma" con todas sus opciones y el conteo baja. Se puede deshacer con "cambiar".

## [0.2.32.0] - 2026-07-26

### Added

- **La comparación te dice EN QUÉ difiere tu prenda de la sugerida** ("cambia: manga corta vs larga"). Antes tenías que adivinarlo de las fotos — con dos camisas azul rey casi idénticas era imposible. Los matches viejos se recalculan solos en la siguiente visita.

### Fixed

- **Si rechazas la comparación, esa pieza pasa a "lo que más te suma" con todas sus opciones.** Antes se quedaba en "decide si te sirve" (aunque ya habías decidido) y perdía el "no me late", el "quitar" y el conteo de looks que desbloquea. Sigue teniendo "cambiar" por si te arrepientes.
- **El aviso de la cápsula ya no promete algo que no hace**: decía que te cambiaba la pieza "por otra opción tuya" cuando en realidad sugiere otra prenda ideal.

## [0.2.31.0] - 2026-07-26

### Added

- **La comparación de la cápsula tiene tercer camino: "¿ninguna te late? te sugiero otra".** Antes solo podías elegir entre la sugerida y la tuya — si no te gustaba ninguna, no había salida (pregunta de Roberto). El enlace pide otra alternativa a la IA para el mismo hueco (el swap que ya existía en "lo que te falta", ahora conectado aquí): hasta 2 intentos, y al segundo rechazo el hueco se retira solo de la cápsula.

## [0.2.30.0] - 2026-07-26

### Fixed

- **La cápsula ya no empareja prendas que no son comparables.** El match sugería un henley gris y decía que "ya lo tenías" con una camiseta térmica negra (feedback de Roberto). Dos arreglos:
  - **El juez del match aprieta el "tipo fino"**: si el rasgo que define a la prenda ideal (la botonadura de un henley/polo, el cuello alto, los botones de una camisa) no existe en la tuya, es hueco — una camiseta lisa no cubre un henley. Las capas térmicas/base tampoco cubren camisetas de diario (uso distinto), y la manga corta vs larga ya cuenta.
  - **El rótulo de la comparación dice la verdad**: "lo más parecido" en vez de "ya la tienes" — esa card solo aparece cuando el match fue apenas parecido, no un match exacto.
  - Los matches ya calculados se recalculan solos en la siguiente visita a la cápsula (la versión del juez ahora es parte del caché; los looks de la cápsula NO se regeneran).

## [0.2.29.3] - 2026-07-26

### Fixed

- **La biblioteca (y cualquier página) ya no puede quedarse sin scroll.** Había 8 hojas/overlays que bloqueaban el scroll del fondo cada uno por su cuenta ("guardo el estado anterior y lo restauro al cerrar"); si dos se traslapaban en el tiempo — p. ej. la hoja "más" → "añadir prendas" → navegar a la biblioteca — la segunda guardaba "bloqueado" como estado anterior y al cerrarse dejaba la página trabada hasta recargar. Ahora todos comparten un solo candado con conteo: el scroll vuelve exactamente cuando la última hoja se cierra. Verificado reproduciendo la secuencia exacta del bug.

## [0.2.29.2] - 2026-07-26

### Fixed

- **Los looks de 5+ prendas recuperan su acomodo: 2 protagonistas arriba + fila de apoyo abajo.** La regla existía desde el primer detalle del look, pero el refactor de "cabe sin scroll" la tiró sin querer y la 5ª prenda quedaba sola con un hueco muerto al lado. De paso, la retícula se extrajo a un componente compartido (`PrendasGrid`) — Hoy e Historial usaban copias duplicadas y por eso divergieron.

## [0.2.29.1] - 2026-07-26

### Changed

- **El botón de compartir de la pantalla completa se movió arriba a la derecha** (espejo de la X de cerrar, sobre la foto), en vez de al final de la tira de prendas. Pedido de Roberto.

## [0.2.29.0] - 2026-07-26

### Added

- **Compartir el look desde la pantalla completa del try-on.** Botón al final de la tira de prendas (como en el diseño): comparte la foto del render con la hoja nativa del teléfono; en desktop la descarga. Decisión de Roberto — "compartir" sale formalmente de la lista fuera-del-MVP.

## [0.2.28.2] - 2026-07-26

### Fixed

- **La pantalla completa del try-on (lupa) ya no tiene la mancha gris arriba.** Era un velo de contraste que el diseño pedía para cuando la foto sangra hasta la barra de estado — en el teléfono real la foto no llega ahí, así que el velo solo ensuciaba. Fuera.
- **Los thumbnails de la tira de la pantalla completa crecieron (38→56px)**: abajo sobraba aire muerto y ahora lo ocupa la prenda. Además, el botón de la lupa se oculta mientras la pantalla completa está abierta.

## [0.2.28.1] - 2026-07-26

### Fixed

- **Las miniaturas junto al render ya no se ven recortadas.** Se estiraban para igualar el alto del render (como pedía el mock) y el recorte se comía la prenda. Ahora van en proporción fija 4/5 — la misma de todos los tiles de la app — un poco más pequeñas pero con la prenda completa. Con muchas prendas la columna se desliza.

## [0.2.28.0] - 2026-07-26

### Changed

- **Detalle del look v2** (handoff `design_handoff_look_detalle_v2`), en Hoy, el onboarding y el Historial:
  - **El "por qué / cómo llevarlo" es ahora la voz del coach al pie**, montada en el filete que separa el cuerpo de la botonera, con crossfade entre los dos textos. Ya no compite con las pestañas: las pestañas son vistas del look, el porqué es el coach.
  - **El corazón (y el ⋯ en Historial) viven en la fila de pestañas**, a la derecha — el nombre del look recupera el ancho completo.
  - **Las miniaturas del try-on van en columna al lado del render**, no en tira debajo: el render gana ~80px de alto.
  - **Historial:** la tab bar queda visible en el detalle (antes el overlay la tapaba) y "borrar este look" se movió al menú ⋯. El detalle ahora también muestra el "cómo llevarlo" del look (antes solo el porqué).
  - Se conserva la decisión de ayer: las fotos se ajustan para que todo quepa sin scroll en cualquier pantalla (decisión de Roberto sobre el mock, que fijaba el tamaño). "Compartir" del handoff se omite: fuera del MVP.

## [0.2.27.0] - 2026-07-26

### Fixed

- **La ropa de baño ya no puede aparecer en un look de calle** (prompt del motor v27). Nada lo impedía: el catálogo no marca contexto en ninguna prenda y todas son "casual", así que un traje de baño podía salir en un look de oficina. Peor: bikini y traje de baño están guardados como categoría "vestido", o sea que el motor los podía servir como **look completo**, y el short de baño como pantalón. Ahora es regla dura en el generador y el juez lo caza y lo repara si se resbala.
- **El top deportivo (tipo bra) ya no sale como único top de un look.** No se prohíbe —sería desperdiciar el athleisure en color— sino que pide una capa encima (sudadera, camisa o chamarra abierta) que lo convierta en look de calle.
- Los looks de **viaje no se tocan**: tienen su propio motor, donde la playa sí es una ocasión legítima y el traje de baño debe salir.

## [0.2.26.0] - 2026-07-26

### Added

- **Athleisure de mujer en color: leggings y tops deportivos en olivo, lavanda y crema.** El set athleisure de la biblioteca existía sólo en negro y gris. Ahora las dos piezas héroe (legging de cintura alta + top deportivo) están en tres colores, así que se pueden armar conjuntos del mismo tono. Los tres colores ya existían en el vocabulario del catálogo, y el color del swatch se muestreó de la foto real para que coincida.

### Changed

- **"Leggings negros" ya no está duplicado** en la biblioteca de mujer (había dos arquetipos de la misma prenda). Se conservó el de mejor foto, con los atributos de corte y largo del otro. Ninguna usuaria tenía la prenda duplicada en su clóset, así que nadie perdió nada.
- **El generador de imágenes del catálogo admite el prompt afinado con "sombra de contacto"** (tipo `flat-sombra`), que evita que las prendas claras se vean lavadas contra el fondo papel. Es opt-in por prenda: las 265 imágenes ya curadas NO se regeneran.

## [0.2.25.2] - 2026-07-26

### Changed

- **Se ocultó el "Pasaporte de estilo" de Perfil.** El banner negro que abría el pasaporte (en Perfil → Estilo) ya no se muestra: mucho de su contenido ya vive en las otras secciones de Estilo. Es un ocultamiento reversible (bandera `MOSTRAR_PASAPORTE`), no un borrado; la pantalla `/perfil/pasaporte` sigue existiendo pero ya no es alcanzable desde la app.

## [0.2.25.1] - 2026-07-26

### Changed

- **El checklist "qué sigue" ya no aparece encima del look del día.** Se sentía fuera de lugar apilado sobre el outfit ya generado (y rompía el que el look llenara la pantalla). Ahora vive sólo en la home de "antes del look" — cuando entras y todavía no hay outfit del día. En la vista con el look, la pantalla es sólo el look.

## [0.2.25.0] - 2026-07-26

### Changed

- **La colorimetría se presenta con "familias de color", no con una sola paleta.** La intro del test mostraba una única paleta que se podía leer como "estos son TUS colores" (falso, antes de hacer el test). Ahora muestra varios ejemplos de familias (las estaciones, sin etiquetarlas) para enseñar el concepto — el color viene en familias y el test encuentra la tuya — y se quitó la placa dorada.
- **El botón "más" del nav es una paleta de atajos (mosaicos), con un segundo nivel para "añadir prendas".** En vez de una lista, "más" abre una cuadrícula de atajos (armar maleta, modo tienda, tus colores, viajes, favoritos, wishlist) con "añadir prendas" arriba; al tocarlo, morfa a un segundo nivel con las tres formas de añadir (una prenda · varias de golpe · la biblioteca), cada una con una frase corta que explica qué es.

## [0.2.23.1] - 2026-07-26

### Fixed

- **El detalle del look ahora CABE en la pantalla sin scroll — la fila de acciones ya no queda escondida detrás de la barra de abajo.** Antes el detalle crecía con el contenido (4 fotos verticales grandes + texto + botones) y, con la tab bar fija encima, el "otro look / ¿te gusta? / votos" caía debajo del borde en teléfonos menos altos. Ahora el detalle se acota al alto visible (entre el header y la barra), la fila de acciones queda fija abajo (siempre visible) y la retícula de prendas / el render se ajustan a lo que quede: más chicos en pantallas cortas, grandes en las altas. Aplica a Hoy, al primer look del onboarding y al detalle de Historial.

## [0.2.23.0] - 2026-07-25

### Changed

- **El detalle de un look en Historial adopta el mismo "así te queda".** Completa `design_handoff_try_on` en su tercera superficie: al abrir un look pasado ya no salta el modal oscuro; usa las mismas dos vistas (`las prendas` | `así te queda`) con el render dentro del marco 3:4, la animación de generación en papel y la lupa a pantalla completa. Se conserva lo propio del Historial: el back "‹ historial", "me lo vuelvo a poner" (re-usar un look pasado) y borrar. Si el look ya trae render, abre directo en "así te queda".
- **El render del try-on vive ahora en un solo componente compartido (`TryonView`).** El marco 3:4 + la animación de generación + la lupa dejaron de estar duplicados: Hoy, el onboarding y el Historial usan exactamente la misma pieza.

## [0.2.22.0] - 2026-07-25

### Changed

- **El try-on ("verte con el look") ahora vive DENTRO del detalle del look, ya no en un modal negro aparte.** Implementa el handoff `design_handoff_try_on`. Deja de anunciarse como otra app y pasa a ser una segunda vista del mismo look, en papel:
  - **Dos pestañas** — `las prendas` (el collage de siempre) y `así te queda` (tu avatar vestido) — que morfan según exista el render: sin render solo se ve "las prendas" + el botón "verme con este look"; con render "así te queda" queda por defecto y ya no se vuelve a ofrecer generar.
  - **La animación de generación ocurre dentro del marco 3:4** (silueta + tus prendas pasando una a una + barrido de luz), en papel y sin overlay oscuro, con una voz de estilista que cambia mientras te viste.
  - **Lupa a pantalla completa** con la foto a sangre + la paleta de colores del look + la tira de prendas.
  - **Se entierra el "me lo pongo" del mismo día** (generaba "me lo puse" falsos porque se tocaba solo para avanzar): con el render a la vista, la acción del día es el voto 👍/👎; el "¿te lo pusiste?" se sigue preguntando al día siguiente.
  - Aplica al primer look del onboarding y al look de Hoy. El detalle del Historial se migra al mismo lenguaje en un paso aparte.

## [0.2.21.2] - 2026-07-25

### Fixed

- **"¿Quedó?" del avatar: se acabó la caja blanca vacía bajo tu avatar.** La imagen vivía en un recuadro blanco fijo (`flex-1` + `bg-surface`) y, como el avatar no llenaba todo el alto, quedaba un bloque blanco enorme debajo que se veía roto. Ahora la imagen se centra en el aire libre, acotada al espacio, con el borde pegado a ella — el aire alrededor es papel, no una caja blanca.

## [0.2.21.1] - 2026-07-25

### Changed

- **Limpieza interna (sin cambio visible):** se borró el código muerto de los nudges de uno-en-uno, que el checklist de activación de Home reemplazó. Fuera: `nextBestAction`/`isOpen` de `lib/journey.ts` y los componentes `tryon-nudge`, `link-nudge`, `nudge-shell`. Se conservan los tipos de `journey_state` y `markNudge` (`lib/journey-actions.ts`) porque el avatar-wizard todavía marca "tryon" como done.

## [0.2.21.0] - 2026-07-24

### Changed

- **Flujo del avatar rediseñado: de 5 pantallas a 4, sin hueco muerto.** Implementa el handoff `design_handoff_avatar`.
  - **Header único** en las cuatro (back de 36px + barra de 3 segmentos + "paso N de 3"), CTA siempre visible, y el deshabilitado ahora se ve inactivo de verdad (`accent-soft`/`faint`, ya no el gris que parecía "activo apagado").
  - **Pantalla 1 "Una foto tuya":** se pide UNA sola foto (un hueco, no varios espacios vacíos que se leen como tarea pendiente); el segundo ángulo aparece después y como link. Foto grupal → retículo de encuadre + "ajustar" (recorte in-app, nunca sales de la app).
  - **Pantalla del cuerpo, fusionada con la silueta:** muere la pantalla de bifurcación "Ahora, tu cuerpo" (~700px de vacío). La retícula de siluetas es el default; subir foto de cuerpo pasa a ser un link, no un paso. Estatura en una fila.
  - **Labels de complexión neutros** (hombre): Musculoso→**Fuerte**, Robusto→**Amplio**, Corpulento→**Grande** — dejan de juzgar. Los `id` en DB no cambian (el `body_build` guardado sigue válido) ni las imágenes.
  - **"¿Quedó?" muestra una sola vista** (el cuerpo completo de frente, con el que se prueba cada look). Se fue la tira de 3 miniaturas que nadie auditaba; el sheet multi-ángulo se sigue generando en silencio para el try-on.
  - **Correcciones de la cara colapsadas** tras "algo no cuadra ›" — el camino feliz ("sí, soy yo") manda. (El juez de parecido se mantiene visible: genera valor.)
- **Fix (retorno del avatar):** crear el avatar desde el onboarding ya no te deja en Perfil. El allowlist de retorno de `/perfil/avatar` comparaba el string completo contra `/onboarding/wow`, pero el wow manda `?look=<id>` (con query) → nunca hacía match y caía a `/perfil`. Ahora valida el pathname y conserva la query, con guard anti open-redirect.

## [0.2.20.0] - 2026-07-24

### Changed

- **Intro de colorimetría rediseñada ("Hablemos de tus colores").** La pantalla que invita al test ahora ENSEÑA qué es la colorimetría en vez de explicarla: un par de campos (un tono que te ilumina la cara vs. uno que te apaga, tocables para invertir cuál favorece) + la paleta que el test produce + la placa metálica. Costo declarado ("cinco preguntas · cuarenta segundos · sin foto"), lead en primera persona del coach, y se fue el hueco muerto de ~380px que la hacía leer como aviso legal. Los tonos y la paleta son contenido (muestras de ropa), no tokens de marca. Se eliminó el párrafo de "es opcional" (el "ahora no" ya lo comunica).

## [0.2.19.0] - 2026-07-24

### Added

- **Checklist de activación en Home ("qué sigue").** La superficie única que te dice qué hacer para sacarle más a la app: créate tu avatar → añade tus prendas → afina tu estilo → (cuéntame de tu cuerpo, solo hombre/mujer) → arma tu cápsula. Con estado visible (paso hecho = palomeado), se autodestruye cuando completas todo. Reemplazó los nudges de uno-en-uno: aparece como card única tanto en el home vacío como acompañando tu look del día.
- **"Afina tu estilo" tiene ruta propia** (`/perfil/referencia`). Subir 1-3 fotos de un estilo que te encanta es ahora un destino de primera clase (linkeado desde el checklist), no una card enterrada en un tab de Perfil.

### Changed

- **Fin del onboarding, sin sorpresas.** El 👍/👎 del primer look ya no te saca de la pantalla — registra en el lugar y tú decides cuándo entrar, con un botón explícito "entrar a la app". Se eliminó el paso "afina tu estilo aún más" (con las stylists Carla/María) que interrumpía justo después del primer look; ese contenido vive ahora en el checklist y en `/perfil/referencia`.

## [0.2.18.1] - 2026-07-24

### Fixed

- **Clóset ("¿qué ya tienes?"): al pasar de una categoría a la siguiente, la página se quedaba scrolleada abajo** en vez de arrancar desde arriba — tenías que subir a mano para ver las prendas de la nueva sección. El scroll al inicio ahora corre en el momento correcto (tras renderizar la categoría nueva) y es instantáneo, así no se queda a medias cuando la sección nueva es más corta.

## [0.2.18.0] - 2026-07-24

### Added

- **La pantalla del look, rediseñada (wow y Hoy, unificadas).** Un solo botón negro (el CTA de "verme"), los votos en círculos discretos, "otro look" como enlace — se acabó el tablero de acciones que competían. Las prendas en un grid que se adapta al número (con 5+ resaltas las 2 protagonistas), el nombre sobre cada foto, y un solo texto que intercambia el "por qué" con el "cómo llevarlo". Componente compartido `LookDetail`, así el primer look y el diario se ven idénticos.
- **La colorimetría ahora es opcional, con una pantalla que explica su valor.** Antes te tiraba directo a las preguntas de color sin contexto. Ahora un intro te dice por qué importan tus colores ("elijo los que te iluminan la cara") y te deja saltarla ("ahora no, lo hago después") — se llena luego desde Perfil. No es un peaje.
- **Cámara-primero en la foto de cara del avatar** + recorte para aislarte si sales con alguien más (reusa el recortador del carrete de prendas) + aviso de "que salgas solo tú".

### Changed

- **El metal de colorimetría, resuelto para las fronteras.** Si tu estación cruza cálido/frío (p. ej. invierno con guiños de otoño), ahora se marca que **los dos metales te van** en vez de imponerte uno. La pregunta del metal volvió con opción "no sé", y ya no te contradice.
- **Preguntas de estilo más people-friendly.** Las que genera la IA para afinar tu estilo (y la de fit de la cápsula) dejaron la jerga de moda: nada de "textura satinada", "cortes", "silueta" — ahora se dicen en palabras de todos los días, con prendas concretas.
- **El primer look: decisión simple.** En el onboarding, 👍/👎 registra y avanza; las acciones pesadas viven en Hoy.
- **Clóset**: el flujo guiado ya no salta sacos ni abrigos (pregunta por ellos, con opción de saltar), y hay más sacos de hombre entre los básicos.
- **Objetivo del onboarding**: "día a día" preseleccionado, las demás ocasiones visibles pero "después".
- **Preguntas de calibración post-swipe**: opcionales, con un intro que pregunta si quieres afinar o seguir.

### Fixed

- **Imágenes del swipe (hombre)**: regeneradas romántico (sin la prenda alucinada), glam de noche (con brillo y botines, ahora sí lee "de noche") y tonos tierra (sin la bolsa cruzada). Origen: una pose que pedía ajustar una chamarra inexistente — arreglado en el generador con override de pose.

## [0.2.17.0] - 2026-07-24

### Fixed

- **Construir tu avatar ya no te regresa a re-elegir el look.** En el primer uso, si elegías un outfit y luego "verme con este look" para armar tu avatar, al volver la pantalla se reiniciaba y te mandaba otra vez al selector de los 3 — perdías tu elección y el flujo se sentía en círculos. Ahora el look que elegiste viaja contigo: al volver del avatar caes directo en ESE look, y si acabas de crear tu avatar, el try-on se abre solo ("ya te lo ve puesto") sin pedirte otro toque.

### Changed

- **El primer look ahora es una decisión simple, no un tablero de opciones.** Antes la pantalla del primer look tenía demasiadas acciones peleando ("verme", "otro look", "seguir", "me lo pongo"). En el primer uso ahora es directo: ves el look, opcionalmente te ves con él puesto, y decides **me gusta / no me gusta** — cualquiera de los dos te avanza. "Otro look" queda chico y discreto. Las acciones pesadas ("me lo pongo", cambiar avatar en el modal) se difieren a Hoy, donde ya entendiste el producto y quieres más control.

## [0.2.16.0] - 2026-07-24

### Fixed

- **Tu primer look ya no te obliga a decir "me lo pongo" para entrar.** En el primer uso, después de elegir uno de los tres looks, la única puerta para seguir era el botón "me lo pongo" — un compromiso fuerte (implica que de verdad te vas a poner esa ropa hoy) que no es intuitivo y que, encima, ensuciaba la métrica más valiosa: cada persona que lo tocaba solo para avanzar generaba un "me lo puse" falso. Ahora hay una fila **"¿te late?" 👍/👎** de un toque para decir qué te pareció (sin sacarte de la pantalla), un **"seguir →"** claro que te mete a la app sin fingir nada, y "ya me lo puse hoy" queda como señal honesta y opcional, no como peaje. El 👍 también dispara el aviso de instalar la app, como debía.

### Changed

- **El motor de outfits, recalibrado con la investigación de prior art (v26).** Dos ajustes de criterio: (1) los colores que tu colorimetría marca como "evita" cerca de la cara pasan de veto absoluto a preferencia fuerte — el principio cálido/frío tiene base real, pero la etiqueta de "estación" es folclore, así que si tu clóset no da una mejor opción, el look no se rompe por eso (tus vetos personales siguen siendo absolutos); (2) se acotó la regla de capas: una sobrecamisa gruesa abierta sobre un suéter ligero sí es una capa válida y ya no se marca como error — solo la camisa de vestir fina va debajo del punto.

## [0.2.15.2] - 2026-07-23

### Fixed

- **Dos flechas "atrás" apiladas en el wizard de avatar.** En los pasos de retrato, cuerpo y resultado convivían "← Volver" (salir a Perfil) y el "atrás" del paso, idénticas y una encima de otra, pero yendo a lugares distintos. Ahora solo aparece una: la del paso cuando existe, y la de salida solo donde es la única.

## [0.2.15.1] - 2026-07-23

### Fixed

- **Las fotos opcionales del avatar ya no se sienten obligatorias.** La segunda foto de cara (y las dos extra de cuerpo) se veían como tarjetas idénticas a la principal: parecían pasos obligatorios por más que dijeran "Opcional". Ahora la principal es la única tarjeta y los extras son filas discretas tipo "sumar otro ángulo" — la jerarquía visual dice lo que el texto quería decir, y ya ni hace falta la palabra "Opcional".

## [0.2.15.0] - 2026-07-23

### Added

- **Si te representas con tu foto, ya deduzco tu complexión de ahí.** Al subir tu foto de cuerpo, la leo en segundo plano y te lo digo en una línea: *"por tu foto diría que tu complexión es Atlética. Así afino los consejos de estilo — cambiar"*. Antes, elegir el camino de la foto te dejaba sin esa señal y el motor perdía una pista para el styling; ahora la recupera sin pedirte un paso extra. Nunca se guarda a ciegas: siempre puedes corregirla de un toque, y si la foto no se ve bien lo dice en vez de inventar. Si ya elegiste tu silueta a mano, tu elección manda — no la pisa.

## [0.2.14.0] - 2026-07-23

### Changed

- **El paso del cuerpo ahora te pregunta CÓMO, en vez de darte todo junto.** Antes veías la galería de siluetas y los espacios para subir fotos en la misma pantalla, sin saber qué se esperaba de ti. Ahora eliges primero: *"elegir un cuerpo parecido"* (rápido, sin fotos) **o** *"usar una foto mía"* (más fiel a tus proporciones) — y solo ves lo de esa opción, con un "cambiar forma" para volver.
- Si eliges la foto, tus fotos **son** la referencia: ya no hace falta encasillarte en una complexión, y tu avatar se genera directo de ellas (antes era obligatorio elegir categoría aunque subieras fotos, y podía contradecir lo que se veía).

### Added

- **+2 complexiones por género** para cubrir más cuerpos reales. Mujer pasa de 3 a 5 (suma **Atlética** y **Talla grande**); hombre de 4 a 6 (suma **Musculoso** y **Corpulento**). Las siluetas nuevas se generaron con el mismo estilo de las existentes.

### Fixed

- El tipo de `body_build` en el código solo listaba las complexiones de mujer, aunque las de hombre ya se guardaban — quedó atado a la fuente real para que no se vuelva a desfasar.

## [0.2.13.0] - 2026-07-23

### Added

- **"Sube varias de golpe" ahora también lee tu ropa extendida — sin ponértela.** Vacía el clóset sobre la cama, tómale unas fotos, y la IA saca cada prenda (hasta 8 por foto, antes 6): igual funciona con ropa colgada o apilada, y sigue funcionando con fotos de outfits puestos. Antes el import solo entendía fotos de una persona vestida — aunque la app ya prometía "fotos de tu ropa". Es el matador de fricción de setup que validó el análisis competitivo (aesty, wardrobe).

## [0.2.12.1] - 2026-07-23

### Fixed

- **La serif del v2 (look Bodoni) reapareciendo en redonda.** La utility `font-display` de Tailwind solo aplica la familia, no la itálica; 12 subtítulos/labels con `font-display` sin `italic` salían en serif recta (el resultado del swipe "te va limpio y elegante…", el picker de clima, y varias pantallas de onboarding). Ahora heredan la sans (Arimo). La serif se queda solo como acento itálico, como manda el design system.
- **El correo de código (OTP) traía branding viejo.** Usaba Bodoni Moda + Hanken Grotesk con el "ai" en burdeos (v2). Reescrito al v3: wordmark negro con "ai" en serif itálica, papel hueso, caja negra con el código — igual que los correos de invitación y semanal. (Aplica a los dos templates de auth; se activan al pegarlos en Supabase.)

## [0.2.12.0] - 2026-07-22

### Changed

- **El clóset precargado de mujer dejó de ser señorial.** El checklist de arranque estaba curado hacia lo clásico-oficina (falda midi, blusa de lino, cuello alto, tacón nude, mocasines, gabardina) — se sentía "monja siglo 19", sobre todo para usuarias adolescentes. Ahora es una mezcla juvenil + clásica de 33 prendas: tenis (blancos y retro), hoodie oversize, sudadera, jeans mom/wide/baggy, falda mini, cargo, shorts, crop top, top corset, mary janes, botas militares, vestido babydoll y t-shirt dress — junto a las versátiles de siempre (blusa blanca, blazer, jeans, botines, vestido negro). Las juveniles ya existían en la biblioteca pero estaban fuera del clóset de arranque; ahora cada usuaria ve variedad y marca lo suyo.

### Added

- **5 prendas juveniles de mujer** que no existían ni en la biblioteca (huecos del look Gen-Z): crop top / baby tee, jeans baggy, mary janes, botas militares y vestido babydoll.

### Fixed

- Generación de calzado: el prompt nombraba marcas ("COS/Arket") y el modelo las estampaba en la plantilla del zapato. Ahora la plantilla se pide explícitamente en blanco, sin marca ni texto.

## [0.2.11.1] - 2026-07-22

### Changed

- **Admin allowlist distingue "Ya activo".** Cada correo se cruza con los perfiles reales: quien ya entró a la app se marca "Ya activo" (verde) y pierde el botón de invitar/reenviar — así no se le manda por error un "¡Estás dentro!" a alguien que lleva semanas dentro. El encabezado suma el conteo ("29 correos invitados · 21 ya activos").

## [0.2.11.0] - 2026-07-22

### Added

- **Invitación por correo automática.** Al agregar a alguien a la allowlist desde admin, ahora le llega solo un correo con la voz de la marca y un botón que lo deja en el login con su correo **ya puesto** — un clic, pide su código de 6 dígitos y entra al onboarding. Antes agregar era mudo: nadie recibía nada y había que explicarle por WhatsApp "entra a stailist.co y haz X". El link solo pre-llena el correo (no autentica ni caduca); el código se genera fresco cuando la persona lo pide, así nada se vence antes de usarse. Cada correo en admin muestra si ya fue invitado ("Invitado el …") y trae botón para **reenviar** si se perdió o cayó en spam.

## [0.2.10.0] - 2026-07-22

### Changed

- **El motor de outfits aprendió lo que nos enseñó el deck** (motor v25, aplica a Hoy, look del día, viaje y looks de cápsula): ahora arma capas con lógica de vida real — camisa debajo, suéter encima, saco al final, y jamás combos que nadie usa (chaleco sobre suéter, saco bajo sudadera). Y cada look busca una decisión de estilista visible (una capa con intención, un contraste de texturas, un color que remata) en lugar de "top + pantalón + zapato" en automático — sin forzar piezas: lo simple bien hecho también cuenta. El juez ahora caza y repara estos combos antes de que llegues a verlos.

## [0.2.9.3] - 2026-07-22

### Changed

- **Monocromático** (hombre y mujer) pasa de gris a **negro total**. El gris-sobre-gris se veía apagado y el chaleco de lana sobre el suéter era un combo forzado; el negro tono-sobre-tono (cuello alto + pantalón + botín de piel, jugando texturas) sí entrega el "un solo tono, todo el impacto" que la carta promete.

## [0.2.9.2] - 2026-07-22

### Fixed

- Los tenis grises con suela gris de **Monocromático** (hombre y mujer) se veían irreales (nadie tiene un tenis gris hasta la suela). Ahora llevan tenis blancos limpios, y los grises del look varían de tono (carbón, gris medio, gris claro) para que se lea como estilismo tonal intencional, no un uniforme de un solo gris plano.

## [0.2.9.1] - 2026-07-22

### Fixed

- **Monocromático, Color protagonista y Tonos tierra** (hombre; + Monocromático mujer) del swipe eran el mismo molde recoloreado — crew neck + pantalón recto, cero styling. Ahora cada uno tiene decisiones reales de estilista: Monocromático juega textura con un chaleco de lana sobre knit acanalado (columna de un tono, no plano), Color protagonista pone el color como bomber statement en capa, y Tonos tierra suma un overshirt de pana con mezcla de texturas y capas.

## [0.2.9.0] - 2026-07-22

### Added

- **Nueva carta en el swipe: Coreano (K-fashion).** El fit oversized y fluido de los K-dramas — abrigo o blazer largo sobre knit, pantalón wide-leg muy holgado con caída, monocromo y tenis limpios. Está muy de moda y le faltaba al deck; entra para mujer y hombre (26 y 25 cartas). Se distingue de Monocromático por la silueta drapeada, no el tono.

## [0.2.8.2] - 2026-07-22

### Fixed

- En el deck de hombre, **Romántico, Boho y Coastal se veían casi iguales** (los tres eran camisa clara abierta + pantalón de lino). Ahora cada uno cuenta lo suyo: Romántico es knit rosa suave y pulcro, Boho es camisa estampada con collares y sandalias, y Coastal conserva su lino crudo total.

## [0.2.8.1] - 2026-07-22

### Fixed

- La carta **Color protagonista** (mujer) del swipe ya muestra lo que promete: UNA pieza de color vivo brillando sobre base neutra — antes era un conjunto azul completo que se confundía con Monocromático, y posaba de perfil escondiendo el outfit.

## [0.2.8.0] - 2026-07-22

### Added

- **Estilos de stylists con un tap:** en tu estilo de referencia ahora puedes elegir el estilo de una de nuestras stylists en lugar de subir fotos — **Carla** (statement y color: base limpia que remata con una pieza que habla) o **María** (effortless y neutros: relajado, básicos bien puestos). Un tap y tus outfits empiezan a jalar hacia ese aire; tus colores no cambian.

## [0.2.7.0] - 2026-07-22

### Changed

- **Refresh de stylist del deck de hombre (11 de 24 cartas):** los estilos clásicos se veían "de catálogo 2015" — todo slim, chinos entallados y poses de vendedor. Se re-ejecutaron con cortes actuales (relaxed, straight, wide) y calzado de hoy: académica ya no parece profesor de LinkedIn, el náutico dejó los top-siders, el romántico ya no va vestido de boda en la playa, y utility/gorpcore tienen proporciones de moda, no de expedición.

## [0.2.6.0] - 2026-07-22

### Changed

- **Refresh completo del deck de mujer (25 cartas):** pasada de stylist experto sobre cada look. Los estilos que se veían "de señora" (romántico, academia, tonos tierra, gorpcore, utility, náutico, boho, clásico elegante) se re-ejecutaron en su versión actual — mismas estéticas, otra década. Y ahora **cada carta tiene su propio peinado** pensado para el estilo: chongo pulido para minimalista, coleta slicked para utility, claw clip para coastal, trenzas finas para boho… porque el peinado también es styling.

## [0.2.5.0] - 2026-07-22

### Added

- **Tu edad, un tap:** después de elegir tu clóset (mujer/hombre) te preguntamos tu rango de edad. Con eso los looks, tu cápsula y hasta el nombre de tu estilo hablan tu momento de vida — a una adolescente no le sugerimos looks "de oficina", y a los 55+ priorizamos elegancia cómoda. Si ya usabas la app, la verás una sola vez al volver.
- **Permiso de papás para menores:** si tienes 13-17, pedimos el correo de tu papá, mamá o tutor y le mandamos un link donde ve exactamente qué guarda la app y da su permiso en un clic. Mientras confirma puedes explorar todo; subir fotos (tuyas o de tu ropa) se desbloquea con su OK. Desde tu Perfil puedes reenviarle el correo o mandarle el link por WhatsApp.

### Changed

- **La espera del look ahora te cuenta qué está pasando:** en lugar de una frase repetida, verás pasos reales — "revisando tus 18 prendas…", "checando el clima de hoy: 24°…", "descartando lo que no combina contigo…". La misma espera, mucho menos eterna.

### Security

- El permiso parental quedó blindado de verdad: las columnas del consentimiento solo se escriben desde el servidor, un menor sin permiso no puede subir fotos ni por la puerta trasera, el link del tutor tiene validación estricta y límite de intentos, y los reenvíos de correo tienen cooldown de 10 minutos.

## [0.2.4.0] - 2026-07-22

### Changed

- El swipe de estilos ahora cubre mejor la variedad: entran **Academia** (tweed, aire intelectual) y **Coastal** (lino, clean-girl) en lugar de "Startup" y "Finance bro", que eran muy parecidos a otros y muy masculinos. Sigues viendo el mismo número de cartas, pero con más balance para todos los estilos.

## [0.2.3.0] - 2026-07-22

### Added

- Justo después de ponerte tu primer look, te ofrezco (opcional) **afinar aún más tu estilo con una foto**: ¿te encanta cómo se viste alguien? Súbela y jalo tus outfits hacia ese estilo, con un veredicto honesto de si te va (tus colores no cambian). Antes esto vivía escondido en Perfil y casi nadie lo encontraba; ahora aparece en el momento justo. Puedes saltarlo con «entrar a la app».

## [0.2.2.0] - 2026-07-22

### Added

- Ahora puedes decirle a cada look **si te late o no** con un 👍 / 👎 de un tap, en el momento en que lo ves. Un tap, sin bloquear nada. Si le das 👎, te pregunto rápido qué no te lató (opcional) para afinar tu estilo de verdad — sin obligarte a generar otro.
- Al día siguiente, tu pantalla de inicio te pregunta por el look de ayer: **«¿te lo pusiste?»** con un sí / no. El «sí» es la señal más valiosa que me puedes dar (que algo salió a la calle de verdad), y el «no» simplemente cierra la pregunta, sin dramas.
- Justo después de descubrir tu estilo en el swipe, te hago **2-3 preguntas cortas hechas a tu medida** para afinarlo (ej. si eres minimalista, hacia qué cortes o tejidos te jala). Se preparan solas mientras ves tu resultado, así que casi nunca esperas; si no están listas, sigues directo a tus colores. Puedes saltarlas con «luego».

### Changed

- El 👍 a un look vuelve a ofrecerte instalar la app (estaba pensado para ese momento y se había quedado sin disparador).

### Changed

- El "qué ya tienes" de tu cápsula ahora **distingue prendas que antes veía iguales**: al cruzar tu clóset con la cápsula ideal, mira el material, el estampado, el corte y la temporada de cada prenda, no solo su nombre y color. Un suéter fino de verano ya no cuenta como "ya lo tienes" cuando tu ideal pedía uno de lana para el frío (o al revés): sale como "parecido", que es lo honesto. Los básicos que sí calzan siguen contando como tuyos.

### Fixed

- Si corriges el color (o el material, el estampado…) de una prenda, tu cápsula **vuelve a calcular qué tienes**. Antes ese cálculo se quedaba con el dato viejo en silencio, justo el que decide si una prenda cuenta como tuya o solo parecida. La primera vez que abras tu cápsula tras esta actualización, te va a ofrecer recalcular una vez para tomar la señal nueva.

## [0.2.0.0] - 2026-07-21

### Added

- **"Tu estilo en tus palabras"** (Perfil → estilo): un espacio para contarme cómo te gusta vestir, con tus palabras. Es la señal más directa que me puedes dar — la uso en cada look, en tu cápsula y al armar tu maleta. Si la editas, la app te ofrece regenerar tu cápsula para que la tome en cuenta.
- La maleta de un viaje ahora **empaca lo que tus días piden, no el mínimo**: un piso de suficiencia calculado por días y planes (más tops si hay noches, mínimo de bottoms y calzado) que el motor debe cumplir. Con maleta documentada ya no recorta "por espacio". Antes: 4 tops para 5 días con salidas de noche; ahora sale completo.
- Cada ocasión de tu viaje (día, noche, traslado…) recibe **al menos un look** — ya no puede quedarse un día del viaje sin propuesta. Excepción respetada: un look con algo que vetaste jamás se muestra, ni para llenar el hueco.
- Ya puedes **borrar looks** (desde el detalle de un look, en Historial) y **borrar viajes** (desde el detalle del viaje). Los looks que hayas guardado de un viaje se quedan en tu historial aunque borres el viaje.
- Borrar una prenda ahora **te pregunta antes**. Ya se podía quitar prendas, pero lo hacía al instante: un toque de más y desaparecía sin avisar.

### Changed

- El motor de looks ahora **sabe si eres mujer u hombre desde la primera pasada**: escribe en tu género y juzga con criterio de moda del guardarropa correcto (antes solo el juez lo sabía). Se sumaron reglas de estilismo para vestido y falda (largo contra calzado, cintura) que no existían.
- El quiz de la cápsula habla tu género: "No estoy segura" y ejemplos con blusa/blazer para mujer (antes decía "No estoy seguro" y "una camisa o un saco" para todas).
- Tus **vetos, tu estilo de referencia, tus palabras y tu feedback real** (👍/👎, "me lo puse") ahora llegan a TODOS los motores — viaje incluido, que antes generaba sin saber ni tus vetos.
- Los gustos del swipe se calibraron: un ❤️ suelto a un estilo raro ya no le gana a una preferencia consistente, y los motores reciben tus tags en orden de fuerza. Las claves de estilo de tus fotos de referencia también entran al motor (se guardaban y no se usaban).
- Al leer una foto de prenda, la IA ahora **conoce ropa de mujer** (blusa, falda, vestido, tacones, bolsa) y calibra mejor la formalidad: una camisa o blusa del diario ya no sale marcada "formal" por default.
- Nada de lo que borras se borra de verdad: lo que quitas se oculta de la app pero se conserva por dentro, así que es recuperable y no se pierde para medir el experimento.

### Fixed

- Las camisas y blusas detectadas como "formal" sin serlo: la formalidad ahora se reserva para sastrería y prendas de evento; ante la duda queda "formal-casual".
- El juez de looks sin género definido caía a la rúbrica masculina; ahora usa una neutra.

## [0.1.4.1] - 2026-07-21

### Fixed

- La hoja de "Más" (y la de agregar al clóset) no se podía cerrar tocando fuera: había que elegir una opción sí o sí. El fondo tampoco se oscurecía. Ahora se cierran tocando fuera, con la tecla Escape o con el asa de arriba, y el fondo se atenúa como debe.

## [0.1.4.0] - 2026-07-21

### Added

- El home de "Hoy" ya no se siente vacío antes de armar tu look: te recibe con **una** nota de contexto, la que aplique. Si andas de viaje (o sales en menos de una semana) te apunta a tu maleta; si subiste ropa que no te has puesto, te propone estrenarla — y al tocarla abre el armado del look con esa prenda ya elegida; si no, te recuerda qué armaste ayer. Si no hay nada que contar, la pantalla se queda como estaba.
- **"Añadir prendas"** aparece como acción secundaria bajo el botón de armar tu look: era la segunda cosa que más se hace y vivía a dos o tres taps dentro del Clóset.
- Nueva pestaña **"Más"** en la barra de abajo: reúne añadir prendas, armar maleta y **modo tienda** (chequear si un color te va, que estaba a cuatro taps escondido dentro de Perfil), más tus viajes y tu cartera de colores. Cuando tienes un viaje cerca, la maleta encabeza la lista y el botón se marca con un punto.

### Changed

- La barra de abajo pasó a ser Hoy · Clóset · ✦ · Historial · Más. Viaje soltó su pestaña y se mudó adentro de "Más", donde muestra a dónde vas y cuánto falta.

## [0.1.3.2] - 2026-07-02

### Changed

- El botón para generar la imagen de una prenda sugerida ahora dice "ver la prenda" en todas partes (antes era "ver cómo queda" en unos lados y "ver" en otros): consistente, y describe lo que hace de verdad — generar la imagen del producto, no un try-on.

## [0.1.3.1] - 2026-07-02

### Fixed

- En el Clóset Cápsula, si generabas la imagen de una prenda sugerida y luego elegías "la sugerida" (o marcabas "ya la tengo"), el recuadro volvía a salir vacío con "ver cómo queda" en vez de mostrar la imagen que acababas de generar. Ahora la imagen se conserva mientras estés en la pantalla.

## [0.1.3.0] - 2026-07-02

### Added

- Nueva pantalla de admin **Waitlist**: quién pidió entrar a la beta desde la landing, de dónde llegó y cuándo, con un botón para invitarlo (agregarlo a la allowlist) con un clic. Marca "ya invitado" a quienes ya tienen acceso.

## [0.1.2.1] - 2026-07-01

### Fixed

- En el Clóset Cápsula, al elegir "la sugerida" sobre la que ya tienes, la tarjeta mostraba la imagen de tu prenda en vez de la sugerida.
- La tarjeta de una prenda que decidiste cubrir con algo tuyo ahora lidera con TU prenda ("Tu Blazer marino · cubre el hueco de…"), no con el nombre de la ideal — antes la palomita se leía como si hubieras elegido la ideal.

## [0.1.2.0] - 2026-07-01

### Added

- Las prendas que ya estaban en los clósets ahora también tienen material y patrón (re-análisis en lote de las 415 prendas existentes) — el motor v21 juzga todos los clósets con señal completa, no solo las prendas nuevas.
- El material, el patrón y el segundo color de una prenda fotografiada se pueden corregir desde su hoja de detalle — una mala lectura de la IA ya no es permanente.
- La evaluación honesta de tu estilo de referencia ("es muy cálido para ti — llévalo a tus tonos") ahora sí guía al motor al generar looks y cápsulas; antes solo se mostraba una vez y se perdía (motor v22).
- Tu complexión se define UNA sola vez: si ya elegiste tu silueta, el avatar la usa sin volver a preguntarte; y si creas el avatar primero, tu respuesta llena la silueta.
- Avatares más fieles: el wizard acepta hasta 5 fotos (2 de cara + 3 de cuerpo, con guía de qué foto ayuda), y un juez automático compara el avatar con tu selfie — si no se parece, se regenera solo antes de mostrártelo.

## [0.1.1.0] - 2026-07-01

### Added

- El análisis de foto ahora detecta el material de la tela, el estampado y el segundo color de las prendas bicolor — el motor los usa para no combinar dos estampados que pelean ni sugerir lana en calor (motor v21).
- El motor de outfits, la cápsula ideal y la cápsula de viaje "piensan antes de responder": planean neutros, acentos y descartes en un borrador interno antes de comprometer las prendas — mejores combinaciones sin cambio visible en la app.
- Los looks de viaje ahora respetan tu colorimetría (nada de tus colores EVITA cerca de la cara), igual que los de Hoy.

### Changed

- Los jueces de styling (Hoy y Viaje) corren en Claude Sonnet 5, con presupuestos de salida re-calibrados para su tokenizer.
- Los looks de viaje se arman con los datos de TU prenda real (color, hex, material, temporada), no con los de la prenda ideal de la cápsula.

### Fixed

- En maletas grandes, ya ninguna prenda empacada se queda sin aparecer en al menos una combinación sugerida ("la app ignoró mi vestido").
- Si dos prendas del clóset comparten nombre, el motor de viaje ya no toma los datos de la equivocada — prefiere no adivinar.
- Perfiles con colorimetría legacy (estación con mayúscula) ya no rompen la generación de looks de viaje.
- El análisis de varias prendas en una foto ya no arriesga cortarse a la mitad (presupuesto de salida ampliado), y todas las generaciones distinguen un corte por límite de tokens de un error real.
- Los atributos que llegan del análisis de visión se validan y acotan antes de guardarse y antes de entrar a los prompts del motor.
