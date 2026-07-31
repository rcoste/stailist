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

export const LOOKS: Look[] = ESTILOS.map(([id, nombre, vibe, tags, segment = "unisex"]) => ({
  id,
  nombre,
  vibe,
  tags,
  segment,
  prendas: [],
  // Imagen por defecto: unisex usa el archivo de hombre; los específicos (p. ej.
  // coquette/mujer) usan /looks/<id>.png. looksForGender() resuelve por género.
  image: segment === "unisex" ? `/looks/${id}-hombre.png` : `/looks/${id}.png`,
}));

export const LOOK_IDS = new Set(LOOKS.map((l) => l.id));

// Cada estilo tiene su imagen por género: /looks/<id>-<genero>.png.
export function looksForGender(gender: "hombre" | "mujer"): Look[] {
  return LOOKS.filter(
    (l) => l.segment === "unisex" || l.segment === gender
  ).map((l) => ({
    ...l,
    image:
      l.segment === "unisex" ? `/looks/${l.id}-${gender}.png` : `/looks/${l.id}.png`,
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
