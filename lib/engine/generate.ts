import { MODELO_MOTOR } from "@/lib/models";
import { parsearJson, type Modelo, type Recibo } from "@/lib/proveedores";
import { medir, type QuienMide } from "@/lib/recibos";
import { buildOutfitSchema } from "./schema";
import { idsDelMensaje } from "./prompt-congelado";
import type { BlueprintEmparejado } from "./blueprint";
import {
  buildUserMessage,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  type EngineContext,
} from "./prompt";

export type GeneratedOutfit = {
  nombre: string;
  item_ids: string[];
  explicacion: string;
  tip?: string | null; // "el toque" — lo produce el juez; null/ausente = sin tip
};

export type OpcionesGeneracion = {
  // Flags del arnés/comparador (ver buildUserMessage). Producción no los pasa.
  marcarEstilo?: boolean;
  sinRecetario?: boolean;
  sinBlueprint?: boolean;
  sinRotacion?: boolean;
  sinNeutros?: boolean;
  /**
   * Apaga la reparación EN CÓDIGO (lib/engine/reparar.ts) y deja que el juez
   * arregle todo, como antes de v47. Solo para el comparador: es la variante
   * que mide si arreglar "te faltó ponerte X" con código en vez de con una
   * llamada de más ayuda o estorba.
   */
  sinRepararEnCodigo?: boolean;
  /**
   * Apaga la regla de coherencia cromática (v53). Solo para el comparador: es
   * la variante que mide si la regla mejora el look o rechaza looks buenos.
   */
  sinCoherenciaCromatica?: boolean;
  /**
   * CONVERSACIÓN B (docs/improvement-loop-del-motor.md §9). Medido el
   * 2026-08-22: el juez de producción reescribe el 75% de los looks, y 3 de
   * cada 4 reescrituras responden a una violación que el código ya detectaba —
   * porque el juez corre ANTES que el reparador en código y hace a mano,
   * moviendo 2.3 prendas, lo que el código haría tocando una.
   *
   * `repararPrimero`: el reparador en código corre ANTES del juez; el juez
   * recibe el look ya reparado y sólo lo que el código no pudo. Cambio de
   * ORDEN, no de lógica.
   */
  repararPrimero?: boolean;
  /**
   * `juezSoloRepara`: además de reparar primero, el juez sólo puede cambiar
   * prendas para resolver violaciones verificadas; si no queda ninguna,
   * devuelve el look TAL CUAL (se impone en código, no sólo en el prompt).
   * Mide si el 25% de reescrituras "por criterio propio" suma o resta.
   * Implica `repararPrimero` (una variante = un flag).
   */
  juezSoloRepara?: boolean;
  blueprint?: BlueprintEmparejado | null;
  /**
   * Con qué modelo generar. Default: el de producción (MODELO_MOTOR).
   * Solo lo pasa el comparador — una variante ES {modelo + prompt + reglas}.
   * OJO: cambiar el modelo aquí NO cambia producción; eso sigue siendo la
   * línea de lib/models.ts, y solo se mueve cuando una corrida lo gana.
   */
  modelo?: Modelo;
  /**
   * EL PROMPT ANTERIOR, ya resuelto para este brief: el `system` de aquella
   * versión y su mensaje de usuario tal cual se renderizó el día que se
   * congeló (prompts_congelados). Con esto el generador corre la versión de
   * AYER dentro del pipeline de HOY (juez + reparación en código iguales para
   * los dos lados — lo que se compara es el prompt).
   *
   * Solo lo pasa el comparador (variante "prompt-anterior"), y lo resuelve
   * generar-lado.ts: ni producción ni ningún otro camino lo tocan. Es el
   * freno que faltó la semana del 19 de agosto: nueve versiones medidas por su
   * propio termómetro y ninguna contra la anterior (91% → 52%).
   */
  congelado?: { version: string; system: string; texto: string };
};

/**
 * Una llamada al modelo → 2-3 outfits validados, CON su recibo (tokens, costo,
 * tiempo). El schema con enum de ids garantiza prendas reales; aquí validamos
 * además forma y cantidad. Va por la puerta común (lib/proveedores) para que
 * producción y comparador sean LA MISMA llamada — la clase de arnés que imita
 * al motor en vez de llamarlo ya nos costó un día en bugs.
 */
export async function generarConRecibo(
  ctx: EngineContext,
  opciones: OpcionesGeneracion = {},
  /**
   * De quién es esta generación, para dejar el recibo en `ai_calls`.
   *
   * `null` (o ausente) = NO se registra: es el comparador, un eval o un script
   * de terminal. Ninguno de los tres tiene sesión con la que insertar, y medir
   * una corrida de laboratorio junto al uso real ensuciaría los promedios.
   */
  quien: QuienMide | null = null
): Promise<{ outfits: GeneratedOutfit[]; recibo: Recibo }> {
  const modelo = opciones.modelo ?? MODELO_MOTOR;
  // El error histórico del motor, distinguible: la ruta lo traduce a
  // "sin_api_key" para el usuario.
  //
  // La llave se elige POR PROVEEDOR, no fija a Anthropic. Estaba clavada ahí
  // y al pasar el motor a Gemini dejó de proteger nada: sin la llave de Google
  // el motor tronaba con un error opaco en vez del "sin_api_key" limpio. Lo
  // cazó su propio test en el momento del cambio.
  const LLAVE: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };
  if (!process.env[LLAVE[modelo.proveedor]]) {
    throw new Error("ENGINE_NOT_CONNECTED");
  }

  const itemIds = ctx.items.map((i) => i.id);

  // Con un prompt congelado, los ids que el modelo puede usar son los del
  // MENSAJE de entonces, no los del clóset de hoy: si difieren, el clóset
  // cambió y la comparación ya no mide el prompt. generar-lado lo valida antes
  // de llegar aquí; esto es el cinturón.
  if (opciones.congelado) {
    const deEntonces = idsDelMensaje(opciones.congelado.texto);
    const vivos = new Set(itemIds);
    const faltan = deEntonces.filter((id) => !vivos.has(id));
    if (faltan.length) throw new Error(`PRENDAS_DESAPARECIDAS:${faltan.length}`);
  }

  // Thinking APAGADO (lo apaga el adaptador para todos los proveedores): en los
  // modelos 5 viene encendido por default y en el motor cuesta ~50% más de
  // latencia (32s contra 21s, medido) sin que se vea en los looks — el schema
  // ya obliga a razonar en el campo "analisis" antes de comprometer los
  // outfits. Y esto corre dentro del límite de 60s de Vercel CON los jueces
  // detrás.
  //
  // Va por `medir` y no por `llamar`: es la llamada que define la promesa del
  // producto (el look en menos de 30s) y hasta ahora salía sin recibo — ni
  // cuánto tarda de verdad, ni cuánto cuesta, ni cada cuánto truena. La tarea
  // se sella AQUÍ ("motor") porque este archivo es el único que sabe que esta
  // llamada es la del generador.
  // La versión que se anota es la que CORRE: con congelado, la de entonces.
  const recibo = await medir(
    quien && {
      ...quien,
      tarea: "motor",
      version: opciones.congelado?.version ?? PROMPT_VERSION,
    },
    {
    modelo,
    system: opciones.congelado?.system ?? SYSTEM_PROMPT,
    texto: opciones.congelado?.texto ?? buildUserMessage(ctx, opciones),
    schema: buildOutfitSchema(itemIds),
    // 3072: el campo "analisis" (borrador de razonamiento del schema) consume
    // tokens antes de los outfits; 2048 quedaba justo.
    maxTokens: 3072,
  });

  // Truncado por tope de tokens = JSON incompleto. Error distinguible (no un
  // JSON.parse opaco): el schema no puede acotar el "analisis" (maxLength no
  // está soportado en structured outputs), así que este es el backstop.
  if (recibo.truncada) throw new Error("TRUNCATED_RESPONSE");

  // parsearJson y no JSON.parse: Kimi emite saltos de línea crudos dentro de
  // los strings — JSON correcto salvo por eso (ver lib/proveedores).
  const parsed = parsearJson<{ outfits: GeneratedOutfit[] }>(recibo.texto);
  const valid = new Set(itemIds);
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

  // Anclas: si la usuaria fijó prendas, garantízalas en cada candidato (el
  // prompt ya las pide; esto es la red de seguridad por si el modelo las omite).
  //
  // Van AL FRENTE y el corte a 5 se aplica DESPUÉS: con 4 anclas sólo queda un
  // hueco para el estilismo, y así debe ser — quien fijó cuatro prendas ya
  // decidió casi todo el look. Recortar por el otro lado tiraría justo lo que
  // la persona pidió, que es lo único que este bloque existe para impedir.
  const anclas = (ctx.seedItemIds ?? []).filter((id) => valid.has(id));
  if (anclas.length) {
    return {
      outfits: outfits.map((o) => {
        const faltan = anclas.filter((id) => !o.item_ids.includes(id));
        if (!faltan.length) return o;
        return {
          ...o,
          item_ids: [...faltan, ...o.item_ids].slice(0, 5),
        };
      }),
      recibo,
    };
  }
  return { outfits, recibo };
}

/** La firma histórica, para quien no necesita el recibo. */
export async function generateOutfits(
  ctx: EngineContext,
  opciones: OpcionesGeneracion = {},
  quien: QuienMide | null = null
): Promise<GeneratedOutfit[]> {
  const { outfits } = await generarConRecibo(ctx, opciones, quien);
  return outfits;
}
