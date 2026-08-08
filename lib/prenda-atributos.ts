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
// La descripción VISUAL de la prenda (cuello, mangas, botones, suela…). Es
// larga a propósito: no es una etiqueta como el material, es lo que un
// generador de imagen necesita para volver a dibujar ESA prenda y no otra.
export const MAX_VISUAL_LEN = 400;

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

/**
 * Cómo se escribe una talla, según lo que sea la prenda.
 *
 * Roberto: *"para sacos o trajes es 42, 44, 50; para calzado tiene un formato,
 * para playera tiene otro"*. Tiene razón y es lo que hace usable un campo que
 * si no queda como un cuadro vacío que no invita a nada.
 *
 * ES UN EJEMPLO, NO UNA VALIDACIÓN, y eso es deliberado — también suyo: *"la
 * persona lo puede poner como sea, al final de cuentas es una referencia"*.
 * Las tallas del mundo real son un desastre (US, EU, MX, letras, 32x34, "talla
 * única"), y un campo que rechaza lo que la persona escribe en la etiqueta de
 * SU prenda estaría equivocado él, no ella. Sugerimos el formato y aceptamos
 * cualquier cosa.
 */
export function ejemploDeTalla(categoria?: string | null): string {
  switch ((categoria ?? "").trim().toLowerCase()) {
    case "calzado":
      return "27, 8.5, 42…";
    // Sastrería: se habla en números de pecho, no en letras.
    case "saco":
      return "38, 40, 48…";
    case "bottom":
      return "32, 32x34, M…";
    case "accesorio":
      return "única, M…";
    // Tops, abrigos y vestidos van por letra casi siempre.
    default:
      return "S, M, L…";
  }
}
