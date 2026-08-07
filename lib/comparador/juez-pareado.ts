import type { NotaRubrica } from "@/lib/engine/rubrica";
import { pBinomial } from "./motor";

// EL INSTRUMENTO PAREADO: la rúbrica juzga A contra B sobre el MISMO brief.
//
// EL PROBLEMA QUE RESUELVE, medido: dos corridas del eval con EL MISMO CÓDIGO
// dieron 76% y 88% de aprobación. Doce puntos. Con esa varianza, comparar dos
// versiones con una corrida cada una no distingue una mejora real del ruido —
// y así se tomaron varias decisiones de prompt durante el 7 de agosto, todas
// con la honestidad de decir "esto no es concluyente".
//
// LA VARIANZA QUE DOMINA ES LA DEL DÍA, no la del motor: un brief de lluvia con
// un clóset corto produce looks peores que uno de diario templado, y qué briefs
// toquen a cada corrida mueve el promedio más que el cambio que se quiere medir.
// Comparar A y B sobre EL MISMO brief cancela esa varianza por construcción: es
// la diferencia entre medir dos personas con la misma báscula y medirlas en dos
// básculas distintas.
//
// POR QUÉ LA RÚBRICA SÍ PUEDE JUZGAR ESTO (y no puede coronar un modelo)
// Está escrito en rubrica.ts desde que nació: "sirve para ITERAR (prompt,
// reglas, pool): los dos lados corren el mismo juez y la comparación es
// interna. NO sirve para coronar un MODELO: un juez Claude tiende a preferir
// looks escritos por Claude". Aquí los dos lados salen del MISMO prompt con UNA
// cosa cambiada, así que el sesgo del juez se aplica igual a los dos y se
// cancela. Cuando la variable es el modelo, esto NO decide — decide el voto
// ciego humano.
//
// Y EL JUEZ NO SABE QUIÉN ES QUIÉN: recibe brief + look, nunca la etiqueta de
// la variante. No hay ciego que romper porque no hay nada que revelar.

/** La nota de un look, ya resuelta a un número comparable. */
export function puntajeDeNota(n: NotaRubrica): number {
  // Las seis dimensiones pesan igual. Ponderarlas sería meter una opinión
  // —¿el clima vale más que el wow?— justo en la pieza que existe para quitar
  // opiniones de la medición. Si algún día se ponderan, que sea con evidencia.
  return (n.ocasion + n.clima + n.armado + n.estilo + n.color + n.wow) / 6;
}

export type LadoJuzgado = {
  variante: string;
  /** Una nota por look del lado. */
  notas: NotaRubrica[];
};

export type ParJuzgado = {
  n: number;
  etiqueta: string;
  lados: LadoJuzgado[];
};

export type ResultadoPareado = {
  /** Pares donde los dos lados tienen al menos un look calificado. */
  comparables: number;
  /** Victorias por clave de variante. */
  gana: Record<string, number>;
  empates: number;
  /** p del sign test sobre los pares decididos. null si no hay ninguno. */
  p: number | null;
  /** La diferencia media de puntaje (A − B), con su error estándar. */
  diferencia: { media: number; se: number; t: number | null } | null;
  /** Promedio por dimensión y por variante, para leer DÓNDE está la diferencia. */
  porDimension: Record<string, Record<string, number>>;
};

const DIMS = ["ocasion", "clima", "armado", "estilo", "color", "wow"] as const;

/**
 * El marcador pareado. `claves` fija el orden: la diferencia se calcula como
 * claves[0] − claves[1].
 */
export function marcadorPareado(
  pares: ParJuzgado[],
  claves: [string, string]
): ResultadoPareado {
  const gana: Record<string, number> = { [claves[0]]: 0, [claves[1]]: 0 };
  let empates = 0;
  const diferencias: number[] = [];
  const dims: Record<string, Record<string, number[]>> = {
    [claves[0]]: {},
    [claves[1]]: {},
  };

  for (const par of pares) {
    const de = (clave: string) => par.lados.find((l) => l.variante === clave);
    const a = de(claves[0]);
    const b = de(claves[1]);
    if (!a?.notas.length || !b?.notas.length) continue; // no comparable

    // El puntaje del LADO es el promedio de sus looks: los 2-3 looks de un lado
    // salen de UNA llamada al motor, así que contarlos por separado inflaría la
    // significancia. La unidad del experimento sigue siendo el par — la misma
    // decisión que ya tomó el voto humano.
    const pa = a.notas.reduce((s, n) => s + puntajeDeNota(n), 0) / a.notas.length;
    const pb = b.notas.reduce((s, n) => s + puntajeDeNota(n), 0) / b.notas.length;

    diferencias.push(pa - pb);
    if (pa > pb) gana[claves[0]]++;
    else if (pb > pa) gana[claves[1]]++;
    else empates++;

    for (const [clave, lado] of [
      [claves[0], a],
      [claves[1], b],
    ] as const) {
      for (const d of DIMS) {
        (dims[clave][d] ??= []).push(
          lado.notas.reduce((s, n) => s + (n[d] ?? 3), 0) / lado.notas.length
        );
      }
    }
  }

  // El test PAREADO sobre las diferencias: cada par aporta un número (A − B), y
  // la varianza del brief ya se fue al restar. Ahí está toda la ganancia.
  let diferencia: ResultadoPareado["diferencia"] = null;
  if (diferencias.length > 1) {
    const media = diferencias.reduce((a, b) => a + b, 0) / diferencias.length;
    const varianza =
      diferencias.reduce((a, b) => a + (b - media) ** 2, 0) / (diferencias.length - 1);
    const se = Math.sqrt(varianza / diferencias.length);
    diferencia = {
      media: Math.round(media * 1000) / 1000,
      se: Math.round(se * 1000) / 1000,
      t: se > 0 ? Math.round((media / se) * 100) / 100 : null,
    };
  }

  const porDimension: Record<string, Record<string, number>> = {};
  for (const clave of claves) {
    porDimension[clave] = {};
    for (const d of DIMS) {
      const xs = dims[clave][d] ?? [];
      porDimension[clave][d] = xs.length
        ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100
        : 0;
    }
  }

  return {
    comparables: diferencias.length,
    gana,
    empates,
    p: pBinomial(gana[claves[0]], gana[claves[1]]),
    diferencia,
    porDimension,
  };
}

/**
 * Cuántos pares hacen falta para detectar una diferencia de `efecto` puntos,
 * dada la desviación de las diferencias observadas.
 *
 * Existe para poder decir "con esto no alcanza" ANTES de gastar, en vez de
 * después. La fórmula es la de dos colas con 80% de poder: n ≈ 8·(sd/efecto)².
 */
export function paresNecesarios(sdDeDiferencias: number, efecto = 0.2): number {
  if (efecto <= 0 || sdDeDiferencias <= 0) return 0;
  return Math.ceil(8 * (sdDeDiferencias / efecto) ** 2);
}
