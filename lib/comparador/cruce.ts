import type { BriefMotor } from "./motor";
import type { CorridaMotorCargada } from "./motor-servidor";

// ¿EL JUEZ VE LO QUE VE ROBERTO? El cruce que ningún juez puede hacer solo.
//
// POR QUÉ EXISTE, con el número que lo pide: al cruzar a mano la primera ronda
// votada (283d8d44, 32 looks) salió que coincidieron en 5, que hubo **0** looks
// donde Roberto marcara algo que el juez no viera, y **20** donde el juez marcó
// y él no. El 0 es la buena noticia —el juez no tiene puntos ciegos— y el 20 es
// la pregunta abierta: o ve lo que Roberto pasa por alto, o inventa problemas.
//
// Ese cruce vivía en un script suelto y llegaba como un archivo por chat.
// Roberto: "no nada más el HTML, sino poder poner yo ahí comentarios para que
// sea más fácil que lo proceses". Una medición que sólo existe cuando alguien
// la pide a mano es una medición que no se hace — el mismo destino que tuvo la
// tabla `ai_calls`, que existía, nadie leía, y por eso el precalentado roto
// vivió dos semanas.
//
// LO QUE ESTE ARCHIVO NO HACE: decidir. Reparte los looks en cuatro cajas y
// cuenta; qué significa el 20 lo dice una persona calificando los hallazgos.

/** En qué caja del cruce cae un look. */
export type CajaCruce = "coinciden" | "soloHumano" | "soloJuez" | "limpios";

export type LookCruzado = {
  parId: string;
  parN: number;
  variante: string;
  /** Índice del look dentro de su lado — la llave de todas las columnas _look. */
  indice: number;
  nombre: string;
  itemIds: string[];
  /**
   * EL BRIEF QUE PIDIÓ ESTE LOOK, en la tarjeta. Sin él no se puede calificar
   * un hallazgo: "rompe el clima" es justo o injusto según si el brief decía
   * 8°C con lluvia o 24°C despejado, y las tarjetas del cruce están agrupadas
   * por caja, no por par — así que el contexto no se puede leer del encabezado
   * como en la pantalla de votar. Roberto: "no quitaste esa información,
   * entonces me es complicado el evaluar sin ese contexto completo".
   */
  brief: BriefMotor;
  caja: CajaCruce;
  /** Lo que puso la persona. */
  humano: {
    marca: "arriba" | "abajo" | null;
    defectos: string[];
    comentario: string | null;
  };
  /** Lo que puso el juez stylist. */
  juez: {
    defectos: string[];
    rompe: number;
    hallazgos: { defecto: string; pieza: string; problema: string; arreglo: string }[];
  };
  /** Si los dos marcaron, ¿usaron la misma etiqueta? Sólo aplica en "coinciden". */
  mismaEtiqueta: boolean;
  /** La calificación AL JUEZ ya guardada, si la hay. */
  veredicto: { v?: "acuerdo" | "exagero"; nota?: string } | null;
};

export type ResumenCruce = {
  looks: LookCruzado[];
  conteo: Record<CajaCruce, number>;
  /** De los que el juez marcó y la persona no: cuántos ya están calificados. */
  calificados: number;
  porCalificar: number;
  /** Cuántas veces se le dio la razón al juez y cuántas se le dijo que se pasó. */
  acuerdo: number;
  exagero: number;
};

/**
 * Reparte los looks de una corrida VOTADA en las cuatro cajas del cruce.
 *
 * Los espejos se saltan: repiten los looks de su original, así que contarlos
 * duplicaría cada coincidencia y falsearía el marcador del juez.
 *
 * "Marcó" para la persona es 👎 **o** una etiqueta de defecto. Un 👍 con
 * etiqueta cuenta como marca: aprobar el look y anotarle un pero es
 * exactamente lo que pasó en dos de los cinco casos de la primera ronda.
 */
export function cruzarCorrida(corrida: CorridaMotorCargada): ResumenCruce {
  const looks: LookCruzado[] = [];

  for (const par of corrida.pares) {
    if (par.repiteDe || !par.voto) continue;
    for (const lado of par.lados) {
      const criticas = lado.criticas ?? [];
      (lado.looks ?? []).forEach((lk, i) => {
        const clave = String(i);
        const marca =
          (par.marcasLook?.[lado.variante]?.[clave] as "arriba" | "abajo") ?? null;
        const defectos = par.defectosLook?.[lado.variante]?.[clave] ?? [];
        const comentario = par.comentariosLook?.[lado.variante]?.[clave] ?? null;
        const hallazgos = criticas[i]?.hallazgos ?? [];
        const defsJuez = [...new Set(hallazgos.map((h) => h.defecto))];

        const marcoHumano = marca === "abajo" || defectos.length > 0;
        const marcoJuez = hallazgos.length > 0;
        const caja: CajaCruce =
          marcoHumano && marcoJuez
            ? "coinciden"
            : marcoHumano
              ? "soloHumano"
              : marcoJuez
                ? "soloJuez"
                : "limpios";

        looks.push({
          parId: par.id,
          parN: par.n,
          variante: lado.variante,
          indice: i,
          nombre: lk.nombre,
          itemIds: lk.item_ids ?? [],
          brief: par.brief,
          caja,
          humano: { marca, defectos, comentario },
          juez: {
            defectos: defsJuez,
            rompe: hallazgos.filter((h) => h.gravedad === "rompe").length,
            hallazgos: hallazgos.map((h) => ({
              defecto: h.defecto,
              pieza: h.pieza,
              problema: h.problema,
              arreglo: h.arreglo,
            })),
          },
          mismaEtiqueta:
            caja === "coinciden" && defectos.some((d) => defsJuez.includes(d)),
          veredicto: par.veredictosJuez?.[lado.variante]?.[clave] ?? null,
        });
      });
    }
  }

  const conteo: Record<CajaCruce, number> = {
    coinciden: 0,
    soloHumano: 0,
    soloJuez: 0,
    limpios: 0,
  };
  for (const l of looks) conteo[l.caja]++;

  // El pendiente se cuenta SOLO sobre lo que el juez marcó: calificar un look
  // que nadie marcó no dice nada del juez, y meterlo en el denominador haría
  // que la barra de avance no llegue nunca.
  const juzgables = looks.filter((l) => l.juez.hallazgos.length > 0);
  const calificados = juzgables.filter((l) => l.veredicto?.v).length;

  return {
    looks,
    conteo,
    calificados,
    porCalificar: juzgables.length - calificados,
    acuerdo: juzgables.filter((l) => l.veredicto?.v === "acuerdo").length,
    exagero: juzgables.filter((l) => l.veredicto?.v === "exagero").length,
  };
}
