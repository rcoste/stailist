# Changelog

Cambios notables de stailist. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/); versiones `MAJOR.MINOR.PATCH.MICRO`.

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
