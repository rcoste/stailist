// ¿El clóset da para este estilo? — el chequeo del pastel de manzana.
//
// EL PROBLEMA
// El motor SIEMPRE entrega un look, tenga o no con qué. Si alguien dice que le
// gusta el preppy y su clóset son tres playeras negras y unos jeans, el motor
// arma algo y lo presenta como si fuera preppy. No lo es, y la persona lo nota
// antes que nosotros: el resultado es que deja de creerle a la app.
//
// Roberto lo dijo mejor: "si yo quiero un pastel de manzana y no tengo harina ni
// manzana, no me puedes dar la receta de un pastel de manzana". Lo honesto no es
// negarse — es armar lo más cercano Y DECIRLO, con qué le falta para que sí
// salga.
//
// CÓMO SE MIDE: POR ZONAS, NO POR PIEZAS
// Un look se lee de un estilo cuando lo que lleva ARRIBA, ABAJO y EN LOS PIES es
// de ese estilo. Así que la pregunta se hace por zona: ¿tiene al menos un top de
// esta familia?, ¿un bottom?, ¿un calzado? Un preppy con polo, chino y mocasín
// está completo aunque no tenga rugby ni náutico.
//
// LA PRIMERA VERSIÓN DE ESTE ARCHIVO SE EQUIVOCÓ AQUÍ, y vale la pena dejarlo
// escrito porque el error es tentador: pesaba cada prenda por lo DISTINTIVA que
// es (un rugby identifica el preppy; unos tenis blancos no identifican nada) y
// se quedaba con las seis más distintivas. Suena bien y está mal: las piezas más
// distintivas de una familia son las más raras, y al medir contra el catálogo
// real resultó que las tres primeras del preppy —rugby, suéter de ochos,
// náutico— ni siquiera existen en nuestra biblioteca. La métrica marcaba
// "ajustado" un clóset con polo + chino + mocasín, que es el uniforme preppy de
// manual. Era la misma falla que la revisora del barrido: leer la receta como
// reglamento en vez de como descripción.
//
// La distintividad sigue aquí, pero para lo único que sirve: ORDENAR qué
// sugerir cuando algo falta. Si le falta el torso preppy, más vale decirle
// "un polo" (que existe y resuelve) que "un rugby de rayas anchas".
//
// LO QUE ESTO MIDE Y LO QUE NO — leer antes de confiar en el número
// Mide CARENCIA ESTRUCTURAL: que a la persona no le quede NADA que ponerse en
// una zona dentro del vocabulario de la familia. No mide pureza de estilo, y no
// puede: trabaja con tipos de prenda, así que unos tenis skate negros cuentan
// como "tenis" para el preppy aunque su receta los vete expresamente. Afinar
// eso pediría meter el color y el matiz, y ahí esta pieza se convertiría en la
// revisora del barrido marcando el 94%. Lo que caza el matiz es el juez, con
// los "evitar" de la receta; esto solo caza el hueco.
//
// CUÁNTO PASA DE VERDAD (medido, no supuesto)
// Sorteando 50 clósets con el mismo generador que usa el barrido: 48 de 50
// tenían con qué armar la familia que les tocó, y los 2 que no eran los "clóset
// pobre a propósito". El pastel imposible existe, pero es el caso raro — esto es
// un guardarraíl para clósets muy chicos, no la palanca que arregla el motor.
//
// (Con precisión sobre lo que ese número dice y lo que no: describe la
// distribución de clósets que produce el arnés, no los clósets exactos de la
// corrida guardada — ésa se hizo en dos tandas y el muestreo ya no la
// reproduce caso por caso. Para la conclusión agregada da igual, son 50
// muestras del mismo proceso; para afirmar "el caso 39 tenía X", no alcanza.)
//
// Que en la enorme mayoría de los casos el motor tuviera prendas de la familia a
// mano y aun así se fuera del estilo es otro problema, y más grande: no es falta
// de ingredientes, es que no los reconoce como tales. De ahí familiasPorPrenda.
//
// QUÉ NO HACE
// No bloquea nada. Devuelve un diagnóstico que el prompt usa para no forzar la
// receta y que la app usa para ser honesta con la persona. Un chequeo que
// impidiera generar sería peor que el problema: la promesa del producto es que
// siempre haya algo que ponerse.

import type { EngineItem } from "./prompt";
import type { Receta, Clima } from "./recetario";
import { RECETAS_HOMBRE } from "./recetario";
import { tipoDePrenda, type Zona } from "./vocabulario";

/** Las zonas que tienen que estar cubiertas para que un look se lea del estilo. */
const ZONAS_DE_LOOK: Zona[] = ["torso", "pierna", "pie"];

export type Cobertura = {
  familia: string;
  nombre: string;
  /** Las zonas que el clóset cubre con prendas de esta familia. */
  cubre: Zona[];
  /** Las que no. Vacío = el estilo sale completo. */
  huecos: Zona[];
  /**
   * Qué comprar/usar para tapar cada hueco, en palabras de la receta y ya
   * ordenado por lo que más resuelve.
   */
  sugerencias: string[];
  /**
   * "da": las tres zonas cubiertas — el estilo sale.
   * "ajustado": falta una.
   * "no-da": faltan dos o tres; con esto no se arma nada de esta familia.
   */
  veredicto: "da" | "ajustado" | "no-da";
};

/**
 * En cuántas de las diez familias aparece cada tipo de prenda. Se calcula UNA
 * vez sobre las recetas del repo. Solo se usa para ordenar sugerencias: un tipo
 * que aparece en muchas familias es más útil de recomendar (sirve para más
 * cosas) que uno exclusivo.
 */
const FAMILIAS_POR_TIPO: Map<string, number> = (() => {
  const m = new Map<string, number>();
  for (const r of RECETAS_HOMBRE) {
    for (const tipo of new Set(tiposDeCapsula(r).map((t) => t.tipo))) {
      m.set(tipo, (m.get(tipo) ?? 0) + 1);
    }
  }
  return m;
})();

type TipoEnCapsula = { tipo: string; zona: Zona; linea: string };

/**
 * El vocabulario de prendas de una familia: qué tipos le pertenecen y con qué
 * palabras los nombra la receta.
 *
 * Sale de la cápsula Y de las fórmulas. Solo de la cápsula no alcanza, y el
 * preppy lo demuestra: sus 17 líneas de cápsula no incluyen NI UNA prenda de
 * abrigo, aunque sus fórmulas de frío sí usen abrigo largo camel y rompevientos.
 * Midiendo solo contra la cápsula, todo preppy salía con "hueco de capa" en
 * invierno — culpando a la persona de algo que la receta nunca definió. La
 * cápsula va primero porque sus líneas están escritas para leerse ("Chino caqui
 * recto"), mientras que un trozo de fórmula puede venir con el modo de llevarlo.
 */
function tiposDeCapsula(r: Receta): TipoEnCapsula[] {
  const out: TipoEnCapsula[] = [];
  const vistos = new Set<string>();
  const añadir = (linea: string) => {
    const t = tipoDePrenda(linea);
    if (!t || t.zona === "no-calle" || vistos.has(t.tipo)) return;
    vistos.add(t.tipo);
    out.push({ tipo: t.tipo, zona: t.zona, linea: linea.trim() });
  };
  for (const linea of r.capsula) añadir(linea);
  for (const f of r.formulas) {
    for (const trozo of f.look.split(/\s\+\s|\ssobre\s/)) añadir(trozo);
  }
  return out;
}

/**
 * Qué tanto da el clóset para una receta.
 *
 * `items` es el clóset tal como lo ve el motor. Se resuelve por NOMBRE, que es
 * lo único que traen todas las prendas: las del catálogo de básicos no declaran
 * material ni tipo fino, y ese es justo el clóset con el que arranca toda la
 * gente nueva.
 *
 * El `clima` suma la capa a las zonas exigidas: en frío, un estilo sin abrigo
 * propio no se lee —la persona sale con el abrigo que tenga y ése manda la foto.
 * En templado y calor la capa es opcional y exigirla inventaría huecos.
 */
export function coberturaDeReceta(
  receta: Receta,
  items: EngineItem[],
  clima: Clima = "templado"
): Cobertura {
  const deLaFamilia = tiposDeCapsula(receta);
  const tiposFamilia = new Set(deLaFamilia.map((t) => t.tipo));

  // Qué tipos de esta familia tiene de verdad, por zona.
  const cubiertas = new Set<Zona>();
  for (const it of items) {
    const t = tipoDePrenda(it.attrs.nombre ?? it.attrs.tipo ?? "");
    if (t && t.zona !== "no-calle" && tiposFamilia.has(t.tipo)) cubiertas.add(t.zona);
  }

  const exigidas: Zona[] = clima === "frio" ? [...ZONAS_DE_LOOK, "capa"] : ZONAS_DE_LOOK;
  const cubre = exigidas.filter((z) => cubiertas.has(z));
  const huecos = exigidas.filter((z) => !cubiertas.has(z));

  // Para cada hueco, la prenda de la cápsula que más lo resuelve: la de esa
  // zona cuyo tipo sirve en MÁS familias. Recomendarle un polo (que le sirve
  // para cinco estilos) es mejor consejo que un rugby (que le sirve para uno) —
  // y además es de las que sí existen en la biblioteca.
  const sugerencias = huecos.map((z) => {
    const candidatas = deLaFamilia.filter((t) => t.zona === z);
    const mejor = candidatas.sort(
      (a, b) => (FAMILIAS_POR_TIPO.get(b.tipo) ?? 0) - (FAMILIAS_POR_TIPO.get(a.tipo) ?? 0)
    )[0];
    return mejor?.linea ?? z;
  });

  const veredicto: Cobertura["veredicto"] =
    huecos.length === 0 ? "da" : huecos.length === 1 ? "ajustado" : "no-da";

  return {
    familia: receta.familia,
    nombre: receta.nombre,
    cubre,
    huecos,
    sugerencias,
    veredicto,
  };
}

/**
 * Qué prendas del clóset pertenecen al vocabulario de cada receta.
 *
 * POR QUÉ ESTO IMPORTA MÁS QUE LA COBERTURA
 * El motor recibe hasta 45 prendas en una lista plana y la receta en prosa
 * ("chino caqui recto", "mocasín penny café"), y tiene que emparejarlas de
 * memoria mientras además cuadra clima, colorimetría y ocasión. El barrido dice
 * que ahí es donde se cae: en los casos preppy TENÍA polo, chino y mocasín en el
 * clóset y armó camiseta marino + pantalón negro + tenis skate. No le faltaban
 * ingredientes; no los reconoció como tales.
 *
 * Emparejar por tipo de prenda es aritmética, no criterio — o sea, exactamente
 * lo que no hay que pedirle a un modelo. Aquí se calcula y se le entrega hecho.
 *
 * Devuelve, por id de prenda, los NOMBRES de las familias a las que pertenece.
 * Una prenda puede estar en varias (un chino es preppy y es clásico arreglado):
 * eso es información, no ambigüedad.
 */
export function familiasPorPrenda(
  items: EngineItem[],
  recetas: Receta[]
): Map<string, string[]> {
  const vocabulario = recetas.map((r) => ({
    nombre: r.nombre,
    tipos: new Set(tiposDeCapsula(r).map((t) => t.tipo)),
  }));
  const out = new Map<string, string[]>();
  for (const it of items) {
    const t = tipoDePrenda(it.attrs.nombre ?? it.attrs.tipo ?? "");
    if (!t || t.zona === "no-calle") continue;
    const suyas = vocabulario.filter((v) => v.tipos.has(t.tipo)).map((v) => v.nombre);
    if (suyas.length) out.set(it.id, suyas);
  }
  return out;
}

const EN_PALABRAS: Record<Zona, string> = {
  torso: "nada que ponerse arriba de ese estilo",
  pierna: "ningún pantalón (ni short) de ese estilo",
  pie: "ningún calzado de ese estilo",
  capa: "ninguna capa de abrigo de ese estilo",
  accesorio: "ningún accesorio de ese estilo",
  "no-calle": "",
};

/**
 * La línea para el prompt. Vacía cuando el clóset da — el caso normal no debe
 * gastar tokens ni invitar al modelo a disculparse sin motivo.
 *
 * Le dice DOS cosas, y la segunda es la que importa: que no finja. Sin ella el
 * modelo hace lo de siempre —arma algo y lo bautiza "preppy"— que es
 * exactamente el problema.
 */
export function bloqueCobertura(c: Cobertura): string {
  if (c.veredicto === "da") return "";
  const falta = c.huecos.map((z) => EN_PALABRAS[z]).filter(Boolean).join(", y ");
  const abre = c.sugerencias.slice(0, 2).join("; ");

  if (c.veredicto === "no-da") {
    return `HONESTIDAD — SU CLÓSET NO DA PARA ${c.nombre.toUpperCase()}: tiene ${falta}. NO fuerces la receta ni bautices el look con el nombre del estilo. Arma el mejor look posible con lo que SÍ tiene, que se sostenga por sí mismo (color, proporción y ocasión bien resueltos). En la explicación dilo de frente y con cariño, en UNA frase: que con lo de hoy no sale ese estilo, que esto es lo más cercano, y qué prenda le abriría la puerta (por ejemplo: ${abre}). Sin disculpas y sin tono de error — es información útil, no una falla.`;
  }
  return `OJO — su clóset da JUSTO para ${c.nombre}: le falta ${falta}. Acércate con lo que hay sin inventar prendas. Si el look acaba lejos del estilo, dilo en la explicación en vez de fingir que es puro, y menciona qué le abriría la puerta (por ejemplo: ${abre}).`;
}
