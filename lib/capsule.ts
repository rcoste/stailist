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
  "saco", // sacos/blazers/trajes: pieza formal por OCASIÓN (distinta de abrigo, que es capa por CLIMA)
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
  multi?: boolean; // opción múltiple (respuesta = valores separados por coma)
  /** Pregunta CONDICIONAL: solo se muestra si otra respuesta incluye `value`.
   *  Sin esto, precisar el clima de viaje costaría un paso a TODO el mundo para
   *  servir a quien viaja; así solo lo ve quien dijo que viaja. */
  showIf?: { question: string; value: string };
  options: {
    value: string;
    label: string;
    hint?: string;
    exclusive?: boolean; // en multi: al elegirla, deselecciona las demás (ej. "nada")
  }[];
};

// Preguntas fijas de botón. Junto con gustos y colorimetría, definen la cápsula
// ideal. Esta es la versión NEUTRA (strings sin género gramatical ni ejemplos de
// ropa de un solo género) — sirve para lookups por value y como fallback. Para
// mostrar al usuario, usa assessmentQuestions(gender), que ajusta los strings.
export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "trabajo",
    label: "¿Cómo son tus días entre semana?",
    help: "Marca todo lo que aplique.",
    multi: true,
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
    help: "Marca todo lo que aplique.",
    multi: true,
    options: [
      { value: "gym", label: "Gym o deporte" },
      { value: "noche", label: "Salir de noche" },
      { value: "aire", label: "Aire libre" },
      { value: "eventos_cult", label: "Cenas o eventos sociales" },
      { value: "viajo", label: "Viajo seguido" },
      { value: "ninguna", label: "Nada en particular", exclusive: true },
    ],
  },
  {
    id: "clima",
    label: "¿Cómo es el clima donde vives?",
    options: [
      {
        value: "frio",
        label: "Frío buena parte del año",
        hint: "Usas abrigo o varias capas varios meses (inviernos de ~0–12°C).",
      },
      {
        value: "templado",
        label: "Templado, sin extremos",
        hint: "Con una chamarra ligera basta casi siempre (~15–24°C la mayor parte del año).",
      },
      {
        value: "calor",
        label: "Calor casi siempre",
        hint: "Casi nunca necesitas abrigo; el calor domina (~26°C o más gran parte del año).",
      },
      {
        value: "dos_estaciones",
        label: "Dos estaciones marcadas",
        hint: "Inviernos fríos de verdad Y veranos calurosos — necesitas para ambos.",
      },
    ],
  },
  {
    // Condicional (solo si marcó "Viajo seguido"): tu ciudad define el centro de
    // gravedad del clóset, pero no puedes empacar lo que no tienes — si viajas a
    // un clima distinto, esas piezas tienen que NACER en la cápsula. Sin esto la
    // cápsula sale correcta para tu ciudad y genérica para tu vida real.
    id: "viaje_clima",
    label: "¿A qué clima viajas?",
    help: "Marca todo lo que aplique. Sumo esas piezas aunque no sean de tu ciudad.",
    multi: true,
    showIf: { question: "actividades", value: "viajo" },
    options: [
      {
        value: "frio",
        label: "Frío de verdad",
        hint: "Nieve o inviernos duros: pide un abrigo real, no una chamarra.",
      },
      {
        value: "calor",
        label: "Playa o mucho calor",
        hint: "Sol, humedad, alberca.",
      },
      {
        value: "similar",
        label: "Nada muy distinto a mi clima",
        exclusive: true,
      },
    ],
  },
  {
    id: "formalidad_techo",
    label: "Cuando te arreglas al máximo, ¿hasta dónde llegas?",
    help: "Tu evento más formal típico.",
    options: [
      { value: "smart", label: "Smart-casual", hint: "Un blazer o tu prenda más arreglada y vas bien." },
      { value: "coctel", label: "Coctel", hint: "Vestido o traje elegante." },
      { value: "formal", label: "Muy formal o gala", hint: "Bodas de etiqueta, eventos de gala." },
      { value: "rara", label: "Casi nunca me arreglo tanto" },
    ],
  },
  {
    id: "fit",
    label: "¿Cómo te gusta que te quede la ropa?",
    options: [
      { value: "entallado", label: "Ajustado", hint: "Pegado al cuerpo, que marque la figura." },
      { value: "holgado", label: "Holgado y cómodo", hint: "Relajado, sin pegarse." },
      { value: "mezcla", label: "Depende de la prenda", hint: "Arriba de un modo, abajo de otro." },
      { value: "nose", label: "Aún no lo sé", hint: "Elige lo que más me favorezca." },
    ],
  },
  {
    id: "dolor",
    label: "¿Cuándo te cuesta más decidir qué ponerte?",
    help: "Marca todo lo que aplique — ahí pongo el foco.",
    multi: true,
    options: [
      { value: "trabajo", label: "Para el trabajo", hint: "La oficina, tu día laboral." },
      { value: "salir", label: "Para salir", hint: "Una cena casual, drinks, una cita." },
      { value: "eventos", label: "Para eventos", hint: "Bodas, fiestas, algo formal." },
      {
        value: "finde",
        label: "Para el finde o el diario",
        hint: "El día a día relajado, salir de mandados.",
      },
      { value: "ninguno", label: "Casi siempre sé qué ponerme", exclusive: true },
    ],
  },
];

// Las preguntas fijas COMO LAS VE el usuario: mismos ids y values que la versión
// neutra (las respuestas guardadas nunca cambian de significado), pero con los
// strings ajustados a su género — concordancia gramatical y ejemplos de ropa que
// sí son de su clóset. Con género null devuelve la versión neutra tal cual.
export function assessmentQuestions(
  gender: "hombre" | "mujer" | null
): AssessmentQuestion[] {
  if (!gender) return ASSESSMENT_QUESTIONS;
  const smartHint =
    gender === "mujer"
      ? "Una blusa linda o un blazer y vas bien."
      : "Una camisa o un saco y vas bien.";
  const noseLabel = gender === "mujer" ? "No estoy segura" : "No estoy seguro";
  return ASSESSMENT_QUESTIONS.map((q) => ({
    ...q,
    options: q.options.map((o) => {
      if (q.id === "formalidad_techo" && o.value === "smart") return { ...o, hint: smartHint };
      if (q.id === "fit" && o.value === "nose") return { ...o, label: noseLabel };
      return o;
    }),
  }));
}

export type LifestyleAnswers = Record<string, string>;

// Las preguntas que de verdad van a mostrarse, dadas las respuestas de ahora: una
// condicional entra sólo si la respuesta de la que depende la incluye. Pura y
// testeable — la usa el formulario (para caminar los pasos) y el motor (para no
// mandarle al prompt una respuesta de una pregunta que ya no aplica, p. ej. si
// alguien marcó "viajo seguido", contestó el clima de viaje y luego se arrepintió).
export function visibleQuestions(
  questions: AssessmentQuestion[],
  answers: LifestyleAnswers
): AssessmentQuestion[] {
  return questions.filter((q) => {
    if (!q.showIf) return true;
    const raw = answers[q.showIf.question] ?? "";
    return raw.split(",").filter(Boolean).includes(q.showIf.value);
  });
}

// Resumen en lenguaje natural (voz amiga) para el contexto del motor.
export function lifestyleSummary(answers: LifestyleAnswers | null): string | null {
  if (!answers || Object.keys(answers).length === 0) return null;
  // Etiquetas (minúsculas) de una pregunta, multi o única, descartando valores `drop`.
  const labels = (qid: string, drop: string[] = []): string[] => {
    const q = ASSESSMENT_QUESTIONS.find((x) => x.id === qid);
    if (!q) return [];
    const raw = answers[qid] ?? "";
    const vals = (q.multi ? raw.split(",") : [raw]).filter((v) => v && !drop.includes(v));
    return vals
      .map((v) => q.options.find((o) => o.value === v)?.label.toLowerCase())
      .filter((l): l is string => !!l);
  };
  const parts: string[] = [];
  const trabajo = labels("trabajo");
  if (trabajo.length) parts.push(`su día es ${trabajo.join(" / ")}`);
  const eventos = answers["eventos"];
  if (eventos === "seguido") parts.push("tiene eventos de arreglarse seguido");
  else if (eventos === "aveces") parts.push("a veces tiene eventos de arreglarse");
  const actividades = labels("actividades", ["ninguna"]);
  if (actividades.length) parts.push(`fuera del trabajo: ${actividades.join(", ")}`);
  // Clima de viaje (condicional): "similar" = no necesita nada extra, no se dice.
  const viajeClima = labels("viaje_clima", ["similar"]);
  if (viajeClima.length) parts.push(`viaja a: ${viajeClima.join(" y ")}`);
  // "nose" se descarta: "prefiere la ropa aún no lo sé" no es una frase.
  const fit = labels("fit", ["nose"]);
  if (fit.length) parts.push(`prefiere la ropa ${fit[0]}`);
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
  // Descripción visual precisa para renderizar la imagen fiel (material, silueta,
  // largo, corte, detalles). NO se muestra en la UI; solo alimenta el generador.
  // Opcional: las cápsulas viejas no la traen → el render cae a los atributos.
  visual?: string | null;
};

// Un "pilar" del por qué: una razón corta con ícono (paleta, vida, cuerpo, metal).
export type CapsulePilar = {
  titulo: string; // 2-3 palabras ("Paleta de invierno")
  detalle: string; // una línea (≤ ~90 chars)
  icono?: "paleta" | "versatilidad" | "estructura" | "metal" | "color" | "vida";
};

export type CapsuleTarget = {
  version: 2;
  items: CapsuleItem[];
  // "La carnita": por qué esta cápsula es tuya. Firma (sello de estilo en serif,
  // con la frase clave entre *asteriscos* → acento) + sublínea conectora + pilares.
  firma?: string;
  subline?: string;
  pilares?: CapsulePilar[];
  resumen?: string; // legado: párrafo de cápsulas viejas (fallback de render)
  // Resumen del estilo de referencia con el que se generó (o null si ninguno).
  // Si el del perfil difiere → la cápsula quedó "outdated" y se ofrece regenerar.
  styleSig?: string | null;
};

// --- Capa 2: el match contra el clóset ------------------------------------

// Una prenda del clóset, aplanada para el prompt del match.
export type ClosetItemLite = {
  id: string;
  nombre: string;
  category: string;
  color: string;
  formalidad: string;
  // Atributos ricos (v25): el match los usa para distinguir prendas que en el
  // texto viejo (nombre + categoría + formalidad + color) eran idénticas — un
  // suéter de lana grueso de invierno vs uno fino de algodón, mismo color y
  // clase. Opcionales: prendas sin el dato caen a null y el match las trata como
  // antes. Los llena loadClosetLite desde item.attrs (100% traen hex/temporada;
  // ~85% material/patrón, ~74% corte — verificado en prod 2026-07-21).
  color_hex?: string | null;
  temporada?: string | null;
  material?: string | null;
  patron?: string | null;
  corte?: string | null;
  // CONTEXTO de uso ('bano' | 'gym' | 'dormir' | 'interior'), o null/ausente =
  // ropa de calle. Es el dato AUTORITATIVO del guard del match: el texto del
  // nombre sigue de respaldo, pero si alguien renombra su bikini a "Marino
  // dos piezas" el texto ya no lo caza y el atributo sí.
  contexto?: string | null;
  color_secundario?: string | null;
};

// Resultado por prenda ideal (alineado por índice con target.items). Tres estados:
//   "tienes"   — ya la tienes en forma usable (tipo + color compatible + uso).
//   "parecido" — tienes la prenda correcta pero con un matiz (otro neutro, casi-
//                equivalente). No es hueco; es refinamiento. Cuenta como cubierta.
//   "falta"    — no la tienes en ninguna forma usable. Hueco real.
export type MatchStatus = "tienes" | "parecido" | "falta";
export type MatchEntry = {
  status: MatchStatus;
  by: string | null;
  /** Solo en "parecido": EN QUÉ difiere tu prenda de la ideal, en 2-5 palabras
   *  ("manga corta vs larga"). Sin esto la comparación te deja adivinando de las
   *  fotos cuál es la diferencia. Opcional: los matches viejos no lo traen. */
  difiere?: string | null;
};

export type CapsuleMatch = {
  signature: string; // firma del clóset con el que se calculó
  entries: MatchEntry[];
};

// Normaliza una entrada (tolera el formato binario viejo {covered} por si quedó
// algún match cacheado de la versión anterior).
function normalizeEntry(e: unknown): MatchEntry {
  const o = (e ?? {}) as {
    status?: MatchStatus;
    covered?: boolean;
    by?: string | null;
    difiere?: string | null;
  };
  const status: MatchStatus = o.status ?? (o.covered ? "tienes" : "falta");
  return { status, by: o.by ?? null, difiere: o.difiere ?? null };
}

// Firma del clóset: incluye TODO lo que el match lee, para que corregir
// cualquier atributo (color, material, patrón, temporada, corte) invalide el
// match cacheado y se ofrezca recalcular. Antes solo miraba id+categoría+
// Ocasiones de la VIDA (no de un viaje) que la cápsula debe cubrir, derivadas
// del cuestionario. Base ciudad (todos tienen día a día); + trabajo si va a
// oficina; + noche si sale o tiene eventos; + aire si hace actividades al aire
// libre. Vive aquí (módulo puro) porque la usan tanto la generación de looks
// como la página, para poder decir qué ocasión NO se pudo cubrir.
export function occasionsFromLifestyle(
  life: Record<string, string> | null
): string[] {
  const set = new Set<string>(["ciudad"]);
  if (life) {
    if (["oficina_formal", "oficina_casual", "fisico"].includes(life.trabajo))
      set.add("trabajo");
    if (life.eventos !== "nunca" || life.actividades === "noche") set.add("noche");
    if (life.actividades === "aire") set.add("aire");
  }
  return [...set];
}

// Identidad estable de un look de la cápsula: sus prendas ordenadas y unidas.
// Es la llave de su fila en `outfits` (migración 0088) para el corazón y el
// try-on. A propósito NO es el índice del look: "rehacer" regenera la lista y
// los índices se recorren, así que un favorito guardado por índice acabaría
// apuntando a otro look. Por contenido, un look idéntico reencuentra su fila.
export function capsuleLookKey(prendas: string[]): string {
  return [...prendas].sort().join("|").slice(0, 400);
}

// formalidad → corregir el color de una prenda dejaba el match viejo en
// silencio, justo el campo que desempata "tienes" vs "parecido" (v25). Ambos
// lados (el match y la detección de staleness en la página) la derivan de
// loadClosetLite, así que producen la misma firma. Los campos ricos son
// opcionales (caen a "") — la firma sigue siendo consistente para prendas sin
// el dato. Separador "|": ninguno de estos campos lo contiene.
export function closetSignature(
  items: {
    id: string;
    category: string;
    formalidad: string;
    color?: string;
    color_hex?: string | null;
    material?: string | null;
    patron?: string | null;
    temporada?: string | null;
    corte?: string | null;
  }[]
): string {
  return items
    .map((i) =>
      [
        i.id,
        i.category,
        i.formalidad,
        i.color ?? "",
        i.color_hex ?? "",
        i.material ?? "",
        i.patron ?? "",
        i.temporada ?? "",
        i.corte ?? "",
      ].join("|")
    )
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

// --- Camino A: rechazar/afinar una prenda ideal (issue #89) ----------------

// Razón opcional del rechazo (tap rápido). Alimenta los vetos y el prompt del swap.
export type VetoReason = "no-lo-uso" | "muy-formal" | "muy-casual" | "color-no";

// Overlay por slot: la alternativa vigente + cuántas ideales se han rechazado en
// ese slot (tope SWAP_CAP) + la razón del último rechazo. capsule_target NO se muta;
// esto se sobrepone al leer.
export type CapsuleSwapEntry = {
  item: CapsuleItem;
  rejectedCount: number;
  reason?: VetoReason | null;
  dismissed?: boolean; // slot retirado de la cápsula (por tope de swaps o por "quitar")
};
export type CapsuleSwaps = Record<string, CapsuleSwapEntry>; // clave = índice

// Tope de swaps por slot: al 2º rechazo dejamos de gastar IA y el slot se abandona.
export const SWAP_CAP = 2;

// Cuántas piezas ha descartado (slots con al menos un rechazo).
export function capsuleRejectCount(swaps: CapsuleSwaps | null): number {
  return swaps ? Object.keys(swaps).length : 0;
}

// Umbral de escalada: al descartar ≥ 1/3 de las piezas, paramos los swaps y
// llevamos a afinar el estilo (regenerar), en vez de dejar la cápsula coja.
export function capsuleEscalated(
  target: CapsuleTarget,
  swaps: CapsuleSwaps | null
): boolean {
  const total = target.items.length;
  if (total === 0) return false;
  return capsuleRejectCount(swaps) >= Math.ceil(total / 3);
}

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
  // "tienes" desmentido: el match acredita cobertura que no es real (te dice que
  // ya tienes algo que no). Era el ÚNICO error del match sin puerta de arreglo, y
  // por eso el "N de M" no se podía corregir hacia abajo. "accept" lo restaura.
  if (base === "tienes" && decision === "reject") return "falta";
  return base;
}

// Lista COMPLETA de la cápsula, en orden de prioridad, cada prenda con su estado
// (para la pantalla dedicada). Si aún no hay match, todas quedan "pendiente".
export type CapsuleRow = {
  item: CapsuleItem; // la prenda a mostrar (la alternativa del swap si hay una)
  index: number; // posición en target.items (para guardar la decisión)
  base: MatchStatus | "pendiente"; // lo que dijo el match
  effective: MatchStatus | "pendiente"; // base + tu decisión (para agrupar)
  decision: CapsuleDecision | null; // lo que decidió el usuario (solo en "parecido")
  covered: boolean; // cuenta como cubierta (= efectivo "tienes")
  by: string | null;
  difiere: string | null; // "parecido": en qué difiere tu prenda de la ideal
  // Camino A: si este slot tiene una alternativa activa (swap) y si llegó al tope.
  swapCount: number; // ideales rechazadas en este slot (0 = sin swap)
  atSwapCap: boolean; // swapCount >= SWAP_CAP → ya no se ofrecen más swaps
  dismissed: boolean; // slot retirado de la cápsula (no se muestra en las secciones)
};

export function capsuleRows(
  target: CapsuleTarget,
  match: CapsuleMatch | null,
  overrides: CapsuleOverrides | null = null,
  swaps: CapsuleSwaps | null = null
): CapsuleRow[] {
  return target.items.map((item, i) => {
    const swap = swaps?.[String(i)] ?? null;
    // Overlay: si el slot tiene alternativa, se muestra esa (el ideal no se muta).
    const shown = swap ? swap.item : item;
    const e = match
      ? normalizeEntry(match.entries[i])
      : { status: "pendiente" as const, by: null, difiere: null };
    // La decisión aplica a "parecido" (elegir tu prenda o la ideal) y a "tienes"
    // (desmentir una cobertura falsa). En "falta"/"pendiente" no hay nada que decidir.
    const decision =
      e.status === "parecido" || e.status === "tienes"
        ? overrides?.[String(i)] ?? null
        : null;
    const effective = effectiveStatus(e.status, decision);
    const swapCount = swap?.rejectedCount ?? 0;
    return {
      item: shown,
      index: i,
      base: e.status,
      effective,
      decision,
      covered: effective === "tienes",
      by: e.by,
      difiere: e.difiere ?? null,
      swapCount,
      atSwapCap: swapCount >= SWAP_CAP,
      dismissed: swap?.dismissed ?? false,
    };
  });
}

export function capsuleView(
  target: CapsuleTarget,
  match: CapsuleMatch,
  overrides: CapsuleOverrides | null = null,
  swaps: CapsuleSwaps | null = null
): CapsuleView {
  // Los slots retirados ("quitar"/tope) salen de la cápsula: no cuentan ni se listan.
  const rows = capsuleRows(target, match, overrides, swaps).filter((r) => !r.dismissed);
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
