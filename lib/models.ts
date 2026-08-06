// Los modelos de IA que usa stailist, en UN solo lugar y repartidos por TAREA.
//
// POR QUÉ EXISTE ESTE ARCHIVO
// El nombre del modelo estaba escrito a mano en 14 archivos de producción y 5
// scripts. Cambiar de generación obligaba a cazarlos uno por uno, y basta que
// uno se quede atrás para que una parte del producto corra en un modelo viejo
// sin que nadie se entere — no truena nada, solo empeora en silencio.
//
// POR QUÉ REPARTIDOS Y NO TODO EN EL MÁS CARO
// Hasta hoy TODO corría en Opus (salvo los jueces): no era una decisión, era el
// default. Roberto: "poner Opus 5 en todo es un overkill; hay cosas para las que
// sí hace sentido y otras para las que no". Tiene razón — leer las ciudades de un
// screenshot de vuelo no pide el mismo modelo que armarle a alguien lo que se va
// a poner.
//
// EL CRITERIO: qué pasa si el modelo se equivoca.
// - Si el error se VE en el producto (un outfit que no combina, una cápsula que
//   no sirve) → el modelo bueno.
// - Si el error es corregible por la persona en la misma pantalla (un dato mal
//   leído que confirma o edita) o la tarea tiene las reglas ya escritas en el
//   prompt → el modelo rápido.
// - Si el error se PROPAGA en silencio a todo lo demás → el modelo bueno, aunque
//   la tarea parezca sencilla. Es el caso de leer una prenda de una foto.

/**
 * Criterio de styling: armar outfits, inventar la cápsula ideal, resolver la
 * maleta. Es donde se decide si el producto sirve.
 *
 * OJO con la latencia: en los modelos 5 el thinking adaptativo viene ENCENDIDO
 * por default y en el motor cuesta ~50% (32s contra 21s, medido sobre un clóset
 * de 127 prendas). Quien corra dentro del límite de 60s de Vercel tiene que
 * apagarlo — el schema ya obliga a razonar en un campo antes de comprometer la
 * respuesta, que es la misma idea con el costo dentro del presupuesto.
 */
export const ENGINE_MODEL = "claude-opus-5";

/**
 * Leer una prenda en una foto: color, tipo, material, patrón, tipo fino.
 *
 * ES EL ÚNICO QUE NO ES DE ANTHROPIC, y no fue una corazonada: lo ganó midiendo.
 * Cinco fotos reales del clóset de Roberto (persona vestida, de traje, de gym,
 * con abrigo), once modelos leyendo LA MISMA foto con ESTE MISMO prompt, y
 * Roberto calificando a ciegas prenda por prenda — sin saber qué columna era
 * cuál. Resultado en docs/decisiones/vision-2026-08-05.md.
 *
 *     modelo                  errores/foto   30 fotos   tiempo
 *     Gemini 3.5 Flash            0.60        $0.24       3.5s
 *     Gemini 3.1 Flash-Lite       0.80        $0.05       2.6s   <- éste
 *     Opus 5 (lo anterior)        0.80        $1.37      16.6s
 *     Sonnet 5                    0.80        $0.52      13.5s
 *     Haiku 4.5                   2.20        $0.19       9.4s
 *
 * Empata con Opus en errores, cuesta 27 VECES MENOS y es 6 veces más rápido.
 * Gemini 3.5 Flash acertó un poco más (0.6 contra 0.8) pero cuesta 5 veces más:
 * la diferencia es 0.2 errores por foto, que no paga esa multiplicación.
 *
 * Y lo que de verdad decidió: OPUS FUE EL ÚNICO QUE INVENTÓ UNA PRENDA. Es el
 * error que la persona no puede detectar — se guarda con su render limpio, se
 * ve igual de real que las demás, y sólo aparece semanas después dentro de un
 * outfit. A Roberto le tomó dos meses cazar tres. Mistral Small inventó dos y
 * quedó fuera pese a ser el más barato de los once.
 *
 * SIGUE SIENDO EL MODELO BUENO PARA SU TAREA, que es el criterio de este
 * archivo: un color mal leído NO se queda ahí, se propaga a cada look que use
 * esa prenda. Lo que cambió es qué modelo es "el bueno" aquí, no la regla.
 *
 * PARA CUANDO SALGA UNO NUEVO: no lo cambies de oído. Corre /admin/comparador
 * contra éste — la pantalla existe justo para eso y la corrida entera costó
 * $0.48.
 */
export const VISION_MODEL = {
  proveedor: "gemini" as const,
  id: "gemini-3.1-flash-lite",
  etiqueta: "Gemini 3.1 Flash-Lite",
};

/**
 * Los jueces de styling (Hoy y Viaje). Corren UNA VEZ POR OUTFIT y dentro del
 * límite de 60s de Vercel, así que la latencia pesa tanto como el criterio.
 *
 * OJO: en los modelos 5 el thinking viene ON por default — cada llamada de juez
 * lo apaga explícitamente.
 */
export const JUDGE_MODEL = "claude-sonnet-5";

/**
 * Clasificar contra reglas YA ESCRITAS y redactar textos cortos: emparejar una
 * prenda de la cápsula con una del clóset, buscar sustitutos, ponerle nombre a
 * un estilo, escribir dos preguntas.
 *
 * Aquí el prompt ya trae el criterio (el match de cápsula lleva seis reglas
 * numeradas): el modelo aplica, no decide. Y lo que sale es confirmable por la
 * persona en la misma pantalla.
 */
export const CLASSIFY_MODEL = "claude-sonnet-5";

/**
 * Sacar datos de un screenshot: las ciudades y fechas de un itinerario de vuelo.
 *
 * Es lo más cercano a OCR que hay en el producto, y el resultado cae en un
 * wizard que la persona confirma o corrige antes de que se use para nada.
 */
export const EXTRACT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Chequeos baratos de "¿esto está obviamente mal?": si el avatar generado se
 * parece a la foto, si la prenda que la persona ancló pega con la ocasión.
 *
 * Los dos ya corrían en Haiku antes de este reparto — fue la única decisión de
 * modelo tomada a conciencia en el proyecto, y es la correcta: son guardas que
 * fallan HACIA ADELANTE (si no hay respuesta, se deja pasar), así que un error
 * aquí no rompe nada, solo deja pasar algo que otro filtro debería cazar.
 */
export const GUARD_MODEL = "claude-haiku-4-5-20251001";
