// Qué foto le toca a un viaje. Lógica PURA (sin DB ni IA): el set de imágenes
// es fijo (public/destinos, generado con scripts/gen-destinos.mjs) y aquí solo
// se decide cuál.
//
// El orden de las preguntas importa, y es de más específico a más seguro:
//   1. ¿El nombre del lugar es uno de los destinos que tienen foto propia?
//   2. Si no, ¿marcó "playa" entre las ocasiones del viaje? → la playa genérica.
//   3. Si no, la ciudad genérica.
//
// Nunca hay "sin imagen": el paso 3 siempre contesta. Y nunca se ADIVINA con
// IA en vivo — un destino mal reconocido en la card se ve todos los días.

/** Los destinos con foto propia y cómo los escribe la gente.
 *
 *  Los alias no son sinónimos de diccionario: son lo que de verdad teclea o
 *  devuelve el geocoder de Open-Meteo (que ya recorta a la primera coma, así
 *  que llega "Cancún", no "Cancún, Quintana Roo").
 *
 *  `exactos` son alias que SOLO valen como nombre completo del lugar, nunca
 *  como palabra suelta dentro de otro nombre. Existe por un caso real de este
 *  país: "Roma" es Italia, pero "Roma Norte" y "Roma Sur" son colonias de la
 *  CDMX — con match por palabra, un viaje a Roma Norte enseñaba el Coliseo
 *  todos los días. (El comentario de este archivo llegó a afirmar que la
 *  palabra completa ya lo cubría; no lo hacía: `(^| )roma( |$)` casa dentro de
 *  "roma norte". Lo cazó la auditoría de cobertura del ship.) */
const DESTINOS: { slug: string; alias: string[]; exactos?: string[] }[] = [
  // Los destinos de playa NO llevan foto propia: visualmente son la misma
  // imagen, y una palmera en Cancún es la palmera de Vallarta. Todos aquí.
  {
    slug: "playa",
    alias: [
      "playa", "cancun", "tulum", "playa del carmen", "riviera maya", "cozumel",
      "isla mujeres", "holbox", "los cabos", "cabo san lucas", "san jose del cabo",
      "puerto vallarta", "vallarta", "nuevo vallarta", "acapulco", "mazatlan",
      "huatulco", "ixtapa", "zihuatanejo", "puerto escondido", "sayulita",
      "punta cana", "cartagena", "punta mita", "maui", "honolulu", "bali",
      "ibiza", "mykonos", "santorini", "phuket", "tuxpan", "veracruz",
    ],
  },
  // México
  { slug: "cdmx", alias: ["cdmx", "ciudad de mexico", "mexico city", "df", "distrito federal"] },
  { slug: "guadalajara", alias: ["guadalajara", "gdl", "zapopan", "tlaquepaque"] },
  { slug: "monterrey", alias: ["monterrey", "mty", "san pedro garza garcia"] },
  { slug: "oaxaca", alias: ["oaxaca", "oaxaca de juarez"] },
  { slug: "san-miguel", alias: ["san miguel de allende", "san miguel"] },
  // Internacional
  { slug: "nueva-york", alias: ["nueva york", "new york", "nyc", "manhattan", "brooklyn"] },
  { slug: "los-angeles", alias: ["los angeles", "hollywood", "santa monica", "beverly hills"] },
  { slug: "las-vegas", alias: ["las vegas", "vegas"] },
  { slug: "miami", alias: ["miami", "miami beach", "south beach"] },
  { slug: "madrid", alias: ["madrid"] },
  { slug: "barcelona", alias: ["barcelona", "bcn"] },
  { slug: "paris", alias: ["paris"] },
  { slug: "londres", alias: ["londres", "london"] },
  // "roma" va como exacto: ver la nota de `exactos` arriba (Roma Norte/Sur).
  { slug: "roma", alias: ["rome"], exactos: ["roma"] },
  { slug: "amsterdam", alias: ["amsterdam"] },
  { slug: "tokio", alias: ["tokio", "tokyo"] },
  { slug: "buenos-aires", alias: ["buenos aires", "baires"] },
];

/** minúsculas, sin acentos y sin puntuación: "Cancún" y "cancun" son el mismo
 *  lugar, y el geocoder no siempre acentúa igual que la persona. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** La primera parada de una ruta, solo el nombre del lugar ("París · Roma" →
 *  "París"; "Roma, Lacio, Italia" → "Roma"). Es la que nombra el viaje y la
 *  que decide su foto — la regla vieja de este archivo, ahora con nombre. */
export function primeraParada(lugar: string): string {
  return lugar.split("·")[0].split(",")[0].trim();
}

/**
 * El slug del destino para la caché de imágenes generadas (destino_imagenes):
 * la primera parada, normalizada, espacios → guión. "Osaka, Japón" → "osaka".
 *
 * LA COLISIÓN CONOCIDA, aceptada a propósito: dos lugares con el mismo nombre
 * comparten slug (la Córdoba de Argentina y la de España tendrían UNA foto).
 * Es el mismo trato que ya da el catálogo estático por alias, y resolverlo
 * pediría país + coordenadas por una esquina que casi no pasa.
 */
export function slugDestino(lugar: string): string {
  return normalizar(primeraParada(lugar)).replace(/\s+/g, "-") || "destino";
}

/** ¿`frase` contiene `alias` como secuencia de palabras completas? Sin RegExp:
 *  el alias es dato de una tabla, no un patrón. */
function contienePalabras(frase: string, alias: string): boolean {
  const t = frase.split(" ");
  const a = alias.split(" ");
  for (let i = 0; i + a.length <= t.length; i++) {
    if (a.every((w, j) => t[i + j] === w)) return true;
  }
  return false;
}

/**
 * La foto del CATÁLOGO estático para este lugar, o null si el catálogo no lo
 * conoce. El null es información: es la señal de "este destino es de la cola
 * larga" con la que se decide generar una foto propia (destino_imagenes).
 */
export function imagenCatalogo(lugar: string): string | null {
  // De la primera parada, solo el nombre del lugar: el geocoder devuelve
  // "Roma, Lacio, Italia" y quien lo guarda ya recorta en la coma, pero
  // recortar aquí también hace que la función no dependa de eso (y es lo que
  // deja funcionar el match exacto, que compara el nombre COMPLETO).
  const texto = normalizar(primeraParada(lugar));

  for (const destino of DESTINOS) {
    // Exactos primero: el nombre completo y nada más (ver `exactos` arriba).
    if (destino.exactos?.includes(texto)) return `/destinos/${destino.slug}.webp`;
    // El resto casa por palabra completa, no por substring: así "Romania" no
    // trae el Coliseo ni "Cancunito" la playa. Se compara sobre tokens en vez
    // de armar un RegExp con el alias dentro: hoy todos los alias son [a-z ],
    // pero el día que alguien agregue "washington d.c." o "são paulo (sp)" un
    // alias interpolado sin escapar rompería la expresión —`(` es sintaxis— y
    // eso truena EN EL RENDER de un server component: 500 en /hoy por editar
    // una tabla de datos.
    if (destino.alias.some((a) => contienePalabras(texto, a))) {
      return `/destinos/${destino.slug}.webp`;
    }
  }
  return null;
}

/** El fallback cuando no hay ni catálogo ni foto generada: manda lo que la
 *  persona YA nos dijo del viaje (playa vs ciudad). Es dato suyo, no una
 *  suposición nuestra. */
export function imagenGenerica(ocasiones: string[] = []): string {
  return ocasiones.includes("playa") ? "/destinos/playa.webp" : "/destinos/ciudad.webp";
}

/**
 * La imagen del destino, lista para usar en un `src`.
 *
 * `lugar` puede venir como ruta multidestino ("París · Roma"): gana la PRIMERA
 * parada, que es a donde llegas y con lo que la persona nombra el viaje.
 *
 * Esta es la versión SÍNCRONA y sin base de datos (la usa la card del home,
 * que es client component). La versión con caché de fotos generadas vive en
 * lib/destino-imagen-cache (server-only).
 */
export function imagenDestino(lugar: string, ocasiones: string[] = []): string {
  return imagenCatalogo(lugar) ?? imagenGenerica(ocasiones);
}
