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
 * Leer una prenda en una foto: color, tipo, material, patrón.
 *
 * Parece "solo percibir" y por eso el primer reparto la bajaba a Sonnet. Se
 * queda arriba por dos razones. Una: un color mal leído NO se queda ahí — se
 * propaga a cada look que se arme con esa prenda, y la persona nunca sabe por
 * qué sus outfits se sienten raros. Dos, y decisiva: Roberto sobre la versión
 * que ya existía — "subía una imagen y detectaba, ah, este lente, playera tal;
 * lo hacía muy, muy bien". Cuando algo ya funciona bien, la carga de la prueba
 * la tiene el cambio.
 */
export const VISION_MODEL = "claude-opus-5";

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
