# Changelog

Cambios notables de stailist. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/); versiones `MAJOR.MINOR.PATCH.MICRO`.

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
