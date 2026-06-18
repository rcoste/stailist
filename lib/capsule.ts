// Clóset cápsula v2 — lógica de dominio (pura, sin IA ni DB; segura para cliente).
//
// Modelo de dos capas:
//   Capa 1 (capsule_target): la cápsula IDEAL = lista de prendas concretas y
//     nombradas, generada de gustos + colorimetría + vida. Libre del catálogo.
//   Capa 2 (capsule_match): por cada prenda ideal, si el clóset real ya la cubre.
//     El match fino lo hace la IA (ver lib/engine/capsule-match) y se CACHEA con
//     una firma del clóset; aquí solo viven los tipos y los derivados puros.

export const CATEGORIES = [
  "top",
  "bottom",
  "calzado",
  "abrigo",
  "vestido",
  "accesorio",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FORMALIDADES = ["casual", "formal-casual", "formal"] as const;
export type Formalidad = (typeof FORMALIDADES)[number];

// --- Assessment de vida ---------------------------------------------------

export type AssessmentQuestion = {
  id: string;
  label: string;
  help?: string;
  options: { value: string; label: string }[];
};

// 5 preguntas de botón. Junto con gustos y colorimetría, definen la cápsula ideal.
export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "trabajo",
    label: "¿Cómo es tu día entre semana?",
    options: [
      { value: "oficina_formal", label: "Oficina formal" },
      { value: "oficina_casual", label: "Oficina creativa o casual" },
      { value: "remoto", label: "Trabajo desde casa" },
      { value: "fisico", label: "De pie o con uniforme" },
      { value: "estudio", label: "Estudio" },
    ],
  },
  {
    id: "eventos",
    label: "¿Qué tan seguido tienes planes de “arréglate”?",
    help: "Cenas, bodas, presentaciones.",
    options: [
      { value: "nunca", label: "Casi nunca" },
      { value: "aveces", label: "De vez en cuando" },
      { value: "seguido", label: "Seguido" },
    ],
  },
  {
    id: "actividades",
    label: "Fuera del trabajo, ¿qué pide ropa especial?",
    options: [
      { value: "gym", label: "Gym o deporte" },
      { value: "noche", label: "Salir de noche" },
      { value: "aire", label: "Aire libre" },
      { value: "ninguna", label: "Nada en particular" },
    ],
  },
  {
    id: "clima",
    label: "¿Cómo es el clima donde vives?",
    options: [
      { value: "frio", label: "Frío buena parte del año" },
      { value: "templado", label: "Templado" },
      { value: "calor", label: "Calor casi siempre" },
    ],
  },
  {
    id: "estilo",
    label: "Cuando puedes elegir, ¿cómo te gusta vestir?",
    options: [
      { value: "comodo", label: "Cómodo y mínimo" },
      { value: "arreglado", label: "Siempre arreglado" },
      { value: "varia", label: "Depende mucho del día" },
    ],
  },
];

export type LifestyleAnswers = Record<string, string>;

// Resumen en lenguaje natural (voz amiga) para el contexto del motor.
export function lifestyleSummary(answers: LifestyleAnswers | null): string | null {
  if (!answers || Object.keys(answers).length === 0) return null;
  const label = (qid: string) => {
    const q = ASSESSMENT_QUESTIONS.find((x) => x.id === qid);
    const opt = q?.options.find((o) => o.value === answers[qid]);
    return opt?.label.toLowerCase() ?? null;
  };
  const parts: string[] = [];
  const trabajo = label("trabajo");
  if (trabajo) parts.push(`su día es ${trabajo}`);
  const eventos = answers["eventos"];
  if (eventos === "seguido") parts.push("tiene eventos de arreglarse seguido");
  else if (eventos === "aveces") parts.push("a veces tiene eventos de arreglarse");
  const actividades = label("actividades");
  if (actividades && answers["actividades"] !== "ninguna")
    parts.push(`fuera del trabajo: ${actividades}`);
  const estilo = label("estilo");
  if (estilo) parts.push(`le gusta vestir ${estilo}`);
  if (parts.length === 0) return null;
  return `Su vida: ${parts.join("; ")}.`;
}

// --- Capa 1: la cápsula ideal (prendas concretas) -------------------------

export type CapsuleItem = {
  nombre: string; // etiqueta humana: "Cuello tortuga azul marino"
  tipo: string; // clave de prenda para el match: "cuello-tortuga"
  category: Category;
  colorFamilia: string; // "marino", "neutro claro", etc. (dentro de su paleta)
  formalidad: Formalidad;
  temporada: string; // "todo-el-año" | "calor" | "frio"
  prioridad: number; // 1 = más importante
  porque: string; // una línea: por qué la necesita
};

export type CapsuleTarget = { version: 2; items: CapsuleItem[] };

// --- Capa 2: el match contra el clóset ------------------------------------

// Una prenda del clóset, aplanada para el prompt del match.
export type ClosetItemLite = {
  id: string;
  nombre: string;
  category: string;
  color: string;
  formalidad: string;
};

// Resultado por prenda ideal (alineado por índice con target.items). Tres estados:
//   "tienes"   — ya la tienes en forma usable (tipo + color compatible + uso).
//   "parecido" — tienes la prenda correcta pero con un matiz (otro neutro, casi-
//                equivalente). No es hueco; es refinamiento. Cuenta como cubierta.
//   "falta"    — no la tienes en ninguna forma usable. Hueco real.
export type MatchStatus = "tienes" | "parecido" | "falta";
export type MatchEntry = { status: MatchStatus; by: string | null };

export type CapsuleMatch = {
  signature: string; // firma del clóset con el que se calculó
  entries: MatchEntry[];
};

// Normaliza una entrada (tolera el formato binario viejo {covered} por si quedó
// algún match cacheado de la versión anterior).
function normalizeEntry(e: unknown): MatchEntry {
  const o = (e ?? {}) as { status?: MatchStatus; covered?: boolean; by?: string | null };
  const status: MatchStatus = o.status ?? (o.covered ? "tienes" : "falta");
  return { status, by: o.by ?? null };
}

// Firma del clóset: id + categoría + formalidad por prenda, ordenado. Cambia si
// agregas/quitas prendas O si editas su categoría/formalidad → "recalcular".
// Ambos lados (clóset y match) la calculan con estos mismos campos, que se
// derivan idéntico (categoría del arquetipo/attrs, formalidad de attrs).
export function closetSignature(
  items: { id: string; category: string; formalidad: string }[]
): string {
  return items
    .map((i) => `${i.id}:${i.category}:${i.formalidad}`)
    .sort()
    .join(",");
}

// --- Derivados puros para la tarjeta --------------------------------------

export type CapsuleView = {
  haveCount: number; // "tienes" + "parecido" (lo que NO necesitas comprar)
  totalCount: number;
  coveragePct: number;
  faltan: CapsuleItem[]; // huecos reales (status "falta"), por prioridad
  parecidos: { item: CapsuleItem; by: string | null }[]; // refinamientos, por prioridad
};

// Decisión del usuario sobre una prenda "parecido": la acepta como sustituto
// (cuenta como cubierta) o la rechaza (quiere la ideal → te falta).
export type CapsuleDecision = "accept" | "reject";
export type CapsuleOverrides = Record<string, CapsuleDecision>; // clave = índice

// Estado EFECTIVO = lo que dijo el match + la decisión del usuario:
//   parecido + "Sí" → cumplida (cuenta como "tienes", se va a Ya lo tienes).
//   parecido + "No" → hueco real (cuenta como "falta", se va a Te falta).
//   parecido sin decidir → sigue "parecido" (pendiente). NO cuenta hasta el Sí.
function effectiveStatus(
  base: MatchStatus | "pendiente",
  decision: CapsuleDecision | null
): MatchStatus | "pendiente" {
  if (base === "parecido") {
    if (decision === "accept") return "tienes";
    if (decision === "reject") return "falta";
    return "parecido";
  }
  return base;
}

// Lista COMPLETA de la cápsula, en orden de prioridad, cada prenda con su estado
// (para la pantalla dedicada). Si aún no hay match, todas quedan "pendiente".
export type CapsuleRow = {
  item: CapsuleItem;
  index: number; // posición en target.items (para guardar la decisión)
  base: MatchStatus | "pendiente"; // lo que dijo el match
  effective: MatchStatus | "pendiente"; // base + tu decisión (para agrupar)
  decision: CapsuleDecision | null; // lo que decidió el usuario (solo en "parecido")
  covered: boolean; // cuenta como cubierta (= efectivo "tienes")
  by: string | null;
};

export function capsuleRows(
  target: CapsuleTarget,
  match: CapsuleMatch | null,
  overrides: CapsuleOverrides | null = null
): CapsuleRow[] {
  return target.items.map((item, i) => {
    const e = match ? normalizeEntry(match.entries[i]) : { status: "pendiente" as const, by: null };
    const decision = e.status === "parecido" ? overrides?.[String(i)] ?? null : null;
    const effective = effectiveStatus(e.status, decision);
    return { item, index: i, base: e.status, effective, decision, covered: effective === "tienes", by: e.by };
  });
}

export function capsuleView(
  target: CapsuleTarget,
  match: CapsuleMatch,
  overrides: CapsuleOverrides | null = null
): CapsuleView {
  const rows = capsuleRows(target, match, overrides);
  const totalCount = rows.length;
  const haveCount = rows.filter((r) => r.covered).length;
  const coveragePct = totalCount === 0 ? 0 : Math.round((100 * haveCount) / totalCount);

  const byPrio = (a: { prioridad: number }, b: { prioridad: number }) => a.prioridad - b.prioridad;
  const faltan = rows
    .filter((r) => r.effective === "falta")
    .map((r) => r.item)
    .sort(byPrio);
  const parecidos = rows
    .filter((r) => r.effective === "parecido")
    .map((r) => ({ item: r.item, by: r.by }))
    .sort((a, b) => byPrio(a.item, b.item));

  return { haveCount, totalCount, coveragePct, faltan, parecidos };
}
