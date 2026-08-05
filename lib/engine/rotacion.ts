import type { EngineItem } from "./prompt";

// Que el clóset entero rote, no solo las mismas veinte prendas.
//
// EL PROBLEMA, medido
// En 240 looks generados con el clóset real de Roberto: chinos carbón salieron
// 71 veces (30%), el reloj negro 70, los botines Chelsea 69. El suéter esmeralda
// —que sí tiene— apareció en el 15%. Y 61 de 127 prendas no salieron NUNCA.
// Roberto, tras juzgar 40 pares: "se repitieron muchísimos outfits, estoy
// segurísimo de que no hubo rotación... yo tengo muchísimas prendas".
//
// POR QUÉ PASA
// El motor tiene exactamente un mecanismo anti-repetición: la lista de
// combinaciones recientes, que solo prohíbe repetir un look ENTERO. Nada le
// dice que una prenda lleva tres semanas sin salir. Y el barajeo del clóset
// (orderClosetForEngine) reparte el ORDEN para que no gane siempre lo de
// arriba, pero no tiene memoria: no sabe qué salió ayer.
//
// LO QUE ESTO NO ES
// No es un filtro ni una cuota. Empujar una prenda a un look donde no cabe es
// peor que repetir: el error de repetir se nota a la semana, el de forzar se
// nota al ponérselo. Por eso entra como PREFERENCIA y siempre condicionada a
// que el look la pida — mismo criterio que las demás señales suaves del motor.

/**
 * Cuántas veces tiene que aparecer una prenda en el historial reciente para
 * considerarla "muy vista".
 *
 * 3 sobre 14 días: con un look al día, salir 3 veces en dos semanas ya es una
 * de cada cinco. Debajo de eso es uso normal y marcarlo sería ruido.
 */
const MUY_VISTA = 3;

/** Cuántas nombrar en el prompt, por lado. Una lista larga se lee como ruido. */
const TOPE = 12;

export type Rotacion = {
  /** Prendas de calle que no aparecen en el historial reciente. */
  descansadas: EngineItem[];
  /** Las que salieron MUY_VISTA veces o más. */
  muyVistas: EngineItem[];
};

/**
 * Qué descansó y qué se vio mucho, según los looks recientes.
 *
 * `recentCombos` es el mismo dato que ya se carga para no repetir combinaciones
 * (los últimos 14 días de looks diarios): aquí se lee al revés, por prenda en
 * vez de por look, sin pedir nada nuevo a la base.
 */
export function calcularRotacion(
  items: EngineItem[],
  recentCombos: string[][]
): Rotacion {
  const veces = new Map<string, number>();
  for (const combo of recentCombos) {
    for (const id of combo) veces.set(id, (veces.get(id) ?? 0) + 1);
  }

  // Sin historial no hay rotación posible: todo "descansó" y nombrar el clóset
  // entero no le dice nada al motor.
  if (veces.size === 0) return { descansadas: [], muyVistas: [] };

  const descansadas = items.filter((i) => !veces.has(i.id));
  const muyVistas = items
    .filter((i) => (veces.get(i.id) ?? 0) >= MUY_VISTA)
    .sort((a, b) => (veces.get(b.id) ?? 0) - (veces.get(a.id) ?? 0));

  return { descansadas: descansadas.slice(0, TOPE), muyVistas: muyVistas.slice(0, TOPE) };
}

/**
 * El bloque para el prompt. Vacío si no hay nada que decir.
 *
 * Las dos listas van juntas y con verbos distintos a propósito: "prefiere" para
 * las descansadas y "ya se vieron" para las otras. Decir solo lo que sobra
 * empujaría al motor a evitar sin darle a dónde ir, y de ahí salen los looks
 * raros — evita el suéter que funcionaba y mete el que no.
 */
export function bloqueRotacion(r: Rotacion): string {
  const partes: string[] = [];
  if (r.descansadas.length) {
    partes.push(
      `Prendas suyas que NO han salido en sus looks recientes: ${r.descansadas
        .map((i) => `${i.attrs.nombre ?? i.id}`)
        .join(", ")}.`
    );
  }
  if (r.muyVistas.length) {
    partes.push(
      `Y estas ya se vieron varias veces estos días: ${r.muyVistas
        .map((i) => `${i.attrs.nombre ?? i.id}`)
        .join(", ")}.`
    );
  }
  if (!partes.length) return "";

  return `ROTACIÓN DEL CLÓSET
${partes.join("\n")}

Cómo usarlo: cuando dos prendas sirvan IGUAL de bien para el look, elige la que ha descansado. Es un desempate, NO una cuota — si una prenda muy vista es la correcta para hoy (por clima, ocasión, colorimetría o porque el look la pide), úsala sin problema. Meter una prenda donde no cabe solo por variar sale mucho peor que repetir: repetir se nota a la semana, forzar se nota al ponérselo.`;
}
