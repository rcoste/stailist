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
  // Nuevos (2026-06-16): tags distintivos (startup/finance) para que la señal
  // de gusto pese fuerte. Imágenes hombre usan a Roberto como avatar.
  ["startup", "Startup", "cómodo, listo para construir", ["startup", "casual", "deportivo"]],
  ["finance-bro", "Finance bro", "chaleco y a cerrar el trato", ["finance", "preppy", "pulido"]],
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

// Cuántos de los 20 estilos llevan cada tag. Tags raros (edgy, grunge, glam…)
// salen en 1; tags genéricos (pulido, atrevido, relajado…) en varios.
const TAG_DF: Map<string, number> = (() => {
  const df = new Map<string, number>();
  for (const l of LOOKS) for (const t of l.tags) df.set(t, (df.get(t) ?? 0) + 1);
  return df;
})();

// Deriva los tags de gusto de los swipes. NO es conteo crudo: normaliza por
// frecuencia para que la preferencia distintiva no la entierren los tags
// genéricos. Si amas el único look "edgy", `edgy` (rate 1.0) vence a un `pulido`
// que salió +3 solo por aparecer en 4 estilos.
//
// rate(tag) = (likes − dislikes con ese tag) / (estilos que llevan ese tag)
//   = qué tan CONSISTENTEMENTE te gustó ese tag, en −1..1.
// Empate de rate → desempata por evidencia cruda (likes netos): un tag que te
// gustó en varios estilos vence a uno que solo viste una vez.
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
    .map(([tag, n]) => ({ tag, n, rate: n / (TAG_DF.get(tag) ?? 1) }))
    .filter((x) => x.rate > 0)
    .sort((a, b) => b.rate - a.rate || b.n - a.n)
    .slice(0, 8)
    .map((x) => x.tag);
}
