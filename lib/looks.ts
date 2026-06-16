// Los 20 estilos del swipe de gustos (overhaul 2026-06-16, ver
// docs/designs/estilos.md). Los tags de los looks con ❤️ se convierten en el
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

// [id, nombre, vibe, tags]
const ESTILOS: [string, string, string, string[]][] = [
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
];

export const LOOKS: Look[] = ESTILOS.map(([id, nombre, vibe, tags]) => ({
  id,
  nombre,
  vibe,
  tags,
  segment: "unisex",
  prendas: [],
  image: `/looks/${id}-hombre.png`,
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

export function computeTasteTags(
  results: { id: string; liked: boolean }[]
): string[] {
  const score = new Map<string, number>();
  for (const r of results) {
    const look = LOOKS.find((l) => l.id === r.id);
    if (!look) continue;
    for (const tag of look.tags) {
      score.set(tag, (score.get(tag) ?? 0) + (r.liked ? 1 : -1));
    }
  }
  return [...score.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);
}
