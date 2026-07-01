// Vocabulario compartido de atributos de prenda que produce el análisis de
// visión y consumen los motores. ÚNICA fuente de verdad: el union type, los
// schemas de structured output (analizar-prenda y analizar-prendas) y la
// validación server-side (app/closet/actions.ts) derivan todos de aquí.

export const PATRONES = [
  "liso",
  "rayas",
  "cuadros",
  "floral",
  "animal-print",
  "grafico",
  "estampado",
] as const;
export type Patron = (typeof PATRONES)[number];

// Topes de longitud para los campos de texto libre que vienen del modelo de
// visión (material, color secundario). Las server actions truncan a esto antes
// de persistir: los attrs entran a prompts posteriores y son la frontera de
// confianza LLM→DB (un cliente manipulado o una foto adversarial no deben
// poder meter párrafos en el clóset).
export const MAX_MATERIAL_LEN = 40;
export const MAX_COLOR_LEN = 30;

// Normaliza un campo de texto libre del análisis: string plano de una línea,
// truncado. Devuelve undefined si queda vacío (no se persiste la llave).
export function cleanTextAttr(v: unknown, maxLen: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim().slice(0, maxLen);
  return s ? s : undefined;
}

// Valida un patrón contra el vocabulario; undefined si no es uno conocido.
export function cleanPatron(v: unknown): Patron | undefined {
  return typeof v === "string" && (PATRONES as readonly string[]).includes(v)
    ? (v as Patron)
    : undefined;
}
