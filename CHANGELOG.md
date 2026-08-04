# Changelog

Cambios notables de stailist. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/); versiones `MAJOR.MINOR.PATCH.MICRO`.

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
