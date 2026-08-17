// ¿EL TRAJE DE UN LOOK ESTÁ BIEN APAREADO?
//
// VIVE APARTE DEL COMPARADOR a propósito. Nació ahí —para votar a ciegas hacía
// falta ver si el saco y el pantalón eran del mismo traje— pero Roberto aclaró
// que el aviso va TAMBIÉN en la app: "es para identificar visualmente que si el
// AI propone un traje completo, tipo para un abogado, sí está haciendo el match
// correcto y no lo está haciendo parchado".
//
// Importarlo desde lib/comparador/motor arrastraría al bundle del usuario las
// variantes, el catálogo de modelos y la tabla de precios — cosas que no pintan
// nada en la pantalla de alguien que se está vistiendo. Es vocabulario del
// dominio (qué es un traje), no del banco de pruebas.

/**
 * ¿EL PAR DE ESTA PRENDA ESTÁ EN EL LOOK? Bloque de `veredictoDeTraje`.
 *
 * · null   → no viene de ningún traje.
 * · "par"  → su pareja está en el look.
 * · "solo" → viene de un traje y su pareja NO está.
 */
export function lazoDeTraje(
  prenda: { id: string; conjunto?: string | null },
  look: { id: string; conjunto?: string | null }[]
): "par" | "solo" | null {
  if (!prenda.conjunto) return null;
  return look.some((o) => o.id !== prenda.id && o.conjunto === prenda.conjunto)
    ? "par"
    : "solo";
}

export type VeredictoTraje =
  | { tipo: "completo" }
  | { tipo: "parchado" }
  | { tipo: "suelto"; prenda: string };

/**
 * ¿EL TRAJE DE ESTE LOOK ESTÁ BIEN APAREADO?
 *
 * Es la pregunta de Roberto, en sus palabras (2026-08-17): "esto es para
 * identificar visualmente que si el AI propone un traje completo, tipo para un
 * abogado, sí está haciendo el match correcto y no lo está haciendo parchado".
 *
 * SE CONTESTA POR LOOK Y NO POR PRENDA, y esa es la corrección: la primera
 * versión ponía una etiqueta en cada prenda y obligaba a leer dos y deducir. Lo
 * que se juzga al votar es el traje, no la pieza.
 *
 * Y NO NECESITA SABER QUÉ ES SACO Y QUÉ ES PANTALÓN: basta con cuántas piezas
 * del look vienen de un traje y si vienen del MISMO.
 *
 * · "completo" → dos o más piezas y todas del mismo traje. Es un traje de verdad.
 * · "parchado" → dos o más piezas de TRAJES DISTINTOS. El error que engaña: en
 *   pantalla dos grises se ven plausibles.
 * · "suelto"   → una sola pieza de traje; su par no está. OJO: no es "de otro
 *   traje" —el pantalón puede ser un chino perfectamente correcto— sino que a
 *   esa pieza le falta el suyo. Decirlo mal fue el error de la v1.
 * · null       → no hay piezas de traje y no hay nada que informar.
 */
export function veredictoDeTraje(
  look: { id: string; nombre: string; conjunto?: string | null }[]
): VeredictoTraje | null {
  const piezas = look.filter((p) => p.conjunto);
  if (piezas.length === 0) return null;
  if (piezas.length === 1) return { tipo: "suelto", prenda: piezas[0].nombre };
  const conjuntos = new Set(piezas.map((p) => p.conjunto));
  return conjuntos.size === 1 ? { tipo: "completo" } : { tipo: "parchado" };
}
