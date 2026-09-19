// EL JUEZ, PERO EN PREGUNTAS ATÓMICAS (retador de js7, con Jev).
//
// QUÉ SE ESTÁ PROBANDO. El fallo medido del juez vigente está escrito en
// `juez-stylist.ts` y tiene nombre: **ve pero no pesa**. Con cualquier hallazgo
// cazaba el 85% de los 👎 de Roberto; con "rompe", el 22%. Detecta y luego se
// equivoca al decidir cuánto importa lo que detectó.
//
// LA HIPÓTESIS. Ese es un problema de PONDERACIÓN, y hoy se lo pedimos al
// modelo: que pese en su cabeza y nos entregue una gravedad ya cocinada. Si en
// vez de eso preguntamos defecto por defecto y nos devuelven una PROBABILIDAD
// por cada uno, el peso deja de vivir en el prompt y pasa a vivir en código —
// donde se ve, se versiona y se ajusta contra los votos reales.
//
// LO QUE ESTO NO PUEDE HACER, y hay que decirlo antes de que el número engañe:
// Jev no escribe. El juez de esta casa entrega `pieza`, `problema` y sobre todo
// `arreglo` ("la camisa negra rompe todo, cámbiala por blanca"), y ese arreglo
// es lo que se convierte en el siguiente ajuste del motor. Aquí sale un número
// y nada más. Así que aunque GANE el examen, no reemplaza al juez: a lo sumo
// sería una criba delante de él. El examen mide detección, no oficio.
//
// LA DESVENTAJA QUE CARGA, para que no se lea como derrota si pierde: js7 VE
// LAS FOTOS de las prendas y Jev no acepta imágenes. Compite con el nombre y
// los atributos, no con el color real ni la textura. Por eso el script del
// examen corre también un control de texto-solo: sin él, "Jev perdió" y "el
// texto solo no alcanza" son indistinguibles.
import { DEFECTOS_MOTOR } from "@/lib/comparador/motor";
import { REGLAS_DE_LA_CASA } from "./reglas-ejecucion";
import { briefParaRubrica, type BriefRubrica } from "./rubrica";
import { esRuidoDeLaCasa } from "./juez-stylist";
import type { CriticaStylist, Gravedad, Hallazgo } from "./juez-stylist";
import type { PreguntaJev, RespuestaJev } from "@/lib/jev";

export const JUEZ_JEV_VERSION = "jv1";

/**
 * jv2 — EL MISMO EXAMEN CON EL ESTADO LIMPIO (2026-09-19).
 *
 * jv1 perdió, pero su estado llevaba el pedido, el look Y las ~20 reglas de la
 * casa completas en cada llamada. La propia documentación de TypeSafe (Jev 1.13
 * jaggedness) dice que "la precisión cae conforme el estado crece con contenido
 * no relacionado con la decisión", y para cualquier pregunta la mayoría de esas
 * reglas no tenía nada que ver. O sea: el examen metía justo lo que el
 * proveedor dice que lo degrada. jv2 quita esa duda.
 *
 * Qué cambia: el estado lleva el pedido y las prendas CON SUS ATRIBUTOS (color,
 * corte, material, formalidad), y nada más. Las preguntas y su `criteria` son
 * las MISMAS de jv1 — ahí ya viven los mitos medidos que le tocan a cada una
 * (marino con negro, café con jeans negros…), que es la parte de las reglas que
 * sí es de la decisión. Una sola variable cambia: el estado.
 */
export const JUEZ_JEV_VERSION_LIMPIO = "jv2";

type Attrs = Record<string, unknown>;

/**
 * Una prenda como texto, con los atributos que la base sí tiene medidos.
 *
 * Compartida entre el examen del juez (jv2) y el de gusto, para que "describir
 * una prenda" signifique lo mismo en los dos: si uno le diera el material y el
 * otro no, compararlos mediría la descripción, no el modelo.
 *
 * El hex NO va, a propósito: la misma documentación dice que Jev no sabe leer
 * números, y que los colores se le pasan por nombre.
 */
export function describirPrenda(nombre: string, attrs: Attrs | undefined): string {
  const a = attrs ?? {};
  const partes = ["color", "corte", "largo", "material", "patron", "formalidad"]
    .map((k) => (a[k] ? `${k}: ${a[k]}` : ""))
    .filter(Boolean);
  return partes.length ? `${nombre} [${partes.join("; ")}]` : nombre;
}

/** El look tal como lo puede leer un modelo sin ojos. */
export type LookEnTexto = {
  nombre: string;
  explicacion: string;
  tip: string | null;
  prendas: { nombre: string }[];
};

/**
 * QUÉ SE PREGUNTA POR CADA DEFECTO.
 *
 * El vocabulario es el MISMO de `DEFECTOS_MOTOR` —el que Roberto usa al votar—
 * por la razón de siempre: si el retador inventara sus etiquetas, su tabla y la
 * de js7 no se podrían poner una al lado de la otra.
 *
 * El `criteria` de cada pregunta es el ÚNICO lugar donde cabe el matiz en este
 * modelo, y ahí es donde va lo que esta casa ya midió y resultó falso. Es el
 * mismo error que js2 cometió (repetir sabiduría convencional sin medir) y la
 * misma cura: decirle explícitamente qué NO es defecto aquí.
 */
export const PREGUNTAS_DEFECTO: Record<string, { instructions: string; criteria: { true: string; false: string } }> = {
  clima: {
    instructions: "¿La ropa de este look está mal para el clima del día?",
    criteria: {
      true: "Pasaría frío o calor real con esto puesto, o el calzado no aguanta el agua un día de lluvia.",
      false: "Aguanta el día. Una capa de más que se puede quitar no es defecto.",
    },
  },
  ocasion: {
    instructions: "¿El registro del look está mal para la ocasión que pidió?",
    criteria: {
      true: "Llegaría notoriamente fuera de lugar: muy informal para un evento formal, o de traje completo a algo casual.",
      false: "Encaja en la ocasión. Estar un punto arriba o abajo del promedio no es defecto.",
    },
  },
  color: {
    instructions: "¿Hay una combinación de color que de verdad choca en este look?",
    criteria: {
      true: "Dos colores que pelean o dos neutros que se enlodan (beige con gris medio), o un acento que se come el look.",
      false: "La paleta se sostiene. Y OJO, esto YA SE MIDIÓ y NO es defecto en esta casa: blazer marino con pantalón negro, café con jeans negros, negro con burdeos.",
    },
  },
  proporcion: {
    instructions: "¿La proporción o la silueta del look está mal resuelta?",
    criteria: {
      true: "Los largos y volúmenes pelean: la línea del cuerpo se rompe, algo queda desbalanceado de arriba a abajo.",
      false: "La silueta se lee limpia.",
    },
  },
  capas: {
    instructions: "¿Este look tiene capas que nadie se pondría así en la vida real?",
    criteria: {
      true: "Una combinación de capas que se ve armada para la foto y no para salir a la calle.",
      false: "Las capas son normales. En clóset de hombre, un suéter de punto CON base debajo es la regla de la casa, no un defecto.",
    },
  },
  repetido: {
    instructions: "¿Este look es una repetición de algo obvio, sin decisión de stylist?",
    criteria: {
      true: "Es el uniforme más predecible que ese clóset podía dar para ese plan.",
      false: "Hay al menos una decisión. Y repetir el mismo uniforme en un funeral es lo correcto, no un defecto.",
    },
  },
  plano: {
    instructions: "¿El look es correcto pero le falta interés?",
    criteria: {
      true: "No hay textura, contraste ni una pieza que haga algo; es ropa puesta sin punto de vista.",
      false: "Algo en el look hace un movimiento.",
    },
  },
};

/**
 * LA ESCALA DE GRAVEDAD, en las palabras con las que Roberto vota.
 *
 * Va de menos a más y se pregunta APARTE de los defectos a propósito: los
 * `noul` dicen QUÉ está mal y esto dice CUÁNTO — que es justo la separación que
 * el juez vigente no logra hacer en una sola cabeza.
 */
export const NIVELES_GRAVEDAD = [
  "Se lo pondría tal cual; no hay nada que señalar.",
  "Está bien; hay un detalle fino que sólo vería un stylist.",
  "Hay algo que le resta, pero el look se sostiene y saldría a la calle así.",
  "Hay algo que rompe el look: no saldría así a la calle.",
];

/** Clave de la pregunta de gravedad en la llamada. No choca con ningún defecto. */
export const CLAVE_GRAVEDAD = "_gravedad";

/**
 * Las preguntas de una llamada: una por defecto + la escala. Todas juntas
 * porque en este modelo agregar preguntas casi no cuesta tiempo.
 */
export function preguntasDelJuez(): Record<string, PreguntaJev> {
  const qs: Record<string, PreguntaJev> = {};
  for (const d of DEFECTOS_MOTOR) {
    const p = PREGUNTAS_DEFECTO[d.clave];
    if (!p) continue;
    qs[d.clave] = { type: "noul", instructions: p.instructions, criteria: p.criteria };
  }
  qs[CLAVE_GRAVEDAD] = {
    type: "score",
    instructions: "¿Qué tan mal está este look para la persona y el plan que pidió?",
    criteria: NIVELES_GRAVEDAD,
  };
  return qs;
}

/**
 * EL ESTADO: todo el contexto en texto, una sola vez por look.
 *
 * Lleva las REGLAS DE LA CASA completas por la lección de js3: sin ellas, el
 * juez recomendaba romper reglas que nacieron de Roberto votando a ciegas
 * (quitarle la base al suéter) y el acierto se cayó de 88% a 47%. Aquí no puede
 * "recomendar" nada, pero sí marcar como defecto algo que la casa ya decidió
 * que es correcto — que es el mismo error por la otra cara.
 */
/** El estado de jv2: el pedido y las prendas descritas. Sin reglas de la casa. */
export function estadoLimpioParaJev(
  brief: BriefRubrica,
  prendas: { nombre: string; attrs?: Attrs }[]
): string {
  return [
    "PEDIDO DE LA PERSONA",
    briefParaRubrica(brief),
    "",
    "PRENDAS DEL LOOK",
    ...prendas.map((p) => `- ${describirPrenda(p.nombre, p.attrs)}`),
  ].join("\n");
}

export function estadoParaJev(brief: BriefRubrica, look: LookEnTexto): string {
  return [
    "PEDIDO DE LA PERSONA",
    briefParaRubrica(brief),
    "",
    "EL LOOK QUE LE ARMARON",
    `Nombre: ${look.nombre}`,
    `Prendas: ${look.prendas.map((p) => p.nombre).join(" + ")}`,
    look.explicacion ? `Por qué se lo propusieron: ${look.explicacion}` : "",
    look.tip ? `El toque que le sugirieron: ${look.tip}` : "",
    "",
    REGLAS_DE_LA_CASA,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * CÓMO SE PESA, y esto es el corazón del experimento.
 *
 * `umbral` es la probabilidad a partir de la cual un defecto cuenta. Empieza en
 * un lugar cualquiera a propósito: el punto bueno NO se adivina aquí, lo
 * encuentra el examen barriendo la curva contra los votos reales. Lo que este
 * archivo aporta es que el peso sea un número que se pueda mover, en vez de una
 * decisión enterrada en un prompt.
 */
export type PesosJuezJev = {
  /** Probabilidad mínima para que un defecto se reporte. */
  umbral: number;
  /** Gravedad máxima que puede alcanzar cada defecto. Lo que no esté aquí llega hasta "rompe". */
  tope: Record<string, Gravedad>;
};

/**
 * `tope` NACE VACÍO, y eso es un cambio respecto a la primera versión.
 *
 * Al principio topaba "plano" en `detalle`, porque el examen de js4 lo midió: de
 * 21 veces que el juez lo marcó, 18 fueron en looks que Roberto APROBÓ. Ahora
 * ese defecto ni siquiera llega hasta aquí — lo descarta `esRuidoDeLaCasa`, el
 * MISMO filtro que aplica js9 a su propia salida, y esa simetría es la que
 * permite poner las dos tablas una al lado de la otra.
 *
 * El mecanismo se queda porque el tope y el descarte no son lo mismo: topar es
 * "cuenta, pero no puede tirar el look"; descartar es "no cuenta". El día que
 * haya un defecto del primer tipo, aquí va.
 */
export const PESOS_INICIALES: PesosJuezJev = {
  umbral: 0.5,
  tope: {},
};

const ORDEN: Gravedad[] = ["detalle", "resta", "rompe"];

function topar(g: Gravedad, tope: Gravedad | undefined): Gravedad {
  if (!tope) return g;
  return ORDEN.indexOf(g) <= ORDEN.indexOf(tope) ? g : tope;
}

/**
 * La escala (0..3) a gravedad. `null` significa NO HAY NADA QUE MARCAR: es el
 * nivel 0, "se lo pondría tal cual".
 */
export function gravedadDeEscala(score: number): Gravedad | null {
  if (score >= 2.5) return "rompe";
  if (score >= 1.5) return "resta";
  if (score >= 0.5) return "detalle";
  return null;
}

/**
 * De las respuestas de Jev a la MISMA forma que entrega el juez vigente, para
 * que la tabla del examen no distinga de quién es la crítica que está contando.
 *
 * `pieza` y `arreglo` salen vacíos porque el modelo no los puede dar. Eso NO es
 * un pendiente de implementación: es la mitad del trabajo que este modelo no
 * hace, y queda a la vista en cada hallazgo en vez de disimulado.
 */
export function criticaDesdeJev(
  respuestas: Record<string, RespuestaJev>,
  pesos: PesosJuezJev = PESOS_INICIALES
): CriticaStylist {
  const escala = respuestas[CLAVE_GRAVEDAD];
  const nivel = escala?.type === "score" ? gravedadDeEscala(escala.score) : null;
  const hallazgos: Hallazgo[] = [];

  // ESCALA EN CERO = NADA QUE MARCAR, y separarlo de "no contestó" es la
  // diferencia entre medir y engañarse. La primera versión hacía
  // `nivel ?? "detalle"`, que convertía el "se lo pondría tal cual" del modelo
  // en un hallazgo de nivel detalle en cuanto CUALQUIER defecto pasaba el
  // umbral. Eso inflaba a la vez la caza y la falsa alarma en la fila de
  // "cualquier hallazgo" de todas las tablas del examen — las dos en la misma
  // dirección, que es la forma más fácil de no notarlo.
  //
  // Si la pregunta de escala NO vino contestada (`escala` ausente), eso sí es
  // un fallo de la llamada y no un veredicto: se degrada a `detalle` para no
  // perder el defecto en silencio.
  const faltaEscala = escala?.type !== "score";
  if (!nivel && !faltaEscala) return { resumen: "", hallazgos: [], loQueFunciona: "" };

  for (const d of DEFECTOS_MOTOR) {
    const r = respuestas[d.clave];
    if (r?.type !== "noul") continue;
    if (r.noul < pesos.umbral) continue;
    // EL MISMO filtro de ruido que js9 aplica a su propia salida. Sin esto el
    // retador emite "plano" y el campeón no, y la comparación deja de serlo.
    if (esRuidoDeLaCasa(d.clave)) continue;
    // La gravedad la pone la escala del look, no la confianza del defecto: que
    // el modelo esté seguro de que hay un choque de color no dice si ese choque
    // tira el look. Son las dos preguntas que el juez vigente confunde.
    const g = topar(nivel ?? "detalle", pesos.tope[d.clave]);
    hallazgos.push({
      pieza: "—",
      problema: `${d.label} (p=${r.noul.toFixed(2)})`,
      arreglo: "",
      gravedad: g,
      defecto: d.clave,
    });
  }

  return {
    resumen: "",
    hallazgos,
    loQueFunciona: "",
  };
}

// ── La parte que se puede medir sin llamar a nadie ─────────────────────────

export type CasoMedible = {
  /** Probabilidad por defecto, como la devolvió el modelo. */
  probabilidades: Record<string, number>;
  /** La escala 0..3 del look. */
  escala: number;
  /** El voto de Roberto: `abajo` es 👎. */
  marca: "arriba" | "abajo";
};

export type PuntoDeCurva = {
  umbral: number;
  /** De los 👎, cuántos habría marcado. */
  caza: number;
  totalAbajo: number;
  /** De los 👍, cuántos habría marcado. */
  falsaAlarma: number;
  totalArriba: number;
};

/**
 * LA CURVA. Para cada umbral, cuántos 👎 caza y cuántos 👍 ensucia.
 *
 * Es lo que el juez vigente no puede dar: como entrega una gravedad ya decidida,
 * tiene UN punto de operación y no se puede mover sin reescribir el prompt y
 * volver a pagar la corrida. Aquí la corrida es una y la curva sale gratis.
 */
export function curvaDeUmbral(
  casos: CasoMedible[],
  defectos: string[],
  umbrales: number[] = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
): PuntoDeCurva[] {
  const abajo = casos.filter((c) => c.marca === "abajo");
  const arriba = casos.filter((c) => c.marca === "arriba");
  const marca = (c: CasoMedible, u: number) =>
    defectos.some((d) => (c.probabilidades[d] ?? 0) >= u);
  return umbrales.map((umbral) => ({
    umbral,
    caza: abajo.filter((c) => marca(c, umbral)).length,
    totalAbajo: abajo.length,
    falsaAlarma: arriba.filter((c) => marca(c, umbral)).length,
    totalArriba: arriba.length,
  }));
}

export type Discriminacion = {
  defecto: string;
  /** Probabilidad media en los looks que Roberto reprobó. */
  mediaAbajo: number;
  /** Probabilidad media en los que aprobó. */
  mediaArriba: number;
  /** La diferencia. Cerca de 0 = la pregunta no separa nada y sobra. */
  separacion: number;
};

/**
 * QUÉ PREGUNTA SIRVE Y CUÁL SOBRA.
 *
 * Es el diagnóstico que este formato hace posible y el otro no: con una
 * probabilidad por defecto se puede ver cuál se mueve entre los 👍 y los 👎 de
 * Roberto. Una separación cerca de cero significa que esa pregunta no está
 * midiendo su gusto — como pasó con "plano".
 */
export function discriminacion(casos: CasoMedible[], defectos: string[]): Discriminacion[] {
  const media = (cs: CasoMedible[], d: string) =>
    cs.length ? cs.reduce((a, c) => a + (c.probabilidades[d] ?? 0), 0) / cs.length : 0;
  const abajo = casos.filter((c) => c.marca === "abajo");
  const arriba = casos.filter((c) => c.marca === "arriba");
  return defectos
    .map((defecto) => {
      const mediaAbajo = media(abajo, defecto);
      const mediaArriba = media(arriba, defecto);
      return { defecto, mediaAbajo, mediaArriba, separacion: mediaAbajo - mediaArriba };
    })
    .sort((a, b) => b.separacion - a.separacion);
}
