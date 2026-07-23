# Changelog

Cambios notables de stailist. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/); versiones `MAJOR.MINOR.PATCH.MICRO`.

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
