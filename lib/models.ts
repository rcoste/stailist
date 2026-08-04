// Los modelos de IA que usa stailist, en UN solo lugar.
//
// POR QUÉ EXISTE
// El nombre del modelo estaba escrito a mano en 14 archivos de producción y 5
// scripts. Cambiar de generación obligaba a cazarlos uno por uno, y basta que
// uno se quede atrás para que una parte del producto corra en un modelo viejo
// sin que nadie se entere — no truena nada, solo empeora en silencio. El juez ya
// vivía centralizado (JUDGE_MODEL); esto extiende la misma idea al resto.
//
// CÓMO ELEGIR
// - ENGINE_MODEL: donde hace falta CRITERIO — armar outfits, leer una prenda en
//   una foto, destilar un estilo, proponer una cápsula. Es el trabajo caro y el
//   que define la calidad del producto.
// - JUDGE_MODEL: los pases de revisión, que corren UNA VEZ POR OUTFIT y dentro
//   del límite de 60s de Vercel. Ahí pesa la latencia tanto como el juicio.

/** El motor: outfits, visión de prendas, cápsula, viaje, arquetipo. */
export const ENGINE_MODEL = "claude-opus-5";

/**
 * Los jueces de styling (Hoy y Viaje). Corren por cada outfit, así que la
 * latencia importa tanto como el criterio.
 *
 * OJO: en los modelos 5 el thinking adaptativo viene ENCENDIDO por default —
 * cada llamada de juez lo apaga explícitamente para no salirse de los 60s de
 * Vercel.
 */
export const JUDGE_MODEL = "claude-sonnet-5";
