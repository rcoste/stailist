// Quiz de colorimetría sin selfie: 6 preguntas → 4 estaciones.
// Modelo simple de dos ejes: calidez (warm/cool) y profundidad (light/deep).
// Cada opción suma puntos a un eje; el signo del total decide la estación.
// Es deliberadamente sencillo: el valor está en la paleta near-face que
// recibe el motor, no en precisión de colorimetrista profesional.

export type Season = "primavera" | "verano" | "otono" | "invierno";

export type QuizOption = {
  id: string;
  label: string;
  w?: number; // calidez: + cálido, − frío
  d?: number; // profundidad: + profundo, − claro
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: QuizOption[];
};

export const QUIZ: QuizQuestion[] = [
  {
    id: "venas",
    question: "Mírate las venas de la muñeca con buena luz, ¿cómo se ven?",
    options: [
      { id: "azules", label: "Azuladas o moradas", w: -2 },
      { id: "verdes", label: "Verdosas", w: 2 },
      { id: "mixtas", label: "Ni idea, un poco de todo" },
    ],
  },
  {
    id: "sol",
    question: "Cuando te da el sol, tu piel…",
    options: [
      { id: "quema", label: "Se pone roja rapidito", w: -1 },
      { id: "broncea", label: "Se broncea fácil, casi sin quemarse", w: 1 },
      { id: "ambas", label: "Primero roja, luego doradita" },
    ],
  },
  {
    id: "cabello",
    question: "¿Tu cabello natural?",
    options: [
      { id: "oscuro", label: "Negro o castaño muy oscuro", d: 2 },
      { id: "medio", label: "Castaño medio", d: 1 },
      { id: "claro", label: "Castaño claro o rubio oscuro", d: -1 },
      { id: "rubio", label: "Rubio o muy claro", d: -2 },
      { id: "rojizo", label: "Rojizo o cobrizo", w: 2 },
    ],
  },
  {
    id: "ojos",
    question: "¿Tus ojos?",
    options: [
      { id: "oscuros", label: "Café oscuro o negro", d: 2 },
      { id: "miel", label: "Café medio o miel", w: 1, d: 1 },
      { id: "verdes", label: "Verdes o avellana", w: 1, d: -1 },
      { id: "azules", label: "Azules o grises", w: -1, d: -1 },
    ],
  },
  {
    id: "metal",
    question: "¿Qué joyería te enciende más la cara?",
    options: [
      { id: "plata", label: "Plata", w: -2 },
      { id: "oro", label: "Oro", w: 2 },
      { id: "ambos", label: "Las dos me quedan igual" },
    ],
  },
  {
    id: "cumplidos",
    question:
      "Cuando estrenas algo y te llueven los cumplidos, ¿de qué color suele ser?",
    options: [
      {
        id: "intensos",
        label: "Blanco, negro o colores intensos (rojo, azul rey)",
        w: -1,
        d: 1,
      },
      { id: "pasteles", label: "Pasteles y tonos suaves", w: -1, d: -1 },
      { id: "tierra", label: "Tierra: camel, oliva, vino", w: 1, d: 1 },
      {
        id: "vivos",
        label: "Vivos y cálidos: coral, turquesa, verde fresco",
        w: 1,
        d: -1,
      },
    ],
  },
];

// Respuestas → estación. Empates caen del lado cálido/claro a propósito:
// las paletas de primavera/verano son las más indulgentes si nos equivocamos.
export function computeSeason(answers: Record<string, string>): Season {
  let warm = 0;
  let deep = 0;
  for (const q of QUIZ) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt) continue;
    warm += opt.w ?? 0;
    deep += opt.d ?? 0;
  }
  if (warm >= 0) return deep > 0 ? "otono" : "primavera";
  return deep > 0 ? "invierno" : "verano";
}

export function isQuizComplete(answers: Record<string, string>): boolean {
  return QUIZ.every((q) => q.options.some((o) => o.id === answers[q.id]));
}

// Paleta near-face por estación. Los hex son COLORES DE ROPA (datos para
// chips y contexto del motor), no tokens de UI. La línea `reveal` lidera en
// voz amiga cool — la estación es vocabulario interno, no jerga hacia ella.
export const SEASONS: Record<
  Season,
  { label: string; reveal: string; colores: { nombre: string; hex: string }[] }
> = {
  primavera: {
    label: "primavera",
    reveal: "Los colores vivos y cálidos te encienden la cara.",
    colores: [
      { nombre: "Coral", hex: "#E8806E" },
      { nombre: "Turquesa", hex: "#62B6CB" },
      { nombre: "Verde fresco", hex: "#7FB069" },
      { nombre: "Dorado suave", hex: "#F2C14E" },
      { nombre: "Crema", hex: "#F5E6CC" },
    ],
  },
  verano: {
    label: "verano",
    reveal: "Los tonos suaves y frescos son lo tuyo.",
    colores: [
      { nombre: "Lavanda", hex: "#A5A8D4" },
      { nombre: "Rosa empolvado", hex: "#D4A5B5" },
      { nombre: "Azul grisáceo", hex: "#8FA8C8" },
      { nombre: "Salvia", hex: "#B8C8C0" },
      { nombre: "Gris perla", hex: "#E8E2DA" },
    ],
  },
  otono: {
    label: "otoño",
    reveal: "Los tonos tierra te encienden la cara.",
    colores: [
      { nombre: "Oliva", hex: "#6B7A4C" },
      { nombre: "Camel", hex: "#B08D57" },
      { nombre: "Vino", hex: "#722F37" },
      { nombre: "Mostaza", hex: "#C8973D" },
      { nombre: "Chocolate", hex: "#5C4A38" },
    ],
  },
  invierno: {
    label: "invierno",
    reveal: "Lo intenso te queda: contrastes fuertes y colores joya.",
    colores: [
      { nombre: "Negro", hex: "#1A1A1A" },
      { nombre: "Blanco puro", hex: "#FAFAF7" },
      { nombre: "Azul rey", hex: "#2E4FA3" },
      { nombre: "Rubí", hex: "#8E2438" },
      { nombre: "Esmeralda", hex: "#3D6B5E" },
    ],
  },
};
