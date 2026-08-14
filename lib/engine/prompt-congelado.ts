import { parsearJson, type Modelo, type Recibo } from "@/lib/proveedores";
import { medir, type QuienMide } from "@/lib/recibos";
import { modeloPorId } from "@/lib/proveedores/catalogo";
import { buildOutfitSchema } from "./schema";
import type { GeneratedOutfit } from "./generate";

// CORRER UNA VERSIÓN CONGELADA DEL PROMPT.
//
// El complemento de scripts/prompt-congelar.ts: aquel guarda una versión
// mientras está viva, éste la ejecuta cuando el código ya avanzó. Juntos son lo
// que Roberto pidió — "como los frontier labs, ver si sale mejor el 48 contra
// el 49" — y la razón de que existan es que el prompt vive en el código y dos
// versiones no se pueden cargar a la vez en el mismo proceso.
//
// LO QUE SE REPRODUCE EXACTAMENTE: el `system` y el mensaje de usuario, tal
// cual se renderizaron aquel día, con aquel clóset y aquel barajeo. El schema
// se reconstruye de los ids del clóset actual.
//
// LO QUE **NO** SE REPRODUCE, y hay que saberlo antes de leer un resultado:
// - Si el clóset cambió (prendas nuevas, borradas), el congelado sigue pidiendo
//   prendas viejas. Por eso `correrCongelado` valida que todos los ids del
//   mensaje existan todavía, y falla claro en vez de generar looks fantasma.
// - Las REGLAS y el JUEZ son los de hoy, no los de entonces. Eso es a propósito:
//   lo que se compara es el PROMPT, y dejar el resto igual es lo que hace la
//   comparación limpia. Si además se quisiera congelar el juez, sería otra cosa
//   y habría que decirlo.
// - ESTO CORRE **SOLO EL GENERADOR**, no el pipeline completo: no pasa por el
//   critic ni por la reparación en código. Lo descubrió la primera comparación
//   real (v48 contra v49): el `wow` salió 2.30 y 2.40 contra los ~3.0 del eval,
//   porque el TIP lo produce el juez y aquí no hay juez. Como el recorte afecta
//   IGUAL a las dos versiones, la comparación pareada sigue siendo válida —
//   pero los niveles ABSOLUTOS de aquí no se pueden leer junto a los del eval.
//   Para el nivel absoluto está el eval; esto sirve para "A contra B".

export type PromptCongelado = {
  version: string;
  poolVersion: string;
  modelo: string;
  system: string;
  briefs: { etiqueta: string; texto: string }[];
};

/** Los ids que el mensaje congelado le ofrece al modelo (el enum del schema). */
export function idsDelMensaje(texto: string): string[] {
  // Los ids van al principio de cada línea del clóset, con el formato que
  // describeItem produce: "<uuid>: ...". Se extraen del propio texto para no
  // depender de un clóset que pudo cambiar.
  const ids = new Set<string>();
  for (const m of texto.matchAll(
    /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi
  )) {
    ids.add(m[1]);
  }
  return [...ids];
}

export type ResultadoCongelado =
  | { outfits: GeneratedOutfit[]; recibo: Recibo }
  | { error: "prendas_desaparecidas"; faltan: string[] }
  | { error: "modelo_desconocido" | "sin_brief" };

/**
 * Corre UN brief de una versión congelada.
 *
 * `modeloId` permite además separar las dos variables: correr v48 y v49 con el
 * MISMO modelo aísla el efecto del prompt, que es justo lo que se quiere medir.
 */
export async function correrCongelado(
  congelado: PromptCongelado,
  etiqueta: string,
  opciones: { modeloId?: string; idsVigentes: Set<string> },
  /**
   * Correr una versión vieja del prompt es, por definición, laboratorio: esto
   * lo dispara `scripts/prompt-comparar.ts` y nunca una persona. Va en `null`
   * siempre, y el parámetro está para que la llamada pase por `medir` como
   * todas las demás.
   */
  quien: QuienMide | null = null
): Promise<ResultadoCongelado> {
  const brief = congelado.briefs.find((b) => b.etiqueta === etiqueta);
  if (!brief) return { error: "sin_brief" };

  const ids = idsDelMensaje(brief.texto);
  // Si el clóset cambió, el congelado pide prendas que ya no existen. Fallar
  // claro es la única salida honesta: generar con un enum recortado produciría
  // looks que aquella versión nunca habría armado, y la comparación mediría
  // eso en vez del prompt.
  const faltan = ids.filter((id) => !opciones.idsVigentes.has(id));
  if (faltan.length) return { error: "prendas_desaparecidas", faltan };

  const modelo: Modelo | null = opciones.modeloId
    ? modeloPorId(opciones.modeloId)
    : modeloPorId(congelado.modelo);
  if (!modelo) return { error: "modelo_desconocido" };

  // La versión que se anota es la CONGELADA, no la vigente: el punto entero de
  // este camino es correr el prompt de entonces.
  const recibo = await medir(
    quien && { ...quien, tarea: "motor-congelado", version: congelado.version },
    {
      modelo,
      system: congelado.system,
      texto: brief.texto,
      schema: buildOutfitSchema(ids),
      maxTokens: 3072,
    }
  );
  if (recibo.truncada) throw new Error("TRUNCATED_RESPONSE");

  const parsed = parsearJson<{ outfits: GeneratedOutfit[] }>(recibo.texto);
  const valid = new Set(ids);
  const outfits = (parsed.outfits ?? [])
    .filter(
      (o) =>
        o.nombre &&
        o.explicacion &&
        Array.isArray(o.item_ids) &&
        o.item_ids.length >= 2 &&
        o.item_ids.every((id) => valid.has(id))
    )
    .slice(0, 3);
  if (outfits.length < 2) throw new Error("TOO_FEW_OUTFITS");
  return { outfits, recibo };
}
