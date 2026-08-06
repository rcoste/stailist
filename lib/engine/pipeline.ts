import { generarConRecibo, type GeneratedOutfit, type OpcionesGeneracion } from "./generate";
import { reviewOutfit, type CriticVerdict } from "./critic";
import type { EngineContext } from "./prompt";
import type { Recibo } from "@/lib/proveedores";

// El pipeline COMPLETO del motor diario: generar candidatos → juez por outfit
// (reparar/rechazar) → piso de 2 looks. Vivía dentro de /api/generate,
// entretejido con el streaming y las escrituras a la base; extraído para que
// el comparador de motores corra EXACTAMENTE este camino y no una imitación —
// comparar dos variantes sobre un pipeline distinto al de producción mediría
// un motor que ningún usuario ve. (El look de hoy comparte la carga del
// contexto, pero genera UN solo look revisado: no pasa por este loop.)
//
// Los side effects (guardar el outfit, streamear la carta, las fases de
// progreso) entran por hooks: la ruta los pone, el comparador no pone ninguno.

/** Registro por candidato para el flywheel: qué pasó con cada uno. */
export type RevisionDeLook = {
  before: string[];
  after: string[];
  changed: boolean;
  verdict: CriticVerdict;
  razon: string | null;
  shown: boolean;
};

export type ResultadoPipeline = {
  /** Los looks que pasaron (guardados/mostrados por el hook, o retenidos y rescatados). */
  finalized: GeneratedOutfit[];
  reviews: RevisionDeLook[];
  /** Recibos de TODAS las llamadas: [generación, juez, juez, …]. Los del juez
   * pueden faltar (fail-forward sin recibo). */
  recibos: Recibo[];
};

export type HooksPipeline = {
  /** Tras generar: cuántos candidatos vienen (la ruta manda {total}). */
  alCandidatos?: (n: number) => void;
  /** Antes de revisar el i-ésimo candidato (la ruta manda su fase de progreso). */
  alRevisar?: (i: number) => void;
  /**
   * Un look aprobado (o rescatado por el piso de 2): guárdalo/muéstralo.
   * Devuelve false si no se pudo persistir — el look NO cuenta como mostrado.
   * Sin hook, todo look aprobado cuenta.
   */
  alAprobar?: (outfit: GeneratedOutfit) => Promise<boolean>;
};

export async function armarLooks(
  ctx: EngineContext,
  opciones: OpcionesGeneracion = {},
  hooks: HooksPipeline = {}
): Promise<ResultadoPipeline> {
  const { outfits: candidates, recibo } = await generarConRecibo(ctx, opciones);
  const recibos: Recibo[] = [recibo];
  hooks.alCandidatos?.(candidates.length);

  const finalized: GeneratedOutfit[] = [];
  const reviews: RevisionDeLook[] = [];
  // Rechazados retenidos: solo se muestran si caemos por debajo de 2.
  const held: { outfit: GeneratedOutfit; review: RevisionDeLook }[] = [];

  const aprobar = async (outfit: GeneratedOutfit): Promise<boolean> => {
    const ok = hooks.alAprobar ? await hooks.alAprobar(outfit) : true;
    if (ok) finalized.push(outfit);
    return ok;
  };

  // 2ª pasada POR OUTFIT: el juez (Sonnet) revisa y cada look se entrega apenas
  // se aprueba (la ruta esconde la latencia detrás del reveal). Si el juez
  // RECHAZA (irreparable con este clóset), lo retenemos: solo se muestra al
  // final si nos quedaríamos con menos de 2 looks.
  for (let i = 0; i < candidates.length; i++) {
    hooks.alRevisar?.(i);
    const result = await reviewOutfit(ctx, candidates[i], finalized);
    if (result.recibo) recibos.push(result.recibo);
    const review: RevisionDeLook = {
      before: candidates[i].item_ids,
      after: result.outfit.item_ids,
      changed:
        result.outfit.item_ids.join(",") !== candidates[i].item_ids.join(","),
      verdict: result.verdict,
      razon: result.razon,
      shown: false,
    };

    if (result.verdict === "rechazado") {
      held.push({ outfit: result.outfit, review });
      reviews.push(review);
      continue;
    }

    if (await aprobar(result.outfit)) review.shown = true;
    reviews.push(review);
  }

  // Piso de 2 looks: si descartar rechazados nos dejó cortos, rellenamos con
  // los retenidos (mejor un look mediocre que menos de 2). #4b: aquí iría una
  // regeneración dirigida en vez de rescatar el rechazado.
  for (const h of held) {
    if (finalized.length >= 2) break;
    if (await aprobar(h.outfit)) h.review.shown = true;
  }

  return { finalized, reviews, recibos };
}
