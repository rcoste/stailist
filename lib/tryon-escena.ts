// DÓNDE SE TOMA LA FOTO DEL TRY-ON (2026-09-16).
//
// Hasta aquí el try-on tenía una sola escena: "plain flat light-grey wall". Es
// la constante que el mazo de swipes de hombre ABANDONÓ el 2026-08-03 porque
// "se lee como catálogo" (scripts/gen-looks-hombre-v4.mjs, punto 1) — y el
// try-on nunca recibió el cambio. Roberto, viéndose con un look: "el fondo es
// muy sencillo, la pose muy estándar, se siente maniquí".
//
// La escena sale de lo que la persona dijo que iba a hacer, en este orden:
//   1. el PLAN escrito ("comida con la familia", "cine") — es lo único que dice
//      a dónde va: 149 de los looks de producción tienen occasion = "diario"
//      aunque su plan diga "cita médica" o "cumpleaños";
//   2. la OCASIÓN del look (oficina, evento, noche, playa…);
//   3. si no hay nada (el look del día), una escena cotidiana rotada por look,
//      estable para el mismo look y distinta entre looks.
// Un look de viaje con UN destino se ubica en esa ciudad. Con varias paradas
// no se sabe en cuál cae el look, así que no se inventa ciudad.
//
// LAS REGLAS NO SON ESTÉTICA, SON FIDELIDAD. El try-on existe para ver cómo te
// queda TU ropa: una luz dorada vuelve beige un gris y la noche se come el
// color. Por eso nunca atardecer, noche ni luz de ambiente, aunque el plan sea
// una cena (la cena va en un interior BIEN iluminado). Y el fondo desenfocado:
// una escena con más protagonismo le da al modelo más espacio para inventar
// (la corbata que Aesty agregó a un look salió de ahí).

export type ContextoEscena = {
  /** El plan en palabras de la persona ("comida en restaurante…"). */
  plan?: string | null;
  /** outfits.occasion, o la `ocasion` del look de viaje. */
  ocasion?: string | null;
  /** Ciudad del viaje, solo si el look cae en UNA parada conocida. */
  ciudad?: string | null;
  /** Fuerza un barrio del catálogo de la ciudad (pruebas y, luego, elección). */
  barrio?: string | null;
  /** Clima del look: basta con la condición. */
  clima?: { condition?: string | null } | null;
  /** Qué hace estable la rotación: el id del look o la ruta del caché. */
  semilla: string;
};

export type EscenaId =
  | "calle-ciudad"
  | "calle-residencial"
  | "plaza-minimal"
  | "cafe"
  | "restaurante"
  | "interior-noche"
  | "oficina"
  | "evento"
  | "campus"
  | "parque"
  | "playa"
  | "calle-comercial"
  | "aeropuerto";

export const ESCENAS: Record<EscenaId, string> = {
  "calle-ciudad":
    "A city sidewalk with stone and glass facades, soft overcast daylight, blurred pedestrians far behind.",
  "calle-residencial":
    "A leafy residential street with low houses, trees and a few parked bikes, soft daylight filtered through the leaves.",
  "plaza-minimal":
    "A minimal urban plaza with clean concrete columns and long soft shadows, cool even daylight.",
  cafe: "Outside a modern cafe: glass front, a few small tables and chairs on the sidewalk, soft daylight.",
  restaurante:
    "The terrace of a nice restaurant with plants and a few set tables, soft even daylight.",
  "interior-noche":
    "Inside a stylish restaurant or bar with clean modern decor, BRIGHTLY and evenly lit like a daytime editorial shoot.",
  oficina:
    "The sidewalk outside a modern office building with glass and stone, soft overcast daylight.",
  evento:
    "The garden terrace of an elegant hacienda or hotel, stone paths and greenery, bright soft daylight.",
  campus:
    "A university campus path with brick buildings and a clipped lawn, crisp daylight, a few students blurred far behind.",
  parque:
    "A path in a green city park with trees and open lawn, soft daylight.",
  playa:
    "A seaside promenade with the sea softly blurred behind, bright soft daylight (not harsh noon sun).",
  "calle-comercial":
    "An open-air shopping street with shop fronts softly blurred behind, daylight.",
  aeropuerto:
    "A bright modern airport terminal with tall windows and daylight pouring in.",
};

// Lo que el plan dice, en orden de prioridad: la primera familia que aparece
// gana. "cita médica" va ANTES que "cita" (romántica → restaurante) porque una
// sala de espera de fondo no es algo que nadie quiera ver puesto.
const PALABRAS: Array<[EscenaId, string[]]> = [
  ["calle-ciudad", ["cita medica", "doctor", "dentista", "hospital", "banco", "tramite"]],
  ["evento", ["boda", "gala", "graduacion", "xv anos", "bautizo", "primera comunion", "ceremonia", "coctel"]],
  ["interior-noche", ["cena", "antro", "bar", "fiesta", "noche", "concierto", "club"]],
  ["oficina", ["oficina", "trabajo", "junta", "entrevista", "presentacion", "chamba", "cliente"]],
  ["campus", ["escuela", "universidad", "clase", "campus", "facultad", "prepa"]],
  ["playa", ["playa", "alberca", "mar", "piscina"]],
  ["aeropuerto", ["aeropuerto", "vuelo", "avion"]],
  ["calle-comercial", ["super", "supermercado", "mandado", "centro comercial", "compras", "cine", "tiendas", "plaza comercial"]],
  ["parque", ["parque", "pasear", "perro", "picnic", "caminar", "gym", "gimnasio", "correr", "entrenar", "yoga"]],
  ["cafe", ["cafe", "desayuno", "brunch", "cafecito"]],
  ["restaurante", ["comida", "comer", "restaurante", "cumpleanos", "familia", "cita", "reunion familiar"]],
];

const POR_OCASION: Record<string, EscenaId> = {
  oficina: "oficina",
  trabajo: "oficina",
  evento: "evento",
  especial: "evento",
  noche: "interior-noche",
  playa: "playa",
  ciudad: "calle-ciudad",
};

const COTIDIANAS: EscenaId[] = ["calle-ciudad", "cafe", "calle-residencial", "plaza-minimal", "parque", "calle-comercial"];

// EN MOVIMIENTO, NO PARADO EXISTIENDO. Roberto, viendo la primera prueba: las
// que más le gustaron fueron las de caminar y la de la mano en el bolsillo a
// medio paso — "no se siente nada más como parado existiendo". Por eso tres de
// cuatro caminan, y la cuarta al menos tiene el peso en movimiento.
const POSES = [
  "Caught mid-stride walking toward the camera at a slight angle, one hand in a trouser pocket, the other arm swinging naturally.",
  "Caught mid-step walking past the camera, turned three-quarter, gaze slightly ahead and away.",
  "Walking and just glancing toward the camera, coat or jacket moving slightly with the step.",
  "Stepping off a curb or a low step, weight shifting forward, one hand adjusting a sleeve.",
];

export const REGLAS_ESCENA =
  "LIGHT: natural daylight or a bright, evenly lit interior with neutral white balance — NEVER golden hour, sunset, night darkness, neon or dim mood lighting: the garments' true colours must read exactly. " +
  "BACKGROUND: softly out of focus, secondary to the outfit; no other people close to the person; no readable text, logos or signs. " +
  "The whole outfit is clearly visible head to feet, never hidden by furniture or props. " +
  "Any bag or accessory is physically anchored to the body — held in a hand or worn with a visible strap — NEVER floating.";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/ +/g, " ");
}

function contiene(texto: string, palabra: string): boolean {
  return ` ${texto} `.includes(` ${palabra} `);
}

// Hash estable y barato (FNV-1a): no es criptografía, solo reparto.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function elegirEscena(ctx: ContextoEscena): EscenaId {
  const plan = ctx.plan ? normalizar(ctx.plan) : "";
  if (plan) {
    for (const [id, palabras] of PALABRAS) {
      if (palabras.some((p) => contiene(plan, p))) return id;
    }
  }
  const oc = ctx.ocasion ? POR_OCASION[normalizar(ctx.ocasion).trim()] : undefined;
  if (oc) return oc;
  return COTIDIANAS[hash(ctx.semilla) % COTIDIANAS.length];
}

// BARRIOS: cuando la ciudad es conocida, "en la Ciudad de México" solo no
// alcanza — el modelo rellena con lo más promedio que sabe de "México", que es
// el cliché de película (filtro amarillo, papel picado). Cada barrio va
// descrito como lo vive quien vive ahí HOY, con sus materiales reales, y con
// las escenas que le quedan: nadie va a la oficina en San Ángel ni a una
// boda en Santa Fe.
type Barrio = { id: string; nombre: string; describe: string; escenas: EscenaId[] };

const BARRIOS: Record<string, Barrio[]> = {
  "ciudad de mexico": [
    {
      id: "polanco",
      nombre: "Polanco",
      describe:
        "Polanco, Mexico City: a wide, tree-lined sidewalk on Avenida Presidente Masaryk with upscale boutique fronts, a mix of 1940s Californian-colonial style houses with carved stone doorways and sleek modern glass buildings.",
      escenas: ["calle-ciudad", "calle-comercial", "restaurante", "interior-noche", "oficina", "cafe"],
    },
    {
      id: "san-angel",
      nombre: "San Ángel",
      describe:
        "San Ángel, Mexico City: a quiet cobblestone street with high old stone walls covered in bougainvillea, dark volcanic stone and colonial doorways, large trees overhead.",
      escenas: ["calle-residencial", "restaurante", "evento", "cafe"],
    },
    {
      id: "coyoacan",
      nombre: "Coyoacán",
      describe:
        "Coyoacán, Mexico City: a tree-lined cobblestone street like Francisco Sosa, low colonial houses with muted ochre and deep red plaster walls, wooden doors and iron window grilles.",
      escenas: ["calle-residencial", "cafe", "parque", "restaurante"],
    },
    {
      id: "roma",
      nombre: "la Roma",
      describe:
        "Colonia Roma, Mexico City: a sidewalk lined with early-1900s Porfirian and Art Nouveau townhouses with ornate stone facades and wrought-iron balconies, a leafy central median with benches, independent cafes.",
      escenas: ["calle-ciudad", "calle-residencial", "cafe", "restaurante", "interior-noche", "calle-comercial"],
    },
    {
      id: "condesa",
      nombre: "Condesa",
      describe:
        "Condesa, Mexico City: a tree-shaded street with cream Art Deco apartment buildings with rounded corners, a pedestrian median with jacaranda trees, sidewalk cafe tables.",
      escenas: ["calle-residencial", "cafe", "parque", "restaurante", "interior-noche", "plaza-minimal"],
    },
    {
      id: "centro",
      nombre: "el Centro",
      describe:
        "Centro Histórico, Mexico City: a pedestrian street like Madero with baroque colonial facades in grey cantera stone and dark red volcanic tezontle, tall wooden doors and wrought-iron balconies, NOT in front of the cathedral or any famous monument.",
      escenas: ["calle-ciudad", "calle-comercial", "restaurante"],
    },
    {
      id: "santa-fe",
      nombre: "Santa Fe",
      describe:
        "Santa Fe, Mexico City: a clean corporate plaza between modern glass and steel office towers, wide paved walkways and landscaped planters.",
      escenas: ["oficina", "plaza-minimal", "calle-ciudad"],
    },
  ],
};

// LA CIUDAD DEL DÍA A DÍA, SIN GUARDAR DÓNDE ESTÁS. Solo hay una ciudad con
// catálogo propio, así que no hace falta geocodificar nada ni pedirle nada a
// otro servicio: basta saber si las coordenadas del clima caen dentro de la
// zona metropolitana del Valle de México. Se guarda la CIUDAD, nunca la
// colonia ni las coordenadas — Roberto: "lo de la colonia no hace sentido".
// Fuera de la caja (Saltillo, Mérida…) no se marca nada y el look cae en las
// escenas genéricas, que rotan: no se ve igual para todos.
const CAJA_CDMX = { latMin: 19.18, latMax: 19.62, lonMin: -99.36, lonMax: -98.94 };

export function ciudadDeCoordenadas(lat: unknown, lon: unknown): string | null {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const c = CAJA_CDMX;
  return lat >= c.latMin && lat <= c.latMax && lon >= c.lonMin && lon <= c.lonMax
    ? "Ciudad de México"
    : null;
}

/**
 * El clima que se GUARDA en el look, con la ciudad si se detectó. Solo la copia
 * guardada: al motor no le llega (un cambio de lo que ve el motor se mide antes).
 */
export function conCiudad<T extends object>(weather: T | null, ciudad: string | null): (T & { ciudad?: string }) | null {
  if (!weather || !ciudad) return weather;
  return { ...weather, ciudad };
}

const ALIAS_CIUDAD: Record<string, string> = {
  cdmx: "ciudad de mexico",
  df: "ciudad de mexico",
  "mexico city": "ciudad de mexico",
  "ciudad de mexico": "ciudad de mexico",
};

export function barriosDe(ciudad: string | null | undefined): Barrio[] {
  const c = ALIAS_CIUDAD[normalizar(ciudad ?? "").trim()];
  return c ? BARRIOS[c] ?? [] : [];
}

/** El barrio que le toca: el forzado, o uno compatible con la escena, estable por look. */
export function elegirBarrio(ctx: ContextoEscena, escena: EscenaId): Barrio | null {
  const todos = barriosDe(ctx.ciudad);
  if (!todos.length) return null;
  if (ctx.barrio) return todos.find((b) => b.id === ctx.barrio) ?? null;
  const aptos = todos.filter((b) => b.escenas.includes(escena));
  const lista = aptos.length ? aptos : todos;
  return lista[hash(`${ctx.semilla}:barrio`) % lista.length];
}

// Aplica a CUALQUIER ciudad: la versión contemporánea que vive la gente, no
// la postal. El filtro amarillo es el cliché de Hollywood para México y además
// ensucia el color de la ropa, que es lo que el try-on existe para mostrar.
export const REGLA_CIUDAD =
  "Show the contemporary, everyday version of the city as locals live it today — no tourist clichés, no folkloric props or decorations, no costumes, and absolutely no yellow, sepia or warm colour filter.";

const LLUVIA = ["lluvia", "llovizna", "tormenta", "chubasco", "aguacero"];

/** El bloque de texto que reemplaza "plain flat light-grey wall" en el prompt. */
export function escenaParaPrompt(ctx: ContextoEscena): string {
  let id = elegirEscena(ctx);
  const barrio = elegirBarrio(ctx, id);
  // Un barrio FORZADO que no admite esa escena (una oficina en San Ángel)
  // cambia la escena por la primera que sí le queda, en vez de pedirle al
  // modelo dos lugares que se contradicen.
  if (barrio && !barrio.escenas.includes(id)) id = barrio.escenas[0];
  let escena = `SETTING: ${ESCENAS[id]}`;
  const ciudad = ctx.ciudad?.trim();
  if (barrio) {
    escena += ` The place is in ${barrio.describe} ${REGLA_CIUDAD}`;
  } else if (ciudad) {
    escena += ` The place is in ${ciudad}: it should clearly feel like ${ciudad} through its local architecture and materials, but NOT posed in front of a famous landmark and with no crowds of tourists. ${REGLA_CIUDAD}`;
  }
  const condicion = normalizar(ctx.clima?.condition ?? "");
  if (LLUVIA.some((p) => condicion.includes(p))) {
    escena += " It is a rainy day: the person is under a covered arcade or awning, wet pavement behind, soft overcast light.";
  }
  const pose = POSES[hash(`${ctx.semilla}:pose`) % POSES.length];
  return `${escena} POSE: ${pose} Candid and in motion, NOT standing still and NOT a stiff straight-on catalog pose. ${REGLAS_ESCENA}`;
}

/** La ciudad de un viaje, solo si tiene una sola parada. "Madrid, Comunidad…" → "Madrid". */
export function ciudadDelViaje(
  paradas: Array<{ lugar?: string | null }> | null | undefined,
  lugar: string | null | undefined
): string | null {
  const unica = paradas && paradas.length === 1 ? paradas[0]?.lugar : !paradas?.length ? lugar : null;
  const c = (unica ?? "").split(",")[0].trim();
  return c || null;
}
