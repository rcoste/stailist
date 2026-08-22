import { generarConRecibo, type GeneratedOutfit, type OpcionesGeneracion } from "./generate";
import { reviewOutfit, type CriticVerdict } from "./critic";
import type { EngineContext } from "./prompt";
import { alcanceDeFormalidad, type Alcance } from "./alcance";
import type { Formalidad } from "@/lib/formalidad";
import type { Recibo } from "@/lib/proveedores";
import type { QuienMide } from "@/lib/recibos";

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
  /** Lo que recibió el juez (≠ before cuando el código reparó primero). Con
   *  esto se separa cuánto cambió el código y cuánto el juez. */
  entradaJuez?: string[];
};

export type ResultadoPipeline = {
  /** Los looks que pasaron (guardados/mostrados por el hook, o retenidos y rescatados). */
  finalized: GeneratedOutfit[];
  reviews: RevisionDeLook[];
  /** Recibos de TODAS las llamadas: [generación, juez, juez, …]. Los del juez
   * pueden faltar (fail-forward sin recibo). */
  recibos: Recibo[];
  /**
   * El clóset NO da para el código de vestimenta que se pidió. Cuando viene,
   * `finalized` va vacío A PROPÓSITO: no es un fallo, es la respuesta.
   *
   * Roberto: "boda de etiqueta y el usuario no tiene traje — debería decir NO;
   * no es que 'ok, pues puede con unos jeans más un suéter'". Quien llama lo
   * muestra con lo que le falta, en vez de un look que la va a dejar mal.
   */
  noAlcanza?: Alcance;
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
  hooks: HooksPipeline = {},
  /**
   * De quién es esta generación, para que cada llamada deje su recibo. Viaja
   * igual al generador y al juez; cada uno le pone su nombre de tarea.
   *
   * `null` — que es el default y lo que pasan a propósito el comparador y los
   * evales — significa NO registrar: son corridas de laboratorio, no de una
   * persona, y contarlas como uso real movería los promedios que este mismo
   * pipeline sirve para vigilar.
   */
  quien: QuienMide | null = null
): Promise<ResultadoPipeline> {
  // ANTES DE GASTAR UN TOKEN: ¿este clóset da para el código que se pidió? Es
  // una consulta al clóset, no una opinión — así que se contesta aquí y no en
  // el prompt, donde el modelo podía (y solía) armar algo igual y llamarlo
  // formal. Solo se pronuncia en formal y gala; en casual y semiformal un "no
  // puedo" sería falso.
  const alcance = alcanceDeFormalidad(
    ctx.items,
    (ctx.formality as Formalidad | null) ?? null,
    ctx.gender
  );
  if (alcance.faltaLoEsencial) {
    return { finalized: [], reviews: [], recibos: [], noAlcanza: alcance };
  }

  const { outfits: candidates, recibo } = await generarConRecibo(ctx, opciones, quien);
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
    const result = await reviewOutfit(ctx, candidates[i], finalized, false, opciones, quien);
    if (result.recibo) recibos.push(result.recibo);
    const review: RevisionDeLook = {
      before: candidates[i].item_ids,
      after: result.outfit.item_ids,
      changed:
        result.outfit.item_ids.join(",") !== candidates[i].item_ids.join(","),
      verdict: result.verdict,
      razon: result.razon,
      shown: false,
      entradaJuez: result.entradaJuez,
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
