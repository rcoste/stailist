// UN blueprint, ya emparejado contra el clóset, para que el motor arme sobre él.
//
// QUÉ ES UN BLUEPRINT
// La disección de UNA foto de referencia en su estructura: el núcleo (las
// prendas sin las cuales el look deja de ser ese look), la guarnición (lo que
// suma pero no define), la relación de color SIN nombrar colores, el detalle
// que lo hace funcionar y qué lo rompe. Se generan con scripts/diseccionar.mjs.
//
// POR QUÉ ESTO Y NO LO DE ANTES — los dos intentos que perdieron su A/B ciego:
//
//   recetario   destilar MUCHAS fotos a prosa       5-4-2 contra julio
//   fotos       la imagen cruda, sin destilar       2-5-5 contra julio
//
// El recetario perdió por PROMEDIAR. Su propio archivo lo decía ("inyectar
// cinco recetas es lo mismo que no inyectar ninguna") pero al medirlo salió
// peor: a Roberto se le inyectaban DOS familias enteras a la vez —casual-limpio
// y clásico-arreglado, 5,596 caracteres— pidiéndole UN outfit. La quimera por
// diseño, que es justo lo que él dijo que nunca hay que hacer: "no promedies;
// una de las tres, o las tres".
//
// Las fotos en crudo perdieron por otra vía: le pedíamos al modelo que, en la
// MISMA llamada, leyera la estructura de la imagen, la cruzara contra 45
// prendas, respetara la colorimetría y respetara la ocasión. Es el fallo que ya
// se documentó y arregló para el recetario en prompt.ts v32 ("recibía 45
// prendas en lista plana y la receta en prosa, y tenía que emparejarlas de
// memoria") y que a las fotos nunca se le arregló.
//
// Un blueprint es de UNA foto (no promedia) y llega YA EMPAREJADO (el
// emparejamiento es aritmética de vocabulario, no criterio). Es un eje distinto,
// no el punto medio entre dos fracasos — pero eso está por demostrarse.

import blueprintsDiarioTemplado from "./blueprints/diario-templado.json";
import { tipoDePrenda, type Zona } from "./vocabulario";
import { banda, esVivo, type Banda } from "./color-medidas";
import type { EngineItem } from "./prompt";
import type { Clima } from "./recetario";

export type PiezaBlueprint = { zona: Zona; tipo: string; detalle: string };

export type Blueprint = {
  id: string;
  path: string;
  estilo: string;
  clima: string;
  registro: string;
  ocasiones: string[];
  nucleo: PiezaBlueprint[];
  guarnicion: PiezaBlueprint[];
  zonas_no_visibles: Zona[];
  color_relacion: string;
  color_libre: string;
  clave: string;
  rompe: string;
};

/**
 * Los blueprints por celda de (ocasión × clima).
 *
 * La celda es el eje correcto, y no el estilo: un día no te da "hoy quiero
 * sastre", te da "oficina, 22°". Se arrancó por diario/templado porque el 70%
 * de los outfits reales generados son de diario (97 de 138) y oficina son 6 —
 * y porque diario es donde hay máxima libertad y por tanto máxima ambigüedad,
 * que es donde una estructura concreta tiene todo que aportar. Roberto lo
 * argumentó al revés de mi propuesta y tenía razón: "hay ocasiones que tienen
 * códigos y permiten menos flexibilidad; alguien no debería ir estilo hipster a
 * una boda de gala". En oficina manda el código de vestimenta y el piso de
 * formalidad ya lo cubre.
 */
const POR_CELDA: Record<string, Blueprint[]> = {
  "diario|templado": blueprintsDiarioTemplado as Blueprint[],
};

/** Una pieza del núcleo con las prendas del clóset que podrían cumplirla. */
export type PiezaEmparejada = PiezaBlueprint & {
  /** Prendas del clóset del MISMO tipo canónico. Lo ideal. */
  exactas: EngineItem[];
  /** Del mismo tipo no hay, pero sí de la misma zona. Sustituto legítimo. */
  deZona: EngineItem[];
};

export type BlueprintEmparejado = {
  bp: Blueprint;
  piezas: PiezaEmparejada[];
  /** Ninguna pieza exigida se quedó sin candidatas. */
  armable: boolean;
  /** Cuántas piezas se cubren con el tipo exacto (para desempatar). */
  exactas: number;
};

/**
 * Empareja el núcleo contra el clóset.
 *
 * Se exige el NÚCLEO, nunca la guarnición: el núcleo son las prendas sin las
 * cuales el look deja de ser ese look. Pedir el reloj de la foto convertiría
 * cualquier medición en un no.
 *
 * Y las zonas NO VISIBLES no se exigen. Resultó ser el 73% de las fotos (33 de
 * 45): mucho street style viene recortado y no enseña el calzado. Si "no se ve"
 * se tratara como "no lleva", el motor armaría looks descalzos en tres de cada
 * cuatro casos — el borde que parecía menor era el mayor.
 */
export function emparejarBlueprint(
  bp: Blueprint,
  items: EngineItem[]
): BlueprintEmparejado {
  const noVisible = new Set(bp.zonas_no_visibles ?? []);
  const resuelto = items.map((it) => ({
    it,
    t: tipoDePrenda(it.attrs.nombre ?? it.attrs.tipo ?? ""),
  }));

  const piezas: PiezaEmparejada[] = (bp.nucleo ?? [])
    .filter((n) => !noVisible.has(n.zona))
    .map((n) => ({
      ...n,
      exactas: resuelto.filter((r) => r.t?.tipo === n.tipo).map((r) => r.it),
      deZona: resuelto
        .filter((r) => r.t && r.t.tipo !== n.tipo && r.t.zonas.includes(n.zona))
        .map((r) => r.it),
    }));

  return {
    bp,
    piezas,
    armable: piezas.every((p) => p.exactas.length > 0 || p.deZona.length > 0),
    exactas: piezas.filter((p) => p.exactas.length > 0).length,
  };
}

/**
 * El blueprint del día.
 *
 * `evitar` son los paths ya usados (los últimos días). Sin rotación, la persona
 * recibe el mismo look una y otra vez: los 45 de esta celda dan 36 núcleos
 * distintos, y desperdiciar esa variedad sería repetir el defecto del deck
 * generado desde plantillas.
 *
 * Devuelve null cuando no hay nada que encaje, y eso NO es un fallo: el motor
 * arma como siempre. Es la misma decisión que tomó elegirInspiracion tras
 * perder su A/B — cuando la referencia no ayuda, ninguna referencia es mejor
 * que una mala.
 */
export function elegirBlueprint(
  opts: {
    ocasion: string;
    clima: Clima;
    items: EngineItem[];
    /** Familias que le gustan, EN ORDEN DE FUERZA. Ordena, no filtra. */
    familias?: string[];
    evitar?: Set<string>;
    rand?: () => number;
  }
): BlueprintEmparejado | null {
  const { ocasion, clima, items, familias = [], evitar } = opts;
  const rand = opts.rand ?? Math.random;

  const candidatos = POR_CELDA[`${ocasion}|${clima}`] ?? [];
  if (!candidatos.length) return null;

  const libres = candidatos.filter((b) => !evitar?.has(b.path));
  // Si ya se usaron todos, se reinicia la rotación en vez de devolver nada.
  const pool = libres.length ? libres : candidatos;

  const emparejados = pool
    .map((b) => emparejarBlueprint(b, items))
    .filter((e) => e.armable);
  if (!emparejados.length) return null;

  // Orden: primero su familia más fuerte, luego el que menos sustituciones
  // necesita, y el azar rompe empates para que dos días seguidos no den lo
  // mismo. El azar va DENTRO del orden, no encima: sin él la persona recibiría
  // siempre el mismo blueprint mientras no cambie su clóset.
  const fuerza = (b: Blueprint) => {
    const i = familias.indexOf(b.estilo);
    return i === -1 ? familias.length : i;
  };
  emparejados.sort(
    (a, z) =>
      fuerza(a.bp) - fuerza(z.bp) ||
      z.exactas - a.exactas ||
      rand() - 0.5
  );
  return emparejados[0];
}

/**
 * El bloque que va al prompt.
 *
 * Da las tres cosas que ni la foto cruda ni la receta daban:
 *   1. el núcleo con los IDS reales que lo pueden cumplir (emparejamiento hecho)
 *   2. la relación de color, explícitamente NO los colores
 *   3. la clave y lo que lo rompe — el detalle que se pierde al resumir
 *
 * Y dice quién manda sobre quién, porque es la lección que costó el A/B de las
 * fotos: la referencia NO decide el nivel de arreglo ni el color; decide la
 * combinación.
 */
export function bloqueBlueprint(e: BlueprintEmparejado): string {
  const { bp, piezas } = e;
  const lineas = piezas.map((p) => {
    const cand = p.exactas.length ? p.exactas : p.deZona;
    const marca = p.exactas.length ? "" : " (no tienes de ese tipo exacto; estos son de la misma zona)";
    const ids = cand
      .slice(0, 6)
      .map((i) => `${i.id} (${i.attrs.nombre ?? "?"})`)
      .join(", ");
    return `- ${p.zona} · ${p.tipo}: ${p.detalle}\n  candidatas de su clóset${marca}: ${ids}`;
  });

  const guarnicion = (bp.guarnicion ?? []).map((g) => `${g.tipo} (${g.detalle})`).join("; ");
  const sinVer = (bp.zonas_no_visibles ?? []).length
    ? `\n\nZONAS QUE LA REFERENCIA NO DEFINE: ${bp.zonas_no_visibles.join(", ")}. La foto venía recortada, así que ahí decides tú con el criterio de siempre — NO es que el look no las lleve.`
    : "";

  return `ESTRUCTURA DE REFERENCIA (un look real de calle, ya diseccionado y cruzado contra su clóset)

EL PRIMER look lo armas SOBRE esta estructura. Los otros van libres, con tu criterio de siempre.

Eso es a propósito y va con su porqué: una estructura concreta produce un look con carácter, y dos o tres estructuras a la vez producen el promedio de todas — que no es ninguna. Si le gustan varios estilos, la respuesta no es mezclarlos en un look tibio: es darle uno con carácter y que el resto de la tanda respire.

El emparejamiento con sus prendas ya está hecho: tú eliges CUÁL de las candidatas, no de qué tipo.

NÚCLEO — lo que hace que este look sea este look:
${lineas.join("\n")}

GUARNICIÓN (opcional, suma pero no define): ${guarnicion || "ninguna"}

RELACIÓN DE COLOR — importante, y no es una lista de colores: ${bp.color_relacion}
Qué puede cambiar de color sin romperlo: ${bp.color_libre}
SU COLORIMETRÍA MANDA sobre todo esto. La estructura dice "un tono profundo arriba"; cuál tono profundo lo decide lo que le favorece. Un color de la referencia que la apague es un color equivocado, no una concesión.

EL DETALLE QUE LO HACE FUNCIONAR: ${bp.clave}
LO QUE LO ARRUINA: ${bp.rompe}${sinVer}

QUÉ MANDA SOBRE QUÉ: la ocasión decide el nivel de arreglo y la colorimetría decide los colores. La referencia decide la COMBINACIÓN — qué va con qué y en qué proporción. Si la estructura y la ocasión se contradicen, gana la ocasión.`;
}

/**
 * El blueprint del contexto — el MISMO para el generador y para el juez.
 *
 * POR QUÉ SEMBRADO POR DÍA Y NO AL AZAR
 * El juez tiene que revisar la relación de color contra la estructura que el
 * generador usó de verdad; si cada uno eligiera al azar, el juez repararía el
 * look contra un blueprint que nadie usó. Y el azar puro tampoco sirve para la
 * rotación: hace falta que un día dé lo mismo dos veces (generador y juez) y
 * que dos días den cosas distintas.
 *
 * La semilla sale del día y del clóset: estable dentro del día, distinta mañana.
 */
export function blueprintDelContexto(
  ctx: {
    objective: string | null;
    items: EngineItem[];
    weather: unknown;
  },
  clima: Clima,
  familias: string[]
): BlueprintEmparejado | null {
  const dia = new Date().toISOString().slice(0, 10);
  const semilla = [...dia, ...(ctx.items[0]?.id ?? "")].reduce(
    (h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647,
    7
  );
  let n = semilla;
  const rand = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
  return elegirBlueprint({
    ocasion: ctx.objective ?? "diario",
    clima,
    items: ctx.items,
    familias,
    rand,
  });
}

/**
 * Verifica la relación de color del look armado, con números y no con opinión.
 *
 * Ésta es la cerca que no puede alucinar: de cada prenda ya tenemos su hex
 * medido, y de un hex salen su claridad y su viveza. "Capa profunda sobre base
 * clara" deja de ser prosa y pasa a ser una comparación.
 *
 * Devuelve los reparos en texto para el juez; vacío si todo cuadra. NO decide
 * por sí sola: marca, igual que las demás reglas de ejecución.
 */
export function revisarColorBlueprint(
  bp: Blueprint,
  elegidas: EngineItem[]
): string[] {
  const reparos: string[] = [];

  // Cuántos tonos vivos conviven. La relación típica de estas familias es "un
  // solo saturado, el resto neutros"; dos es donde empieza a romperse.
  const vivas = elegidas.filter((i) => esVivo(i.attrs.color_hex));
  const pideUno = /un solo|un único|máximo un|una sola pieza de color/i.test(
    bp.color_relacion
  );
  if (pideUno && vivas.length > 1) {
    reparos.push(
      `La estructura pide un solo tono vivo y el look lleva ${vivas.length}: ${vivas
        .map((i) => i.attrs.nombre)
        .join(", ")}. Deja uno y baja el resto a neutros.`
    );
  }

  // Contraste entre zonas: si la referencia pide oscuro-arriba/claro-abajo (o
  // al revés) y el look sale todo en la misma banda, la relación se perdió.
  const bandas = new Map<Zona, Banda>();
  for (const i of elegidas) {
    const t = tipoDePrenda(i.attrs.nombre ?? "");
    const b = banda(i.attrs.color_hex);
    if (t && b && (t.zona === "torso" || t.zona === "pierna" || t.zona === "capa")) {
      bandas.set(t.zona, b);
    }
  }
  const distintas = new Set(bandas.values());
  const pideContraste = /contra|contraste|sobre base|más clar|más oscur|puente/i.test(
    bp.color_relacion
  );
  if (pideContraste && bandas.size >= 2 && distintas.size === 1) {
    reparos.push(
      `La estructura se sostiene en el contraste de claros y oscuros, y el look salió entero en tono ${[...distintas][0]}. Cambia una zona de banda para que la relación se lea.`
    );
  }

  return reparos;
}
