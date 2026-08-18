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

/** Una celda de la retícula: o una prenda suelta, o el par de un traje junto. */
export type CeldaDeLook<P> =
  | { tipo: "prenda"; prenda: P }
  | { tipo: "conjunto"; nombre: string; piezas: P[] };

/**
 * EL TRAJE SE DIBUJA COMO UNA PRENDA, PORQUE ES UNA PRENDA.
 *
 * Roberto, viendo un look de cinco fotos sueltas: "ahí dice que son de traje
 * los dos, pero como sé que son del mismo traje… me gustaría ver si sí son del
 * par que corresponden". La etiqueta "traje completo" ya contestaba eso y era
 * correcta, pero es texto flotante encima de una cuadrícula: el ojo no la
 * conecta con QUÉ dos fotos.
 *
 * De las tres formas que se prototiparon —recuadro alrededor del par, marca
 * compartida en cada pieza, y el par en una sola celda— se eligió la tercera.
 * No por ser la más fácil: es la única que no agrega adorno. Las otras dos te
 * enseñan cinco cosas y luego te explican que dos van juntas; esta te enseña
 * cuatro, y una de ellas es un traje. Se acabó la pregunta.
 *
 * AFIRMA, NUNCA NIEGA, y eso decide el diseño: sólo 12 de 870 prendas de la
 * base tienen el lazo (lo traen las de catálogo; las de foto lo ponen a mano al
 * darlas de alta). Sin lazo esto devuelve las prendas tal cual, o sea que la
 * AUSENCIA de agrupación no significa "no son del mismo traje" sino "no
 * sabemos" — que es la verdad. Cualquier tratamiento que marcara lo contrario
 * le diría a alguien que su traje real está parchado.
 *
 * Un traje a medias NO se agrupa: si el pantalón no está, el saco es una prenda
 * suelta y se dibuja como tal. Agrupar de a uno sería inventar un conjunto.
 */
export function agruparConjuntos<P extends { nombre: string; conjunto?: string | null }>(
  prendas: P[]
): CeldaDeLook<P>[] {
  const porConjunto = new Map<string, P[]>();
  for (const p of prendas) {
    if (!p.conjunto) continue;
    porConjunto.set(p.conjunto, [...(porConjunto.get(p.conjunto) ?? []), p]);
  }

  const celdas: CeldaDeLook<P>[] = [];
  const yaPuestas = new Set<P>();
  for (const p of prendas) {
    if (yaPuestas.has(p)) continue;
    const hermanas = p.conjunto ? porConjunto.get(p.conjunto) : undefined;
    // Una pieza sola de un traje va como prenda suelta: su par no está.
    if (!hermanas || hermanas.length < 2) {
      celdas.push({ tipo: "prenda", prenda: p });
      continue;
    }
    hermanas.forEach((h) => yaPuestas.add(h));
    celdas.push({ tipo: "conjunto", nombre: nombreDeConjunto(hermanas), piezas: hermanas });
  }
  return celdas;
}

/**
 * Cómo se llama el par cuando se dibuja junto.
 *
 * SALE DE LO QUE LAS DOS PIEZAS COMPARTEN, no de una plantilla: "Saco de traje
 * gris carbón" + "Pantalón de traje gris carbón" comparten la cola "traje gris
 * carbón", y ese es el nombre del traje. Funciona igual para el smoking y para
 * el sastre de mujer sin listar ninguno.
 *
 * CON MENOS DE DOS PALABRAS EN COMÚN SE RINDE y dice "Traje completo". Las
 * prendas de foto llevan el nombre que la persona quiso ("Mi saco azul" con
 * "Pantalón del traje azul" comparten sólo "azul"), y titular una celda "Azul"
 * es peor que no titularla.
 */
function nombreDeConjunto(piezas: { nombre: string }[]): string {
  const palabras = piezas.map((p) => p.nombre.toLowerCase().split(/\s+/).filter(Boolean));
  const cola: string[] = [];
  for (let i = 1; i <= Math.min(...palabras.map((w) => w.length)); i++) {
    const candidata = palabras[0][palabras[0].length - i];
    if (!palabras.every((w) => w[w.length - i] === candidata)) break;
    cola.unshift(candidata);
  }
  // "de" al frente sobra: "de traje gris carbón" → "traje gris carbón".
  while (cola.length && ["de", "del", "la", "el"].includes(cola[0])) cola.shift();
  if (cola.length < 2) return "Traje completo";
  return cola[0].charAt(0).toUpperCase() + cola.join(" ").slice(1);
}
