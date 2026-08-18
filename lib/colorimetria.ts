// Quiz de colorimetría sin selfie: 6 preguntas → 4 estaciones.
// Modelo simple de dos ejes: calidez (warm/cool) y profundidad (light/deep).
// Cada opción suma puntos a un eje; el signo del total decide la estación.
// Es deliberadamente sencillo: el valor está en la paleta near-face que
// recibe el motor, no en precisión de colorimetrista profesional.

export type Season = "primavera" | "verano" | "otono" | "invierno";

const SEASON_KEYS: Season[] = ["primavera", "verano", "otono", "invierno"];

// Normaliza una estación/guiño a la clave canónica en minúsculas. Data legacy de
// la colorimetría por foto guardó valores con mayúscula ("Invierno"), que no
// matcheaban SEASONS → el motor descartaba los colores prestados del guiño.
// Tolera eso (y acentos en "otoño") al leer; null si no es una estación válida.
export function normSeason(s: string | null | undefined): Season | null {
  if (!s) return null;
  const k = s.toLowerCase().replace("ñ", "n") as Season;
  return SEASON_KEYS.includes(k) ? k : null;
}

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
    // Señal cálido/frío Y el "guiño" de frontera: el oro empuja a otoño/primavera,
    // así que responder oro puede dar "invierno con guiños de otoño" (más fino que
    // invierno a secas). "No sé" pesa 0 (para quien no lo tiene claro). Ya no
    // contradice: el resultado muestra "ambos" en la frontera (metalForSeason).
    id: "metal",
    question: "¿Qué te queda mejor: el oro o la plata?",
    options: [
      { id: "plata", label: "Plata", w: -2 },
      { id: "oro", label: "Oro", w: 2 },
      { id: "ambos", label: "No sé / me quedan igual" },
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
// Hex plano del punto de metal (oro/plata) — DATO de colorimetría (como los
// swatches), no un token de UI. Único lugar donde vive; los componentes lo
// referencian en vez de hardcodear el hex.
export const METAL_HEX: Record<"oro" | "plata", string> = {
  oro: "#C8973D",
  plata: "#C2C2CC",
};

const WARM_SEASONS: Season[] = ["otono", "primavera"];
export function seasonMetal(
  primary: Season | null,
  flow: Season | null
): "oro" | "plata" {
  const p = normSeason(primary);
  const f = normSeason(flow);
  const warm =
    (p !== null && WARM_SEASONS.includes(p)) ||
    (f !== null && WARM_SEASONS.includes(f));
  return warm ? "oro" : "plata";
}

// Metal con matiz de frontera: si la base y el flow caen en lados OPUESTOS del
// eje cálido/frío (p. ej. invierno base + otoño flow), los DOS metales le van —
// es exactamente el caso de la persona-frontera, que suele preferir el oro pero
// la plata tampoco la traiciona. Fuera de la frontera, el metal es uno solo.
export function metalForSeason(
  primary: Season | null,
  flow: Season | null
): "oro" | "plata" | "ambos" {
  const p = normSeason(primary);
  const f = normSeason(flow);
  const warmP = p !== null && WARM_SEASONS.includes(p);
  const warmF = f !== null ? WARM_SEASONS.includes(f) : warmP;
  if (warmP !== warmF) return "ambos";
  return warmP ? "oro" : "plata";
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
  const s = normSeason(season) ?? season;
  const f = normSeason(flow);
  if (f) {
    const sub = SUBSEASON[s]?.[f];
    if (sub) return sub;
  }
  return BASE_LABEL[s];
}

// --- Sistema de 12 sub-estaciones por PROFUNDIDAD (para la Cartera) ---
// Tatiana pidió Light/Medium/Dark × estación. El quiz ya mide profundidad en el
// eje `d`; lo bucketizamos en 3 tiers. Esto convive con `flow` (que usa el motor
// de outfits): aquí mandan (season, depth). No requiere columna nueva — se deriva
// de palette_quiz al vuelo; si no hay quiz, cae a "medium".
export type Depth = "light" | "medium" | "dark";
export type SubSeason = `${Season}-${Depth}`;

const DEPTH_LABEL: Record<Depth, string> = {
  light: "claro",
  medium: "medio",
  dark: "oscuro",
};

export function computeDepth(answers: Record<string, string> | null): Depth {
  if (!answers) return "medium";
  let deep = 0;
  for (const q of QUIZ) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    deep += opt?.d ?? 0;
  }
  if (deep <= -2) return "light";
  if (deep >= 2) return "dark";
  return "medium";
}

// Puente guiño→profundidad: cuando no hay quiz MC (p.ej. colorimetría por foto),
// derivamos la profundidad del flow oficial para que la Cartera quede coherente
// con el pasaporte/motor (en vez de caer siempre a "medio"). Se apoya en las
// etiquetas de SUBSEASON: "profundo" → oscuro, "suave/claro" → claro, resto medio.
export function flowToDepth(season: Season, flow: Season | null): Depth {
  const s = normSeason(season) ?? season;
  const f = normSeason(flow);
  if (!f) return "medium";
  const label = (SUBSEASON[s]?.[f] ?? "").toLowerCase();
  if (label.includes("profund")) return "dark";
  if (label.includes("suave") || label.includes("clar")) return "light";
  return "medium";
}

// ¿palette_quiz son respuestas reales del quiz MC, o un objeto de otra fuente
// (la colorimetría por foto guardó {source, por_que, confianza}, sin claves del
// quiz)? Solo cuenta como quiz si trae al menos una respuesta de QUIZ.
function isMcQuiz(quiz: Record<string, string> | null): boolean {
  return !!quiz && QUIZ.some((q) => typeof quiz[q.id] === "string");
}

// Profundidad para la Cartera: del quiz MC si lo hizo; si no, del guiño oficial.
export function carteraDepth(
  quiz: Record<string, string> | null,
  season: Season,
  flow: Season | null
): Depth {
  return isMcQuiz(quiz) ? computeDepth(quiz) : flowToDepth(season, flow);
}

// "Otoño oscuro", "Verano claro" — nombre de la sub-estación de 12.
export function subSeasonLabel(season: Season, depth: Depth): string {
  return `${BASE_LABEL[season]} ${DEPTH_LABEL[depth]}`;
}

export function subSeasonKey(season: Season, depth: Depth): SubSeason {
  return `${season}-${depth}`;
}

// Las dos vecinas a las que una estación puede inclinarse (para el selector
// manual de "con un pie en…"). Coincide con los flows que produce el quiz.
export function seasonNeighbors(season: Season): Season[] {
  return Object.keys(SUBSEASON[season]) as Season[];
}

export function seasonPalette(primary: Season, flow: Season | null) {
  // Defensivo: si llega una estación inválida (dato corrupto), no reventar el
  // motor — devolver vacío y seguir. Mejor un look sin paleta que cero looks.
  // normSeason rescata data legacy con mayúscula ("Invierno") que si no, dejaba
  // los colores prestados del guiño vacíos en la generación de outfits.
  const base = SEASONS[normSeason(primary) ?? primary];
  const flwKey = normSeason(flow);
  const flw = flwKey ? SEASONS[flwKey] : null;

  const mejores = base ? base.colores : [];
  const prestados = flw ? flw.colores.filter((c) => c.transfiere !== false) : [];
  const evita = base ? base.evita : [];

  // EL COLOR QUE EL GUIÑO REGALA Y LA BASE EVITA NO ES BUENO NI MALO: SALE DE
  // LAS DOS LISTAS.
  //
  // El caso que lo destapó: un invierno con guiño de otoño recibía "Oliva"
  // #6B7A4C entre sus prestados Y "Oliva apagado" #6B7A4C en su evita — el
  // MISMO hex en los dos lados. El motor leía "te funciona" y el juez castigaba
  // "te apaga la cara"; ninguno de los dos se equivocaba, el dato se
  // contradecía. Pasa en tres combinaciones y le tocaba a 6 de 24 perfiles
  // reales: el oliva en invierno+otoño y el NEGRO en primavera+invierno y
  // verano+invierno.
  //
  // POR QUÉ NEUTRO Y NO "GANA UNO DE LOS DOS": porque la colorimetría de este
  // producto tiene TRES grupos, no dos — los que favorecen, los que juegan en
  // contra, y los que ni una cosa ni la otra, que no están vetados (Roberto,
  // 2026-08-18). Evidencia contradictoria es la definición del tercero. Elegir
  // un ganador exigiría saber teoría que este archivo no documenta y adivinar
  // la intención de quien capturó el dato; dejarlo sin marcar no afirma nada
  // que no se pueda sostener, que es lo único seguro con datos en conflicto.
  //
  // POR QUÉ NO SE ARREGLA CON `transfiere: false`, que es el mecanismo que ya
  // existe y que alguien YA usó bien para Camel y Mostaza (los dos están en
  // otoño y en la evita de invierno): ese flag es GLOBAL, y el conflicto no lo
  // es. El negro está en los colores de invierno y en la evita de primavera y
  // verano, pero NO en la de otoño — marcarlo sin cruce se lo quitaría a los
  // cuatro perfiles de otoño+invierno que lo reciben con razón. El conflicto
  // depende del par {base, guiño}, así que la resolución tiene que depender de
  // él también. `transfiere: false` sigue siendo lo correcto para un color que
  // de verdad no cruza hacia nadie.
  const hex = (c: { hex: string }) => c.hex.trim().toUpperCase();
  const buenos = new Set([...mejores, ...prestados].map(hex));
  const enConflicto = new Set(evita.map(hex).filter((h) => buenos.has(h)));
  if (enConflicto.size === 0) return { mejores, prestados, evita };

  const limpio = <T extends { hex: string }>(cs: T[]) =>
    cs.filter((c) => !enConflicto.has(hex(c)));
  // `mejores` también se limpia aunque hoy ninguna estación se contradiga a sí
  // misma: el contrato de esta función es no devolver NUNCA una paleta que se
  // contradiga. Que ese caso no exista lo vigila el test, y a gritos — ahí sí
  // sería un error de dato, no una frontera.
  return { mejores: limpio(mejores), prestados: limpio(prestados), evita: limpio(evita) };
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
