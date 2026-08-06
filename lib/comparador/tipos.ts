import { modeloPorId } from "@/lib/proveedores/catalogo";
import { costoUsd } from "@/lib/proveedores/precios";

// Lo puro del comparador: tipos, marcador y estimado. Sin tocar la base, para
// que las pantallas del cliente puedan importarlo sin arrastrar el servidor.

export type Modo = "una" | "varias";

/**
 * Campos que se califican. TODOS los que el modelo puede devolver, no una
 * selección mía.
 *
 * Al principio puse siete y dejé fuera largo, corte y manga. Estaba mal: esos
 * tres SÍ llegan al motor (describeItem los manda) y salen en los consejos de
 * cómo llevar la prenda. Calificar un modelo sin poder marcar esos campos
 * medía menos de lo que la app usa.
 *
 * `descripcion` va aparte porque es un párrafo y no un dato corto — ver
 * CAMPO_LARGO. Es donde vive el detalle fino (Derby contra Oxford, saco cruzado
 * contra sencillo) y hasta ahora la pantalla lo escondía.
 */
export const CAMPOS_JUZGABLES = [
  "nombre",
  "categoria",
  "color",
  "material",
  "subtipo",
  "formalidad",
  "temporada",
  "patron",
  "corte",
  "largo",
  "manga",
  "color_secundario",
  "contexto",
] as const;

/** Se muestra como bloque de texto, no como etiqueta corta. */
export const CAMPO_LARGO = "descripcion";

/**
 * El juicio sobre una lectura. Dos formas, porque son dos preguntas.
 *
 * En una prenda sola sólo se puede leer mal. En una foto con varias hay TRES
 * formas de fallar, y la que más caro sale es la de inventar: una prenda que no
 * existe se guarda con su render limpio, se ve igual de real que las demás, y
 * no hay forma de detectarla desde la app hasta que aparece en un outfit. A
 * Roberto le tomó dos meses cazar tres.
 */
export type Veredicto = (
  | { camposMal: string[] }
  | { inventadas: number[]; faltaron: number; camposMal: Record<string, string[]> }
) & {
  /**
   * Lo que no cabe en marcar un campo. "Le dio el beneficio de la duda al
   * color, la luz estaba imposible"; "leyó la prenda de mi esposa"; "dijo
   * chelsea y son chukka".
   *
   * Existe porque los campos son casillas y el juicio real casi nunca lo es.
   * Sin esto, todo lo que Roberto nota mientras califica se queda en su cabeza
   * y a los tres días ya no está — que es exactamente lo que pasó con el reloj
   * de la foto de su esposa, que salió a la luz por casualidad al conversarlo.
   */
  nota?: string;
};

export type Lectura = {
  modeloId: string;
  salida: unknown;
  error: string | null;
  costoUsd: number | null;
  ms: number | null;
  veredicto: Veredicto | null;
};

export type FotoComparada = {
  fotoId: string;
  n: number;
  url: string | null;
  /** Ya barajadas: el orden de la pantalla, no el de la corrida. */
  lecturas: Lectura[];
};

export type ResultadoModelo = {
  modeloId: string;
  etiqueta: string;
  fotosJuzgadas: number;
  /** Fotos sin inventar, sin omitir y sin un campo mal. */
  impecables: number;
  /** Prendas que inventó, sumadas. El error caro. */
  inventadas: number;
  /** Prendas que se le fueron. */
  omitidas: number;
  fallosPorCampo: Record<string, number>;
  errores: number;
  costoTotal: number | null;
  /** Lo que costaría leer 30 fotos, que es un onboarding real. */
  costoPor30: number | null;
  msPromedio: number | null;
  /** Lo que Roberto escribió sobre este modelo, foto por foto. */
  notas: string[];
};

function esMulti(
  v: Veredicto
): v is { inventadas: number[]; faltaron: number; camposMal: Record<string, string[]> } {
  return "inventadas" in v;
}

/**
 * El marcador. Sólo cuenta lecturas ya juzgadas: mezclar las pendientes
 * inflaría a quien todavía no se revisa.
 *
 * ORDEN: primero por prendas inventadas (menos es mejor), luego por impecables.
 * Inventar manda sobre todo lo demás porque es el único error que la persona no
 * puede detectar — leer mal un material se corrige en un tap cuando lo ve; una
 * prenda que no existe se queda en el clóset para siempre.
 */
export function marcador(fotos: FotoComparada[]): ResultadoModelo[] {
  type Acc = ResultadoModelo & { msSuma: number; msN: number; costoN: number };
  const acc = new Map<string, Acc>();

  for (const f of fotos) {
    for (const l of f.lecturas) {
      if (!acc.has(l.modeloId)) {
        acc.set(l.modeloId, {
          modeloId: l.modeloId,
          etiqueta: modeloPorId(l.modeloId)?.etiqueta ?? l.modeloId,
          fotosJuzgadas: 0,
          impecables: 0,
          inventadas: 0,
          omitidas: 0,
          fallosPorCampo: {},
          errores: 0,
          costoTotal: 0,
          costoPor30: null,
          msPromedio: null,
          notas: [],
          msSuma: 0,
          msN: 0,
          costoN: 0,
        });
      }
      const a = acc.get(l.modeloId)!;
      if (l.error) a.errores++;
      if (l.costoUsd != null) {
        a.costoTotal = (a.costoTotal ?? 0) + l.costoUsd;
        a.costoN++;
      }
      if (l.ms != null) {
        a.msSuma += l.ms;
        a.msN++;
      }
      if (!l.veredicto) continue;
      const nota = l.veredicto.nota?.trim();
      if (nota) a.notas.push(nota);

      a.fotosJuzgadas++;
      const v = l.veredicto;
      if (esMulti(v)) {
        a.inventadas += v.inventadas.length;
        a.omitidas += v.faltaron;
        let limpia = v.inventadas.length === 0 && v.faltaron === 0;
        for (const campos of Object.values(v.camposMal)) {
          for (const c of campos) {
            a.fallosPorCampo[c] = (a.fallosPorCampo[c] ?? 0) + 1;
            limpia = false;
          }
        }
        if (limpia) a.impecables++;
      } else {
        for (const c of v.camposMal) a.fallosPorCampo[c] = (a.fallosPorCampo[c] ?? 0) + 1;
        if (v.camposMal.length === 0) a.impecables++;
      }
    }
  }

  return [...acc.values()]
    .map((a) => ({
      modeloId: a.modeloId,
      etiqueta: a.etiqueta,
      fotosJuzgadas: a.fotosJuzgadas,
      impecables: a.impecables,
      inventadas: a.inventadas,
      omitidas: a.omitidas,
      fallosPorCampo: a.fallosPorCampo,
      errores: a.errores,
      costoTotal: a.costoN ? a.costoTotal : null,
      costoPor30: a.costoN ? ((a.costoTotal ?? 0) / a.costoN) * 30 : null,
      msPromedio: a.msN ? Math.round(a.msSuma / a.msN) : null,
      notas: a.notas,
    }))
    .sort(
      (x, y) =>
        x.inventadas - y.inventadas ||
        y.impecables / (y.fotosJuzgadas || 1) - x.impecables / (x.fotosJuzgadas || 1)
    );
}

/**
 * Lo que costaría una corrida ANTES de lanzarla, para que la decisión de
 * tamaño se tome con el número enfrente y no después en la factura.
 *
 * Los tamaños salen de MEDIR llamadas reales, no de suponerlas: una foto del
 * clóset gastó entre 2,018 y 3,473 tokens de entrada según el proveedor. Se
 * toma el caso caro para que el estimado nunca quede corto — llevarse una
 * sorpresa al alza es justo lo que esta pantalla existe para evitar. Y leer
 * VARIAS prendas devuelve mucho más texto: cada prenda trae su descripción
 * larga para el generador de imágenes.
 */
export function estimado(modelos: string[], nFotos: number, modo: Modo): number | null {
  const salida = modo === "varias" ? 1400 : 130;
  let total = 0;
  for (const id of modelos) {
    const c = costoUsd(id, { entrada: 3500, salida });
    if (c === null) return null;
    total += c * nFotos;
  }
  return total;
}
