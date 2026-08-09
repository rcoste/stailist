// Los estilos del swipe de gustos (26 mujer / 25 hombre — coquette es women-only;
// rebrand v3 Gen-Z 2026-06-27, ver docs/designs/estilos.md). Imágenes recasteadas
// a modelos europeo-latinos jóvenes, foto candid limpia. Los tags de los looks con
// ❤️ se convierten en el
// taste vector (profiles.taste_tags) que alimenta el motor — sin ML, puro conteo.
//
// Cada estilo tiene imagen propia para hombre y mujer (un avatar fijo vistiendo
// el outfit del estilo): /looks/<id>-<genero>.png. Por eso TODOS son segment
// "unisex": ambos los ven, looksForGender() resuelve la imagen de su género.
// `prendas` queda como fallback de swatches si faltara la imagen.

export type Look = {
  id: string;
  nombre: string;
  vibe: string; // una línea en voz amiga cool
  tags: string[];
  segment: "hombre" | "mujer" | "unisex";
  prendas: { nombre: string; swatch: string }[];
  image: string | null;
};

// [id, nombre, vibe, tags, segment?] — segment default "unisex". Coquette es
// "mujer" (no hay versión masculina que tenga sentido); su imagen vive en
// /looks/coquette.png (los unisex usan /looks/<id>-<genero>.png).
type EstiloRow = [string, string, string, string[], ("hombre" | "mujer" | "unisex")?];
const ESTILOS: EstiloRow[] = [
  ["minimalista", "Minimalista", "menos es más, todo encaja", ["minimalista", "sobrio", "pulido"]],
  ["casual-effortless", "Casual sin esfuerzo", "fresco y sin pensarlo", ["casual", "fresco", "versatil"]],
  ["clasico-elegante", "Clásico elegante", "elegancia que no grita", ["clasico", "elegante", "minimalista"]],
  ["preppy", "Preppy", "pulido con aire de campus", ["preppy", "clasico", "pulido"]],
  ["sastre", "Sastre", "el traje, con tu sello", ["estructurado", "elegante", "pulido"]],
  ["smart-casual", "Smart casual", "de la junta al after", ["pulido", "versatil", "moderno"]],
  ["streetwear", "Streetwear", "cómodo, con actitud", ["urbano", "atrevido", "deportivo"]],
  ["athleisure", "Athleisure", "deportivo bien hecho", ["deportivo", "casual", "fresco"]],
  ["edgy", "Edgy / rock", "cuero, negro y cero miedo", ["edgy", "atrevido", "urbano"]],
  ["grunge", "Grunge", "noventas, suelto y sin pose", ["grunge", "relajado", "vintage"]],
  ["hipster", "Hipster", "thrift con personalidad", ["hipster", "vintage", "creativo"]],
  ["utility", "Utility", "funcional, con carácter", ["utility", "urbano", "relajado"]],
  ["tonos-tierra", "Tonos tierra", "calidez que te enciende la cara", ["calido", "natural", "relajado"]],
  ["monocromatico", "Monocromático", "un solo tono, todo el impacto", ["minimalista", "sobrio", "moderno"]],
  ["color-protagonista", "Color protagonista", "que el color hable", ["colorido", "atrevido", "creativo"]],
  ["vintage", "Vintage / retro", "con historia, sin disfraz", ["vintage", "retro", "relajado"]],
  ["nautico", "Náutico", "rayas, azul y brisa", ["nautico", "clasico", "fresco"]],
  ["romantico", "Romántico", "delicado y ligero", ["romantico", "suave", "fresco"]],
  ["boho", "Boho", "suelto, con textura y alma", ["boho", "relajado", "romantico"]],
  ["glam-noche", "Glam de noche", "para cuando hay que brillar", ["glam", "elegante", "atrevido"]],
  // Canje 2026-07-22: academia + coastal reemplazan a finance-bro y startup
  // (dos cartas muy masculinas y redundantes con preppy/athleisure) por dos
  // ejes que faltaban — intelectual y resort/clean-girl —, con más balance
  // femenino/andrógino. Imágenes: hombre = Roberto, mujer = morena.
  ["academia", "Academia", "tweed, libros y aire intelectual", ["academia", "clasico", "vintage"]],
  ["coastal", "Coastal", "lino, blancos y brisa de mar", ["coastal", "natural", "fresco"]],
  // Nuevos (2026-06-27, rebrand v3 swipes Gen-Z):
  ["y2k", "Y2K", "los 2000 sin pena: baggy y con actitud", ["y2k", "atrevido", "retro"]],
  ["coquette", "Coquette", "moños, suave y muy femenino", ["coquette", "romantico", "suave"], "mujer"],
  ["gorpcore", "Gorpcore", "técnico de montaña, pero para la ciudad", ["gorpcore", "utility", "deportivo"]],
  // 2026-07-22: K-fashion / minimalismo coreano — el fit oversized drapeado de
  // los K-dramas está muy fuerte. Se diferencia de Monocromático por la
  // SILUETA (abrigo largo + wide-leg fluido, no el tono único ceñido).
  ["coreano", "Coreano", "holgado, fluido y monocromo — muy K-drama", ["fluido", "oversize", "sobrio"]],
  // 2026-07-31: el eje que FALTABA. Tatiana lo dijo revisando el deck — "están
  // muy señoriales, falta algo más sexy" — y al revisar las 26 tenía razón:
  // TODAS eran holgadas y cubiertas. A quien le gusta la ropa que marca la
  // silueta no le aparecía ninguna carta suya, así que el motor no se enteraba
  // nunca de ese gusto.
  //
  // Women-only como coquette: el equivalente masculino de este eje no es "lo
  // mismo pero de hombre", así que no se inventa. El tag `ceñido` es nuevo a
  // propósito — al ser raro pesa más en el vector de gustos (ver tasteTags,
  // que normaliza por frecuencia).
  ["de-salir", "De salir", "ceñido, corto y con actitud", ["ceñido", "atrevido", "glam"], "mujer"],
];

// Rompe-caché de las imágenes del deck.
//
// Las cartas se rehacen conservando el nombre de archivo (minimalista-hombre.png
// sigue siendo minimalista-hombre.png), así que para el navegador es la misma
// imagen de siempre y sirve la que ya tenía guardada — se rehízo el deck entero
// y en el teléfono seguían saliendo las cartas viejas. Subir este número cambia
// la URL sin renombrar 50 archivos ni tocar los scripts que los generan.
//
// SÚBELO cada vez que se regeneren las imágenes del deck.
//
// Se exporta porque next.config.ts TIENE que declarar exactamente esta query en
// images.localPatterns: el componente <Image> valida el `search` con igualdad
// exacta —`search: ""` significa "sin query", no "cualquier query"— y si no
// coincide LANZA en render y tumba la pantalla entera. Importarlo de aquí evita
// que los dos números se separen (ya pasó: subí el `?v=` sin la config buena y
// el deck reventó en producción).
export const LOOKS_V = "4";
const V = LOOKS_V;

export const LOOKS: Look[] = ESTILOS.map(([id, nombre, vibe, tags, segment = "unisex"]) => ({
  id,
  nombre,
  vibe,
  tags,
  segment,
  prendas: [],
  // Imagen por defecto: unisex usa el archivo de hombre; los específicos (p. ej.
  // coquette/mujer) usan /looks/<id>.png. looksForGender() resuelve por género.
  image:
    segment === "unisex" ? `/looks/${id}-hombre.png?v=${V}` : `/looks/${id}.png?v=${V}`,
}));

export const LOOK_IDS = new Set(LOOKS.map((l) => l.id));

/** Familias del mazo. El contraste que la gente percibe NO es por tag suelto
 *  ("versatil" vs "moderno" no le dice nada a nadie): es por familia — la calle
 *  contra lo pulido, lo suave contra lo que brilla. Se deriva de los tags que ya
 *  existen, en orden de prioridad, para no tener que tocar las 27 filas ni
 *  mantener dos listas que se desincronicen. */
const FAMILIA_POR_TAG: [string, string][] = [
  ["ceñido", "brillo"],
  ["glam", "brillo"],
  ["colorido", "brillo"],
  ["y2k", "calle"],
  ["gorpcore", "calle"],
  ["urbano", "calle"],
  ["deportivo", "calle"],
  ["grunge", "calle"],
  ["edgy", "calle"],
  ["utility", "calle"],
  ["romantico", "suave"],
  ["coquette", "suave"],
  ["boho", "suave"],
  ["coastal", "suave"],
  ["natural", "suave"],
  ["calido", "suave"],
  ["vintage", "retro"],
  ["retro", "retro"],
  ["hipster", "retro"],
  ["academia", "retro"],
  ["nautico", "retro"],
  ["oversize", "limpio"],
  ["fluido", "limpio"],
  ["minimalista", "limpio"],
  ["clasico", "limpio"],
  ["estructurado", "limpio"],
  ["preppy", "limpio"],
  ["pulido", "limpio"],
];
const ORDEN_FAMILIAS = ["limpio", "calle", "suave", "brillo", "retro"];

function familiaDe(l: Look): string {
  for (const [tag, fam] of FAMILIA_POR_TAG) if (l.tags.includes(tag)) return fam;
  return "limpio";
}

/** Reordena el mazo alternando familias, para que las primeras cartas
 *  contrasten de verdad.
 *
 *  EL PROBLEMA, medido el 2026-08-09 sobre el orden de este archivo: las seis
 *  primeras cartas —minimalista, casual sin esfuerzo, clásico elegante, preppy,
 *  sastre, smart casual— eran todas del mismo cluster pulido/clásico, y el mazo
 *  NO se baraja, así que ese arranque monótono era idéntico para todo el mundo.
 *  Las polarizantes vivían al fondo: y2k en la 23, gorpcore en la 24, coquette
 *  en la 24 y `de-salir` en la 27 de 27 — la última. Y esa carta existe
 *  justamente porque Tatiana señaló que faltaba el eje "marca la silueta": el
 *  parche al hueco estaba puesto donde menos se ve, y quien abandonaba a media
 *  tanda no lo veía nunca.
 *
 *  QUÉ HACE: round-robin entre familias. Primera de limpio, primera de calle,
 *  primera de suave, primera de brillo, primera de retro, segunda de limpio…
 *  Dentro de cada familia se respeta el orden del archivo (curado a mano), así
 *  que una carta nueva sólo se une a la rotación de la suya y no hay que
 *  reordenar nada.
 *
 *  ANTES DE ESTO probé un greedy de "la carta que menos tags comparta con lo ya
 *  visto". No sirvió —19 tags contra 18 en las diez primeras, y `de-salir`
 *  seguía en la 27— porque a media lista todo solapa con todo y el criterio se
 *  apaga. Queda escrito para que nadie lo reintente.
 *
 *  LO QUE NO HACE, a propósito: podar. Roberto propuso quitar del mazo los
 *  estilos que los primeros swipes descarten. Un mazo que se poda con su propia
 *  hipótesis deja de medir: las cartas que quedan sólo pueden confirmarla, y
 *  después no se puede distinguir "no le gusta" de "nunca le apareció". Es el
 *  mismo error que el comparador pareado existe para evitar.
 *
 *  DETERMINISTA: el mismo mazo para todo el mundo, así que los taste_tags
 *  siguen siendo comparables entre personas y a lo largo del tiempo. */
function porContraste(looks: Look[]): Look[] {
  const porFamilia = new Map<string, Look[]>();
  for (const l of looks) {
    const f = familiaDe(l);
    if (!porFamilia.has(f)) porFamilia.set(f, []);
    porFamilia.get(f)!.push(l);
  }
  const familias = [
    ...ORDEN_FAMILIAS.filter((f) => porFamilia.has(f)),
    ...[...porFamilia.keys()].filter((f) => !ORDEN_FAMILIAS.includes(f)),
  ];
  const orden: Look[] = [];
  for (let ronda = 0; orden.length < looks.length; ronda++) {
    for (const f of familias) {
      const c = porFamilia.get(f)![ronda];
      if (c) orden.push(c);
    }
    if (ronda > looks.length) break; // red de seguridad
  }
  return orden;
}

// Cada estilo tiene su imagen por género: /looks/<id>-<genero>.png.
export function looksForGender(gender: "hombre" | "mujer"): Look[] {
  return porContraste(
    LOOKS.filter((l) => l.segment === "unisex" || l.segment === gender)
  ).map((l) => ({
    ...l,
    image:
      l.segment === "unisex"
        ? `/looks/${l.id}-${gender}.png?v=${V}`
        : `/looks/${l.id}.png?v=${V}`,
  }));
}

// Cuántos de los estilos llevan cada tag. Tags raros (edgy, grunge, glam…)
// salen en 1; tags genéricos (pulido, atrevido, relajado…) en varios.
const TAG_DF: Map<string, number> = (() => {
  const df = new Map<string, number>();
  for (const l of LOOKS) for (const t of l.tags) df.set(t, (df.get(t) ?? 0) + 1);
  return df;
})();

// Deriva los tags de gusto de los swipes. NO es conteo crudo: normaliza por
// frecuencia para que la preferencia distintiva no la entierren los tags
// genéricos — pero con amortiguación (√DF), no división plena. La división
// plena (n/DF) tenía un bug de calibración: un ÚNICO ❤️ al look "edgy" (DF=1,
// rate 1.0) le ganaba a "pulido" con +3 netos (3/5 = 0.6) — un like suelto
// pesaba más que una preferencia consistente.
//
// score(tag) = (likes − dislikes) / √(estilos que llevan ese tag)
//   → edgy con 1 ❤️ = 1.0; pulido con +3 = 3/√5 ≈ 1.34: la consistencia gana,
//   y el tag raro sigue rankeando arriba de señales débiles.
// Empate → desempata por evidencia cruda (likes netos).
// El array devuelto queda EN ORDEN DE FUERZA (los motores lo aprovechan).
export function computeTasteTags(
  results: { id: string; liked: boolean }[]
): string[] {
  const net = new Map<string, number>(); // likes − dislikes
  for (const r of results) {
    const look = LOOKS.find((l) => l.id === r.id);
    if (!look) continue;
    for (const tag of look.tags) {
      net.set(tag, (net.get(tag) ?? 0) + (r.liked ? 1 : -1));
    }
  }
  return [...net.entries()]
    .map(([tag, n]) => ({ tag, n, score: n / Math.sqrt(TAG_DF.get(tag) ?? 1) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.n - a.n)
    .slice(0, 8)
    .map((x) => x.tag);
}
