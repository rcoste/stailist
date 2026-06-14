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
  segment: "hombre" | "mujer" | "unisex";
  prendas: { nombre: string; swatch: string }[];
  image: string | null;
};

export const LOOKS: Look[] = [
  {
    id: "blanco-mezclilla",
    nombre: "Blanco + mezclilla",
    vibe: "fresco y sin esfuerzo",
    tags: ["casual", "minimalista", "fresco"],
    segment: "unisex",
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
    segment: "unisex",
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
    segment: "hombre",
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
    segment: "mujer",
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
    segment: "mujer",
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
    segment: "unisex",
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
    segment: "mujer",
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
    segment: "unisex",
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
    segment: "mujer",
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
    segment: "unisex",
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
    segment: "unisex",
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
    segment: "unisex",
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
    segment: "hombre",
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
    segment: "unisex",
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
    segment: "hombre",
    prendas: [
      { nombre: "Blazer gris topo", swatch: "#7A7268" },
      { nombre: "Pantalón crema", swatch: "#EFE9DC" },
      { nombre: "Camiseta blanca", swatch: "#FAFAF7" },
    ],
    image: "/looks/tailoring-moderno.png",
  },
  {
    id: "preppy",
    nombre: "Preppy clásico",
    vibe: "pulido con aire de campus",
    tags: ["preppy", "clasico", "pulido"],
    segment: "unisex",
    prendas: [
      { nombre: "Camisa blanca", swatch: "#FAFAF7" },
      { nombre: "Suéter marino", swatch: "#27425F" },
      { nombre: "Chinos beige", swatch: "#C8B89A" },
    ],
    image: "/looks/preppy.png",
  },
  {
    id: "vintage-retro",
    nombre: "Vintage retro",
    vibe: "con historia y sin pose",
    tags: ["vintage", "retro", "relajado"],
    segment: "unisex",
    prendas: [
      { nombre: "Chamarra de mezclilla", swatch: "#4A6B8A" },
      { nombre: "Playera gráfica", swatch: "#D9CBB5" },
      { nombre: "Jeans", swatch: "#3A5A7A" },
    ],
    image: "/looks/vintage-retro.png",
  },
  {
    id: "monocromatico-color",
    nombre: "Monocromático en color",
    vibe: "un solo tono, todo el impacto",
    tags: ["colorido", "atrevido", "moderno"],
    segment: "unisex",
    prendas: [
      { nombre: "Camisa oliva", swatch: "#6B7A4C" },
      { nombre: "Pantalón oliva", swatch: "#6B7A4C" },
      { nombre: "Tenis blancos", swatch: "#FAFAF7" },
    ],
    image: "/looks/monocromatico-color.png",
  },
  {
    id: "sastre-relajado",
    nombre: "Sastre relajado",
    vibe: "saco sí, corbata jamás",
    tags: ["estructurado", "relajado", "pulido"],
    segment: "hombre",
    prendas: [
      { nombre: "Blazer beige", swatch: "#C2B391" },
      { nombre: "Camiseta blanca", swatch: "#FAFAF7" },
      { nombre: "Pantalón marino", swatch: "#27425F" },
    ],
    image: "/looks/sastre-relajado.png",
  },
  {
    id: "edgy-urbano",
    nombre: "Edgy urbano",
    vibe: "cuero, negro y actitud",
    tags: ["atrevido", "urbano", "edgy"],
    segment: "hombre",
    prendas: [
      { nombre: "Chamarra de cuero", swatch: "#1A1A1A" },
      { nombre: "Playera negra", swatch: "#242424" },
      { nombre: "Jeans negros", swatch: "#1F1F1F" },
    ],
    image: "/looks/edgy-urbano.png",
  },
  {
    id: "sporty-chic",
    nombre: "Sporty chic",
    vibe: "deportivo pero con clase",
    tags: ["deportivo", "atrevido", "moderno"],
    segment: "mujer",
    prendas: [
      { nombre: "Leggings negros", swatch: "#1A1A1A" },
      { nombre: "Blazer gris", swatch: "#8A8784" },
      { nombre: "Tenis blancos", swatch: "#FAFAF7" },
    ],
    image: "/looks/sporty-chic.png",
  },
  {
    id: "romantico-fresco",
    nombre: "Romántico fresco",
    vibe: "flores y brisa de primavera",
    tags: ["romantico", "fresco", "suave"],
    segment: "mujer",
    prendas: [
      { nombre: "Vestido floral", swatch: "#D4A5B5" },
      { nombre: "Sandalias", swatch: "#C8B89A" },
    ],
    image: "/looks/romantico-fresco.png",
  },
  {
    id: "business-casual",
    nombre: "Business casual",
    vibe: "lista para la junta y para el after",
    tags: ["clasico", "pulido", "elegante"],
    segment: "mujer",
    prendas: [
      { nombre: "Blusa de seda", swatch: "#EFE9DC" },
      { nombre: "Pantalón sastre", swatch: "#3A3A38" },
      { nombre: "Tacones bajos", swatch: "#1A1A1A" },
    ],
    image: "/looks/business-casual.png",
  },
];

export const LOOK_IDS = new Set(LOOKS.map((l) => l.id));

// Looks del género elegido + los unisex, con la imagen de gente resuelta para
// ese género: los unisex tienen una versión por género (<id>-<genero>.png);
// los específicos una sola (<id>.png).
export function looksForGender(gender: "hombre" | "mujer"): Look[] {
  return LOOKS.filter(
    (l) => l.segment === "unisex" || l.segment === gender
  ).map((l) => ({
    ...l,
    image:
      l.segment === "unisex" ? `/looks/${l.id}-${gender}.png` : `/looks/${l.id}.png`,
  }));
}

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
