// Cuánto cuesta cada modelo, por millón de tokens.
//
// POR QUÉ EXISTE
// Roberto, al ver la factura de agosto: "no puede ser que salga carísimo".
// Tenía razón en el instinto y no en la causa — el pico fue volumen mío de
// laboratorio, no el modelo. Pero salió a la luz algo peor: NADIE sabía cuánto
// costaba nada. La factura de Anthropic llega por día y por modelo, así que
// "¿cuánto cuesta armar un look?" y "¿cuánto cuesta leer una prenda?" eran
// sospechas, no datos.
//
// De aquí sale el número que se guarda con cada llamada. Con eso, la pregunta
// "¿nos conviene un modelo más barato?" se contesta con aritmética en vez de
// con corazonadas.
//
// VERIFICADO el 2026-08-05 contra la documentación oficial:
//   platform.claude.com/docs/en/about-claude/pricing
//   ai.google.dev/gemini-api/docs/pricing
// Si un modelo no está aquí, su costo sale null — se guardan los tokens y la
// pantalla muestra "—". Un precio inventado es peor que ningún precio: se ve
// igual de creíble y decide mal.

export type Precio = {
  /** USD por millón de tokens de entrada. */
  entrada: number;
  /** USD por millón de tokens de salida. */
  salida: number;
  /**
   * Precio que entra en vigor en una fecha futura (ISO). Sonnet 5 está en
   * precio de lanzamiento hasta el 31 de agosto de 2026 y después sube 50%:
   * cualquier ahorro calculado hoy con Sonnet vale la mitad en septiembre, y
   * eso hay que verlo ANTES de decidir, no después.
   */
  sube?: { desde: string; entrada: number; salida: number };
};

export const PRECIOS: Record<string, Precio> = {
  // Anthropic
  "claude-opus-5": { entrada: 5, salida: 25 },
  "claude-opus-4-8": { entrada: 5, salida: 25 },
  "claude-sonnet-5": {
    entrada: 2,
    salida: 10,
    sube: { desde: "2026-09-01", entrada: 3, salida: 15 },
  },
  "claude-sonnet-4-6": { entrada: 3, salida: 15 },
  "claude-haiku-4-5-20251001": { entrada: 1, salida: 5 },

  // Google. Los precios de entrada de Gemini son por texto/imagen/video; el
  // audio cuesta más y aquí no lo usamos.
  // Precio INTRODUCTORIO: la mitad de 3.6 Flash hasta el 31 de diciembre de
  // 2026 (anuncio de Google del 2026-08-14). Después sube — si 3.7 gana la
  // comparación y se queda, hay que volver aquí en enero o el recibo del
  // panel de IA empezará a mentir hacia abajo.
  "gemini-3.7-flash": { entrada: 0.75, salida: 3.75 },
  "gemini-3.6-flash": { entrada: 1.5, salida: 7.5 },
  "gemini-3.5-flash": { entrada: 1.5, salida: 9 },
  "gemini-3.5-flash-lite": { entrada: 0.3, salida: 2.5 },
  "gemini-3.1-flash-lite": { entrada: 0.25, salida: 1.5 },
  "gemini-2.5-flash": { entrada: 0.3, salida: 2.5 },
  "gemini-2.5-flash-lite": { entrada: 0.1, salida: 0.4 },
  // Gemini Pro cobra el doble arriba de 200k tokens de entrada. Nuestras
  // llamadas más grandes rondan los 10k, así que el tramo caro no aplica.
  "gemini-3.1-pro-preview": { entrada: 2, salida: 12 },
  "gemini-2.5-pro": { entrada: 1.25, salida: 10 },

  // Vía OpenRouter. Estos precios son SÓLO para el estimado que se muestra
  // antes de lanzar: el costo que se guarda con cada lectura viene del propio
  // OpenRouter en la respuesta, así que si mueven una tarifa el número real
  // sigue siendo correcto aunque esta tabla envejezca. Tomados de su catálogo
  // el 2026-08-05.
  "moonshotai/kimi-k2.6": { entrada: 0.589, salida: 2.48 },
  "qwen/qwen3-vl-32b-instruct": { entrada: 0.1, salida: 0.42 },
  "meta-llama/llama-4-scout": { entrada: 0.1, salida: 0.3 },
  "mistralai/mistral-small-3.2-24b-instruct": { entrada: 0.09, salida: 0.25 },
};

/**
 * Lo que costó una llamada, en dólares. null si el modelo no tiene precio
 * conocido — para OpenRouter el costo real viene en la propia respuesta.
 *
 * `cuando` existe para que el estimado de una corrida futura pueda preguntarse
 * "¿y en septiembre?", y para que un costo guardado se pueda recalcular con el
 * precio que estaba vigente ese día.
 */
export function costoUsd(
  modeloId: string,
  tokens: { entrada: number; salida: number },
  cuando: Date = new Date()
): number | null {
  const p = PRECIOS[modeloId];
  if (!p) return null;
  const vigente =
    p.sube && cuando >= new Date(p.sube.desde)
      ? { entrada: p.sube.entrada, salida: p.sube.salida }
      : { entrada: p.entrada, salida: p.salida };
  return (
    (tokens.entrada * vigente.entrada) / 1_000_000 +
    (tokens.salida * vigente.salida) / 1_000_000
  );
}

/** Para la pantalla: "$0.0031" y no "$0.00" ni "$0.003100000000001". */
export function formatoUsd(v: number | null): string {
  if (v === null) return "—";
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}
