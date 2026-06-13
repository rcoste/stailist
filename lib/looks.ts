// Los ~15 looks del swipe de gustos. Los tags estéticos de los looks con ❤️
// se convierten en el taste vector (profiles.taste_tags) que alimenta el
// contexto del motor — sin ML, puro conteo.
//
// `image`: flat-lay del outfit completo (generado one-off con Gemini en
// public/looks/<id>.png). Si fuera null, la card cae a los swatches.
// Los hex de aquí son COLORES DE ROPA (datos), no tokens de UI.

export type Look = {
  id: string;
  nombre: string;
  vibe: string; // una línea en voz amiga cool
  tags: string[];
  prendas: { nombre: string; swatch: string }[];
  image: string | null;
};

export const LOOKS: Look[] = [
  {
    id: "blanco-mezclilla",
    nombre: "Blanco + mezclilla",
    vibe: "fresco y sin esfuerzo",
    tags: ["casual", "minimalista", "fresco"],
    prendas: [
      { nombre: "Camiseta blanca", swatch: "#F5F5F0" },
      { nombre: "Jeans claros", swatch: "#7A95B0" },
      { nombre: "Tenis blancos", swatch: "#FAFAF7" },
    ],
    image: "/looks/blanco-mezclilla.png",
  },
  {
    id: "total-black",
    nombre: "Total black",
    vibe: "afilado, cero dudas",
    tags: ["minimalista", "atrevido", "urbano"],
    prendas: [
      { nombre: "Playera negra", swatch: "#1A1A1A" },
      { nombre: "Pantalón negro", swatch: "#242424" },
      { nombre: "Botas negras", swatch: "#111111" },
    ],
    image: "/looks/total-black.png",
  },
  {
    id: "oficina-relajada",
    nombre: "Oficina relajada",
    vibe: "pro, sin acartonarte",
    tags: ["clasico", "pulido", "versatil"],
    prendas: [
      { nombre: "Camisa azul claro", swatch: "#AEC6E8" },
      { nombre: "Pantalón negro", swatch: "#1F1F1F" },
      { nombre: "Mocasines café", swatch: "#6B4A33" },
    ],
    image: "/looks/oficina-relajada.png",
  },
  {
    id: "parisino",
    nombre: "Clásico parisino",
    vibe: "elegancia que no grita",
    tags: ["clasico", "elegante", "minimalista"],
    prendas: [
      { nombre: "Trench beige", swatch: "#C8B89A" },
      { nombre: "Blusa blanca", swatch: "#FAFAF7" },
      { nombre: "Pantalón negro", swatch: "#1F1F1F" },
    ],
    image: "/looks/parisino.png",
  },
  {
    id: "boho-domingo",
    nombre: "Boho de domingo",
    vibe: "suelto, relajado, con textura",
    tags: ["boho", "relajado", "romantico"],
    prendas: [
      { nombre: "Vestido oliva", swatch: "#6B7A4C" },
      { nombre: "Cardigan crema", swatch: "#EFE9DC" },
      { nombre: "Sandalias café", swatch: "#6B4A33" },
    ],
    image: "/looks/boho-domingo.png",
  },
  {
    id: "street-urbano",
    nombre: "Street urbano",
    vibe: "cómodo, con actitud",
    tags: ["urbano", "deportivo", "atrevido"],
    prendas: [
      { nombre: "Hoodie gris", swatch: "#8A8784" },
      { nombre: "Cargo negro", swatch: "#242424" },
      { nombre: "Tenis blancos", swatch: "#FAFAF7" },
    ],
    image: "/looks/street-urbano.png",
  },
  {
    id: "romantico-suave",
    nombre: "Romántico suave",
    vibe: "delicado y ligero",
    tags: ["romantico", "suave", "fresco"],
    prendas: [
      { nombre: "Blusa rosa pálido", swatch: "#E8C9CE" },
      { nombre: "Falda crema", swatch: "#EFE9DC" },
      { nombre: "Flats nude", swatch: "#D9BFA8" },
    ],
    image: "/looks/romantico-suave.png",
  },
  {
    id: "deportivo-limpio",
    nombre: "Deportivo limpio",
    vibe: "athleisure bien hecho",
    tags: ["deportivo", "casual", "fresco"],
    prendas: [
      { nombre: "Top blanco", swatch: "#FAFAF7" },
      { nombre: "Joggers marino", swatch: "#27425F" },
      { nombre: "Tenis blancos", swatch: "#F5F5F0" },
    ],
    image: "/looks/deportivo-limpio.png",
  },
  {
    id: "elegante-noche",
    nombre: "Elegante de noche",
    vibe: "para cuando hay que brillar",
    tags: ["elegante", "atrevido", "glam"],
    prendas: [
      { nombre: "Vestido negro", swatch: "#1A1A1A" },
      { nombre: "Bolso vino", swatch: "#722F37" },
      { nombre: "Tacones negros", swatch: "#111111" },
    ],
    image: "/looks/elegante-noche.png",
  },
  {
    id: "color-block",
    nombre: "Color block",
    vibe: "el color es el protagonista",
    tags: ["colorido", "atrevido", "creativo"],
    prendas: [
      { nombre: "Suéter azul royal", swatch: "#2E4FA3" },
      { nombre: "Pantalón verde", swatch: "#4C7A5E" },
      { nombre: "Tenis blancos", swatch: "#FAFAF7" },
    ],
    image: "/looks/color-block.png",
  },
  {
    id: "tonos-tierra",
    nombre: "Tonos tierra",
    vibe: "calidez natural",
    tags: ["calido", "natural", "relajado"],
    prendas: [
      { nombre: "Suéter camel", swatch: "#B08D57" },
      { nombre: "Pantalón café", swatch: "#6B4A33" },
      { nombre: "Botas crema", swatch: "#EFE9DC" },
    ],
    image: "/looks/tonos-tierra.png",
  },
  {
    id: "monocromo-gris",
    nombre: "Monocromo gris",
    vibe: "calma y estructura",
    tags: ["minimalista", "estructurado", "sobrio"],
    prendas: [
      { nombre: "Suéter gris claro", swatch: "#B5B1AC" },
      { nombre: "Pantalón gris", swatch: "#8A8784" },
      { nombre: "Tenis grises", swatch: "#5E5A56" },
    ],
    image: "/looks/monocromo-gris.png",
  },
  {
    id: "estampado-atrevido",
    nombre: "Estampado atrevido",
    vibe: "que se note que llegaste",
    tags: ["creativo", "atrevido", "colorido"],
    prendas: [
      { nombre: "Camisa estampada", swatch: "#3D6B5E" },
      { nombre: "Pantalón negro", swatch: "#1F1F1F" },
      { nombre: "Botines negros", swatch: "#111111" },
    ],
    image: "/looks/estampado-atrevido.png",
  },
  {
    id: "marinero-casual",
    nombre: "Marinero casual",
    vibe: "rayas, azul y brisa",
    tags: ["clasico", "fresco", "casual"],
    prendas: [
      { nombre: "Suéter de rayas", swatch: "#27425F" },
      { nombre: "Pantalón blanco", swatch: "#FAFAF7" },
      { nombre: "Alpargatas", swatch: "#C8B89A" },
    ],
    image: "/looks/marinero-casual.png",
  },
  {
    id: "tailoring-moderno",
    nombre: "Tailoring moderno",
    vibe: "sastrería con aire nuevo",
    tags: ["estructurado", "elegante", "pulido"],
    prendas: [
      { nombre: "Blazer gris topo", swatch: "#7A7268" },
      { nombre: "Pantalón crema", swatch: "#EFE9DC" },
      { nombre: "Camiseta blanca", swatch: "#FAFAF7" },
    ],
    image: "/looks/tailoring-moderno.png",
  },
];

export const LOOK_IDS = new Set(LOOKS.map((l) => l.id));

// Taste vector: tags de looks con ❤️ suman, los de ✕ restan. Se quedan los
// positivos, ordenados por score, máximo 8 — suficiente contexto de prompt.
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
