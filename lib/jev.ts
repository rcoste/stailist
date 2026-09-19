// LA PUERTA A JEV (TypeSafe), el modelo "System One".
//
// QUÉ ES, sin el marketing: no genera texto. Recibe un ESTADO en texto y un
// conjunto de PREGUNTAS de respuesta acotada, y devuelve una probabilidad
// calibrada por pregunta en 70-500ms. No escribe, no explica, no propone un
// arreglo. Es un if-statement con criterio.
//
// POR QUÉ NO PASA POR `lib/proveedores`, que es la regla de la casa.
// La puerta común (`llamar`) habla el idioma de los modelos de chat: mensajes,
// system prompt, schema de salida, streaming. Jev no tiene nada de eso — no hay
// mensajes ni schema, hay `state` y `questions`. Forzarlo por ahí obligaría a
// fingir una conversación que no existe y a que cada llamador supiera cuál de
// los dos mundos está usando. Lo que SÍ se respeta es la razón por la que esa
// puerta existe: cada llamada sale con su `Recibo` (tokens, costo, ms) en el
// MISMO tipo, para que el costo y la latencia se cuenten con la misma regla que
// todo lo demás del producto.
//
// ESTO ES UNA HERRAMIENTA DE MEDICIÓN, NO PRODUCCIÓN. Ninguna ruta lo llama.
//
// EL VEREDICTO, medido el 2026-09-18 en cuatro pruebas (~$0.09 en total). Antes
// de volver a proponer Jev para algo, leer esto:
//
//   1. JUZGAR LOOKS (scripts/examen-jev.ts) — PERDIÓ. Siete preguntas atómicas
//      contra 460 looks votados: sólo `ocasion` separó algo (+0.15); color,
//      proporción y capas fueron ruido. Empató al juez vigente en el punto más
//      estricto y perdió en todos los demás. No tiene ojo.
//   2. ENTENDER TEXTO LIBRE (scripts/examen-jev-comentarios.ts) — GANÓ. 82%
//      contra 45% de piso clasificando comentarios de 👎, y su confianza avisa:
//      16/16 con confianza ≥ 0.70, 2/6 por debajo.
//   3. LEER EN MASA (scripts/juez-desobediente.ts) — SIRVIÓ. 536 hallazgos en
//      prosa clasificados por $0.017; de ahí salieron js8 y js9. ~15 de sus 169
//      marcas eran falsas: necesita una lectura humana encima.
//   4. DESCRIBIR LOOKS PARA APRENDER GUSTO (scripts/examen-jev-gusto.ts) —
//      PERDIÓ CONTRA EL CÓDIGO. Predecir el voto con rasgos calculados por
//      código dio AUC 0.700; con los rasgos de Jev, 0.623; juntos, 0.683. El
//      hex medido y una regex le ganan a su descripción.
//
// EL RETRATO: entiende lenguaje y sabe cuándo duda; no ve ni tiene criterio
// estético. Aquí sirve para LEER Y CLASIFICAR TEXTO en análisis puntuales. Se
// queda como herramienta; si algún día acepta imágenes, se vuelve a medir.
import type { Recibo } from "@/lib/proveedores";

/** POST https://api.typesafe.ai/v1/systemone */
const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export const MODELO_JEV = "jev-latest";

/**
 * $0.042 por millón de tokens de ENTRADA; la salida es gratis.
 *
 * No va en `lib/proveedores/precios.ts` por lo mismo que el cliente no va en la
 * puerta común: esa tabla cobra entrada Y salida, y aquí la salida no existe.
 * Meterlo ahí con un 0 de relleno haría que el archivo de precios mintiera
 * sobre la forma del cobro.
 */
export const PRECIO_JEV_ENTRADA_POR_MTOK = 0.042;

/** Una pregunta de sí/no. Devuelve la probabilidad de que la respuesta sea sí. */
export type PreguntaNoul = {
  type: "noul";
  instructions: string;
  /** Qué cuenta como sí y qué como no. Es el único lugar donde cabe el matiz. */
  criteria?: { true: string; false: string };
};

/** Una escala ordenada. `criteria` va de MENOS a MÁS, entre 2 y 10 niveles. */
export type PreguntaScore = {
  type: "score";
  instructions: string;
  criteria: string[];
};

/**
 * Elegir UNA opción de un conjunto nombrado. `criteria` mapea el nombre de cada
 * opción a su descripción — las claves son las que vuelven en `choice`.
 *
 * Su tope es 255 opciones por pregunta. Aquí nunca nos acercamos: la lista más
 * larga que tenemos es el vocabulario de defectos, que son siete.
 */
export type PreguntaChoice = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type PreguntaJev = PreguntaNoul | PreguntaScore | PreguntaChoice;

export type RespuestaNoul = { type: "noul"; noul: number };

export type RespuestaScore = {
  type: "score";
  /** Puede ser fraccionario: es la suma de nivel × probabilidad. */
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  legend: Record<string, string>;
};

export type RespuestaChoice = {
  type: "choice";
  /** La opción más probable, por su nombre (la clave de `criteria`). */
  choice: string;
  /** 0-1. Sale de qué tan separada está la ganadora de las demás, no de que sea correcta. */
  confidence: number;
  probabilities: Record<string, number>;
};

export type RespuestaJev = RespuestaNoul | RespuestaScore | RespuestaChoice;

export class ErrorJev extends Error {
  constructor(public detalle: string) {
    super(`jev: ${detalle}`);
  }
}

type CuerpoRespuesta = {
  model?: string;
  answers?: Record<string, RespuestaJev>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export type OpcionesJev = {
  /** Por defecto 30s. Jev contesta en menos de 1s; si tarda más, algo pasa. */
  timeoutMs?: number;
  apiKey?: string;
};

/**
 * Una llamada: un estado, N preguntas, N respuestas.
 *
 * VAN TODAS EN LA MISMA LLAMADA a propósito — su documentación dice que
 * "agregar preguntas casi no cambia el tiempo de respuesta", así que partirlas
 * sólo multiplicaría el estado (que es lo que se cobra) sin ganar nada.
 */
export async function preguntarJev(
  state: string,
  questions: Record<string, PreguntaJev>,
  opciones: OpcionesJev = {}
): Promise<{ respuestas: Record<string, RespuestaJev>; recibo: Recibo }> {
  const apiKey = opciones.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new ErrorJev("falta TYPESAFE_API_KEY");

  const t0 = Date.now();
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), opciones.timeoutMs ?? 30_000);
  let r: Response;
  try {
    r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      // `model` Y NADA MÁS, medido contra la API (2026-09-18). Su documentación
      // se contradice: el quickstart y el ejemplo de `score` mandan `model`, el
      // de `noul` manda `selectedModels`. Probadas las cuatro variantes contra
      // el endpoint real: sólo `model` devuelve 200. `selectedModels` da 400
      // —sola o acompañada— y sin ningún campo de modelo da 422 pidiendo
      // `model`. La página de `noul` está vieja; si algún día 400 vuelve sin
      // motivo, ese es el primer lugar donde mirar.
      body: JSON.stringify({ state, model: MODELO_JEV, questions }),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ErrorJev(
      e instanceof Error && e.name === "AbortError" ? "timeout" : String(e)
    );
  } finally {
    clearTimeout(reloj);
  }

  const texto = await r.text();
  if (!r.ok) throw new ErrorJev(`HTTP ${r.status}: ${texto.slice(0, 400)}`);

  let cuerpo: CuerpoRespuesta;
  try {
    cuerpo = JSON.parse(texto) as CuerpoRespuesta;
  } catch {
    throw new ErrorJev(`respuesta no es JSON: ${texto.slice(0, 200)}`);
  }
  if (!cuerpo.answers) throw new ErrorJev(`respuesta sin "answers": ${texto.slice(0, 200)}`);

  // Que conteste TODAS. Una pregunta que falta no es un error de la llamada
  // pero sí un agujero en la crítica, y callado se lee como "no hay defecto".
  const faltantes = Object.keys(questions).filter((k) => !cuerpo.answers![k]);
  if (faltantes.length) throw new ErrorJev(`sin responder: ${faltantes.join(", ")}`);

  const entrada = cuerpo.usage?.input_tokens ?? 0;
  const salida = cuerpo.usage?.output_tokens ?? 0;
  return {
    respuestas: cuerpo.answers,
    recibo: {
      texto,
      tokens: { entrada, salida },
      costoUsd: (entrada / 1_000_000) * PRECIO_JEV_ENTRADA_POR_MTOK,
      ms: Date.now() - t0,
      // No existe el concepto: no hay generación que se pueda cortar a medias.
      truncada: false,
    },
  };
}
