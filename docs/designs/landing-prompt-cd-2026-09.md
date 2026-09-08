# Prompt para Claude Design — tres secciones nuevas de la landing (2026-09-07)

Copiar desde la línea siguiente hasta el final.

---

Diseña tres bloques nuevos para la landing de **stailist** (stailist.co), una app móvil de stylist personal con IA que arma outfits con la ropa que la persona ya tiene. La landing ya existe y está en producción; NO la rediseñes. Tu trabajo es diseñar tres piezas que se integren en ella sin que se note que llegaron después, en móvil primero y luego desktop.

## Qué es el producto y para quién

Usuaria objetivo: mujer de 25 a 35 con el clóset lleno y "no tengo qué ponerme", compras que no combinan y pánico de eventos. La app arma 2-3 looks con su ropa real, explicados en una línea, y se los prueba puestos en su avatar. El enemigo del producto NO es "combinar ropa": es la fricción de catalogar el clóset, que es lo que mata a todas las apps de este tipo. Nada en la página puede oler a "sube tu clóset prenda por prenda".

## Voz (manda sobre todo el copy)

"Tu amiga cool que se viste increíble". Tuteo, cálida, directa, frases cortas, cero jerga de moda ("los tonos tierra te encienden la cara", nunca "eres otoño profundo"). La app habla en primera persona: "te armo", "te pruebo", "aprendo de ti". Todo en español de México, minúsculas en títulos salvo inicio de frase. Prohibido: prometer "primer outfit en 2 minutos" (se retiró a propósito), prueba social inventada (testimonios, cifras de usuarias), calificar con números o notas, la palabra "error", nada que suene a juzgar el cuerpo.

## Sistema de diseño (úsalo tal cual, no inventes tokens)

Dirección "Gen-Z monocromo": blanco y negro, sans grande y limpia estilo Mango, serif sólo como acento mínimo.

- Fondo `#F4F3F1` (papel neutro) · superficie `#FFFFFF` · texto `#141414` · cuerpo `#363636` · secundario `#6F6F6F` · terciario `#9A9A9A` · hairlines `#E4E3E0` y `#EFEEEC` · fondo de celda de prenda `#F7F6F4` · acento = tinta `#0A0A0A` (CTAs, énfasis).
- Sin ningún otro color. Vetado explícitamente: ámbar, terracota, naranja, cualquier acento cálido.
- Tipografía: **Arimo** para todo (títulos h1-h3 en 700, letter-spacing -0.025em; cuerpo 400). **Instrument Serif itálica** SOLO como acento: una palabra dentro de un título, nunca párrafos, nunca UI, nunca menor de 18px.
- Radios crispados, NO pastillas: 3px botones/chips, 4px tiles de prenda, 6px cards. Sombras casi nulas; la separación la hacen las hairlines.
- Espaciado en escala 4/8/12/16/24/32/48/64.
- La única superficie oscura del producto es el try-on (foto sobre negro con degradado a `rgb(20 20 20 / 0.72)`).

## Cómo está construida la landing hoy (para que encajes)

Nueve secciones numeradas, cada una con este patrón: un "kicker" pequeño con número y nombre ("07 Y se queda contigo"), un h2 grande en Arimo bold con una palabra en serif itálica, y debajo uno de tres cuerpos:

1. **Pasos** ("02 Cómo funciona"): número grande a la izquierda, h3 + párrafo, y un visual a la derecha (en móvil, debajo). Los visuales son composiciones editoriales con fotos de prendas sobre fondo `#F7F6F4`, sin mockups de teléfono.
2. **Lista de rasgos** ("07"): dos o tres bloques en columnas, cada uno con una letra (A, B, C) en serif, h3 corto que termina en punto y un párrafo de dos líneas.
3. **Objeción**: una pregunta entre comillas en serif grande, y la respuesta que arranca con un "No." en bold.

Las secciones actuales, en orden: 01 el verdadero problema · 02 cómo funciona (4 pasos: quién eres, marcas lo que tienes, qué necesitas hoy, te armo y te pruebo) · 03 por qué te quedan (gusto, colorimetría, silueta) · 04 te lo pruebo (try-on) · galería · objeción "¿tengo que subir foto de cada prenda?" · 05 tus esenciales · 06 modo viaje · 07 y se queda contigo (A: tu look de hoy, B: aprendo de ti) · 08 para quién es · 09 tu turno.

## Las tres piezas a diseñar

### 1. Fit check (nuevo bloque C en la sección 07)

**Qué hace en la app:** la persona se pone el look, le toma una foto en el espejo y la sube. La app le contesta en segundos con tres cosas: un resumen de cómo se ve, qué le hacen a su cara los colores que trae cerca del rostro, y UN solo ajuste concreto que puede hacer ahora mismo sin cambiarse ("fájate la camisa", "arremángate una vez, no dos", "cambia el zapato"). Si el look no sirve para donde va, ese es el ajuste. Nunca califica con números, nunca habla del cuerpo, nunca sugiere comprar.

**Por qué importa:** cierra el ciclo. Todo lo demás pasa en la pantalla; esto pasa cuando ya está vestida y a punto de salir. Es la función que convierte a la app en la amiga que te dice "así sí" antes de cruzar la puerta.

**Dónde va:** tercer bloque de "07 Y se queda contigo", junto a "Tu look de hoy" y "Aprendo de ti". La sección pasa de dos columnas a tres.

**Copy sugerido (ajústalo si encuentras mejor, sin salirte de la voz):**
- h3: "Te digo cómo se ve."
- párrafo: "Te pones el look, me mandas la foto del espejo y te contesto: qué funciona y la única cosa que cambiaría. Sin filtros."

**Visual:** si añades uno, que sea una foto de espejo recortada con la respuesta encima en una tarjeta blanca pequeña de una sola línea de ajuste. Nada de estrellas, puntajes ni check verde.

### 2. Varias prendas en una foto (corrige el paso 2 de "02" y la objeción)

**Qué hace en la app:** la única forma de subir ropa propia es "el carrete": una sola foto de tu clóset abierto, de la cama con ropa encima o de ti vestida, y la IA separa cada prenda, la lee (tipo, color, material, corte) y la deja como tarjetas editables para confirmar con un toque. Un tercio de todas las prendas que existen en la base entraron así. La landing hoy dice lo contrario ("le tomas una foto a esa prenda especial", "¿tengo que subir foto de cada prenda?"), que suena a una foto por prenda.

**Por qué importa:** es la respuesta real a la fricción que mata a la competencia. Hay que decirlo donde la persona se hace la pregunta, no después del try-on.

**Dónde va:** (a) reescribir el párrafo del paso 2 de "02 Cómo funciona" y su visual; (b) reescribir la respuesta del bloque de objeción y, si cabe, moverlo justo después de la sección 02.

**Copy sugerido:**
- Paso 2, h3 se queda: "Marcas lo que ya tienes."
- Paso 2, párrafo: "Eliges tus básicos con un toque. Y para lo demás, una foto de tu clóset abierto: yo saco las prendas por ti, no una por una."
- Objeción, pregunta: "¿Tengo que subir foto de cada prenda?"
- Objeción, respuesta: "No. Arrancas marcando básicos que casi todo el mundo tiene. Y cuando quieras meter tu ropa de verdad, una sola foto del clóset basta: separo cada prenda y tú confirmas. Opcional, nunca obligatorio."

**Visual del paso 2:** a la izquierda una foto de clóset abierto o cama con ropa; a la derecha (o debajo en móvil) cuatro o cinco tiles de prenda recortadas sobre `#F7F6F4` con una línea fina que las une a la foto. La idea es "de una foto salen estas". Sin flechas gruesas ni iconos de IA.

### 3. Looks por adelantado (nuevo, entre "02" y "03", o como bloque C del paso 3)

**Qué hace en la app:** el paso "me dices qué necesitas hoy" vende sólo el día. La app planea cualquier día: eliges la ocasión (oficina, día normal, un evento, una cita, una boda), el día y a qué hora te vistes, y te arma el look con el clima real de ese día y esa hora, con días de anticipación. También pregunta detalles que cambian el look: si la lluvia te toca, si ves cliente, dónde es.

**Por qué importa:** la sección "08 Para quién es" dice "te estresan los eventos y las mañanas con prisa" y nunca lo resuelve. Esto lo resuelve: la boda del sábado se decide el martes, con calma.

**Dónde va:** la opción más limpia es ampliar el paso 3 de "02" para que diga "hoy o el sábado", con un visual de chips de ocasión más un selector de día. La otra es un bloque corto propio entre 02 y 03. Elige una y justifícala en una línea.

**Copy sugerido:**
- h3: "Me dices qué necesitas. Hoy o el sábado."
- párrafo: "¿Junta mañana? ¿Boda el sábado? Un toque y te lo armo desde ya, con el clima de ese día y esa hora. Lo único que cambia cada vez."

**Visual:** los chips de ocasión que ya existen en la landing ("oficina", "de día", "un evento", "una cita") más una fila de días de la semana con uno marcado en tinta. Sin calendario completo.

## Entregable

Para cada una de las tres piezas: versión móvil (375 px) y desktop (1280 px), con el copy final escrito, usando sólo los tokens de arriba, y una nota de una línea de dónde se inserta en la landing actual. Si necesitas un color, tamaño o fuente que no esté en la lista, no lo inventes: dilo y propón la alternativa con lo que hay.
