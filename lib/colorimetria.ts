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

export type PaletteColor = {
  nombre: string;
  hex: string;
  // false = color tan propio de esta estación que NO "presta" a una vecina
  // (ej. el blanco puro de invierno no le sirve a un otoño de base). Sin la
  // flag, el color sí cruza la frontera y aparece como "prestado".
  transfiere?: boolean;
};

// Paleta near-face por estación. Los hex son COLORES DE ROPA (datos para
// chips y contexto del motor), no tokens de UI. La línea `reveal` lidera en
// voz amiga cool — la estación es vocabulario interno, no jerga hacia ella.
// `evita`: lo que APAGA a esa estación (el extremo claro/lavado para las
// profundas, lo pesado/terroso para las claras). Se muestra con voz que cuida,
// y el motor lo respeta como regla dura.
export const SEASONS: Record<
  Season,
  {
    label: string;
    reveal: string;
    colores: PaletteColor[];
    evita: { nombre: string; hex: string }[];
  }
> = {
  primavera: {
    label: "primavera",
    reveal: "Los colores vivos y cálidos te encienden la cara.",
    colores: [
      { nombre: "Coral", hex: "#E8806E" },
      { nombre: "Turquesa", hex: "#62B6CB" },
      { nombre: "Verde fresco", hex: "#7FB069" },
      { nombre: "Dorado suave", hex: "#F2C14E" },
      { nombre: "Crema", hex: "#F5E6CC", transfiere: false },
    ],
    evita: [
      { nombre: "Negro", hex: "#1A1A1A" },
      { nombre: "Gris pizarra", hex: "#4A4E54" },
      { nombre: "Ciruela apagado", hex: "#4B3B52" },
      { nombre: "Malva grisáceo", hex: "#9E8FA0" },
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
      { nombre: "Gris perla", hex: "#E8E2DA", transfiere: false },
    ],
    evita: [
      { nombre: "Naranja", hex: "#E5712B" },
      { nombre: "Mostaza", hex: "#C8973D" },
      { nombre: "Camel", hex: "#B08D57" },
      { nombre: "Negro duro", hex: "#1A1A1A" },
    ],
  },
  otono: {
    label: "otoño",
    reveal: "Los tonos tierra te encienden la cara.",
    colores: [
      { nombre: "Oliva", hex: "#6B7A4C" },
      { nombre: "Camel", hex: "#B08D57", transfiere: false },
      { nombre: "Vino", hex: "#722F37" },
      { nombre: "Mostaza", hex: "#C8973D", transfiere: false },
      { nombre: "Chocolate", hex: "#5C4A38" },
    ],
    evita: [
      { nombre: "Rosa bebé", hex: "#F3C6D2" },
      { nombre: "Lavanda", hex: "#C9BEE0" },
      { nombre: "Menta", hex: "#B8E0CC" },
      { nombre: "Blanco óptico", hex: "#FCFCFA" },
    ],
  },
  invierno: {
    label: "invierno",
    reveal: "Lo intenso te queda: contrastes fuertes y colores joya.",
    colores: [
      { nombre: "Negro", hex: "#1A1A1A" },
      { nombre: "Blanco puro", hex: "#FAFAF7", transfiere: false },
      { nombre: "Azul rey", hex: "#2E4FA3" },
      { nombre: "Rubí", hex: "#8E2438" },
      { nombre: "Esmeralda", hex: "#3D6B5E" },
    ],
    evita: [
      { nombre: "Camel", hex: "#B08D57" },
      { nombre: "Mostaza", hex: "#C8973D" },
      { nombre: "Oliva apagado", hex: "#6B7A4C" },
      { nombre: "Beige amarillento", hex: "#D8C6A0" },
    ],
  },
};

// La paleta resuelta de una persona: sus mejores (estación base), los tonos
// PRESTADOS de su flow que sí cruzan, y lo que debe evitar. `flow` null = caso
// claro, sin prestados.
// Metal de la persona: oro (cálido) o plata (frío). Las estaciones cálidas
// (otoño, primavera) van con oro; las frías (invierno, verano) con plata. En la
// frontera, si la base es fría pero el flow es cálido (o al revés), gana la
// calidez: el oro favorece y suele ser lo que prefiere la persona cálida-frontera.
const WARM_SEASONS: Season[] = ["otono", "primavera"];
export function seasonMetal(
  primary: Season | null,
  flow: Season | null
): "oro" | "plata" {
  const warm =
    (primary !== null && WARM_SEASONS.includes(primary)) ||
    (flow !== null && WARM_SEASONS.includes(flow));
  return warm ? "oro" : "plata";
}

// Nombre de sub-estación (sistema de 12): estación + hacia qué vecina se
// inclina (el `flow`). "Invierno profundo" = invierno con un pie en otoño.
// Sin flow = la estación a secas. Es solo presentación: el dato (season+flow)
// ya lo calcula el quiz; aquí solo le ponemos el nombre rico.
const BASE_LABEL: Record<Season, string> = {
  primavera: "Primavera",
  verano: "Verano",
  otono: "Otoño",
  invierno: "Invierno",
};

const SUBSEASON: Record<Season, Partial<Record<Season, string>>> = {
  invierno: { otono: "Invierno profundo", verano: "Invierno suave" },
  verano: { primavera: "Verano claro", invierno: "Verano profundo" },
  otono: { invierno: "Otoño profundo", primavera: "Otoño suave" },
  primavera: { verano: "Primavera clara", otono: "Primavera cálida" },
};

export function seasonDisplayLabel(season: Season, flow: Season | null): string {
  if (flow) {
    const sub = SUBSEASON[season]?.[flow];
    if (sub) return sub;
  }
  return BASE_LABEL[season];
}

// Las dos vecinas a las que una estación puede inclinarse (para el selector
// manual de "con un pie en…"). Coincide con los flows que produce el quiz.
export function seasonNeighbors(season: Season): Season[] {
  return Object.keys(SUBSEASON[season]) as Season[];
}

export function seasonPalette(primary: Season, flow: Season | null) {
  // Defensivo: si llega una estación inválida (dato corrupto), no reventar el
  // motor — devolver vacío y seguir. Mejor un look sin paleta que cero looks.
  const base = SEASONS[primary];
  const flw = flow ? SEASONS[flow] : null;
  return {
    mejores: base ? base.colores : [],
    prestados: flw ? flw.colores.filter((c) => c.transfiere !== false) : [],
    evita: base ? base.evita : [],
  };
}

// El quiz no es binario: si un eje queda en la frontera (|valor| <= 1), la
// persona "fluye" a la estación vecina al cruzar ESE eje. Devuelve base + flow
// (flow null si está claramente dentro de una estación).
export function computeSeasonWithFlow(answers: Record<string, string>): {
  season: Season;
  flow: Season | null;
} {
  let warm = 0;
  let deep = 0;
  for (const q of QUIZ) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt) continue;
    warm += opt.w ?? 0;
    deep += opt.d ?? 0;
  }
  const season: Season =
    warm >= 0 ? (deep > 0 ? "otono" : "primavera") : deep > 0 ? "invierno" : "verano";

  const warmBorder = Math.abs(warm) <= 1;
  const deepBorder = Math.abs(deep) <= 1;
  let flow: Season | null = null;
  if (warmBorder && (Math.abs(warm) <= Math.abs(deep) || !deepBorder)) {
    // cruza calidez: misma profundidad, calidez opuesta
    flow =
      deep > 0
        ? warm >= 0
          ? "invierno"
          : "otono"
        : warm >= 0
          ? "verano"
          : "primavera";
  } else if (deepBorder) {
    // cruza profundidad: misma calidez, profundidad opuesta
    flow =
      warm >= 0
        ? deep > 0
          ? "primavera"
          : "otono"
        : deep > 0
          ? "verano"
          : "invierno";
  }
  if (flow === season) flow = null;
  return { season, flow };
}

// Lectura del ensemble de foto, en la forma mínima que necesita la fusión.
export type AnalysisRead =
  | { kind: "confident"; season: Season }
  | { kind: "border"; season: Season; flow: Season }
  | { kind: "baja" };

// Fusiona las TRES señales: el ensemble de la foto (Claude+Gemini) + el quiz
// que la persona contestó MIENTRAS se analizaba. El quiz es el desempate:
// cuando los dos modelos discrepan (frontera), el que coincide con el quiz se
// vuelve la base. Devuelve null solo si no hay ninguna señal útil.
export function mergeColorimetria(
  analysis: AnalysisRead | null,
  quiz: { season: Season; flow: Season | null } | null
): { season: Season; flow: Season | null } | null {
  const analysisUseful = analysis && analysis.kind !== "baja";

  // Foto inservible (mala luz o falló) → manda el quiz.
  if (!analysisUseful) {
    return quiz ? { season: quiz.season, flow: quiz.flow } : null;
  }

  // Sin quiz (lo saltó) → manda la foto tal cual.
  if (!quiz) {
    return analysis.kind === "confident"
      ? { season: analysis.season, flow: null }
      : { season: analysis.season, flow: analysis.flow };
  }

  // Ambos presentes.
  if (analysis.kind === "confident") {
    // Coinciden → confianza; el quiz puede aportar un flow.
    if (quiz.season === analysis.season) {
      return { season: analysis.season, flow: quiz.flow };
    }
    // Discrepan: los 2 modelos coincidieron (señal fuerte) = base; el quiz
    // aporta la dirección del flow.
    return { season: analysis.season, flow: quiz.season };
  }

  // Frontera: el quiz desempata entre las dos candidatas.
  const { season: base, flow } = analysis;
  if (quiz.season === flow) return { season: flow, flow: base }; // quiz = Gemini
  if (quiz.season === base) return { season: base, flow }; // quiz = Claude
  return { season: base, flow }; // quiz nombró otra: conserva la frontera
}
