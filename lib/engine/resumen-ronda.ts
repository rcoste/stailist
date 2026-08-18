import { DEFECTOS_MOTOR } from "@/lib/comparador/motor";
import type { CriticaStylist, Gravedad, Hallazgo } from "./juez-stylist";

// DE 240 NOTAS SUELTAS A "ESTOS SON LOS 6 PROBLEMAS", que es el trabajo manual
// que Roberto quiere quitarse.
//
// EL PROBLEMA QUE RESUELVE: una corrida de 40 pares son ~240 looks juzgados.
// Hoy las notas se ven de una en una en la pantalla del eval. Nadie las suma, y
// una pila que nadie lee es lo mismo que no tenerla — es exactamente lo que
// pasó con la tabla `ai_calls`, que existía, nadie leía, y por eso el
// precalentado roto vivió dos semanas.
//
// LO QUE ESTE ARCHIVO NO HACE: decidir. Ordena por frecuencia y gravedad para
// que la siguiente decisión sea fácil de tomar, pero el ajuste al motor lo
// decide una persona leyendo esto. Un resumen que además propusiera el cambio
// sería un optimizador, y un optimizador contra los hallazgos de un juez es la
// puerta de atrás de Goodhart.
//
// AGRUPA POR EL VOCABULARIO DE `DEFECTOS_MOTOR` a propósito: son las mismas
// etiquetas que Roberto usa al votar a mano. Así sus marcas y los hallazgos del
// juez se cuentan en el mismo idioma y se pueden contrastar — que es la única
// forma de saber si el juez está viendo lo que él vería.

export type TemaDeRonda = {
  /** La clave del defecto (vocabulario de DEFECTOS_MOTOR). */
  defecto: string;
  /** Cómo se llama para quien lee. */
  label: string;
  /** En cuántos LOOKS apareció (no cuántos hallazgos: un look con dos hallazgos
   *  del mismo tema cuenta una vez, o los looks ruidosos dominarían la lista). */
  looks: number;
  /** Hallazgos totales del tema, para ver si se concentra o se reparte. */
  hallazgos: number;
  /** El peor grado visto: un tema que ROMPE looks pesa más que uno que resta. */
  peor: Gravedad;
  /** Cuántos de los hallazgos rompen el look. */
  rompen: number;
  /** Hasta 3 ejemplos textuales, para no tener que abrir los looks. */
  ejemplos: { pieza: string; problema: string; arreglo: string }[];
};

export type ResumenRonda = {
  /** Looks juzgados por el stylist en la ronda. */
  looks: number;
  /** Looks con al menos un hallazgo. */
  conHallazgos: number;
  /** Looks con al menos un hallazgo que ROMPE. */
  conRotos: number;
  /** Los temas, ordenados: primero lo que rompe, después lo frecuente. */
  temas: TemaDeRonda[];
};

const ORDEN: Record<Gravedad, number> = { rompe: 0, resta: 1, detalle: 2 };

const LABEL = new Map(DEFECTOS_MOTOR.map((d) => [d.clave as string, d.label]));

/**
 * Junta las críticas de una ronda en temas.
 *
 * EL ORDEN ES LA PARTE ÚTIL, y no es alfabético ni por frecuencia a secas:
 * primero lo que ROMPE looks (aunque salga poco: un fallo que tira el look es
 * más caro que uno que lo desluce), y dentro de eso, por en cuántos looks
 * apareció. Un tema que sale en 14 de 40 looks es una regla que falta; uno que
 * sale en 1 es una anécdota.
 */
export function resumirRonda(criticas: CriticaStylist[]): ResumenRonda {
  const porTema = new Map<
    string,
    { looks: Set<number>; hallazgos: Hallazgo[]; }
  >();

  criticas.forEach((c, i) => {
    for (const h of c.hallazgos) {
      const e = porTema.get(h.defecto) ?? { looks: new Set<number>(), hallazgos: [] };
      e.looks.add(i);
      e.hallazgos.push(h);
      porTema.set(h.defecto, e);
    }
  });

  const temas: TemaDeRonda[] = [...porTema.entries()]
    .map(([defecto, e]) => {
      const peor = e.hallazgos.reduce<Gravedad>(
        (acc, h) => (ORDEN[h.gravedad] < ORDEN[acc] ? h.gravedad : acc),
        "detalle"
      );
      return {
        defecto,
        label: LABEL.get(defecto) ?? defecto,
        looks: e.looks.size,
        hallazgos: e.hallazgos.length,
        peor,
        rompen: e.hallazgos.filter((h) => h.gravedad === "rompe").length,
        // Los ejemplos salen de los MÁS GRAVES, no de los primeros: si un tema
        // tiene uno que rompe y nueve detalles, el que hay que leer es el que
        // rompe.
        ejemplos: [...e.hallazgos]
          .sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad])
          .slice(0, 3)
          .map((h) => ({ pieza: h.pieza, problema: h.problema, arreglo: h.arreglo })),
      };
    })
    .sort(
      (a, b) =>
        ORDEN[a.peor] - ORDEN[b.peor] || b.looks - a.looks || b.hallazgos - a.hallazgos
    );

  return {
    looks: criticas.length,
    conHallazgos: criticas.filter((c) => c.hallazgos.length > 0).length,
    conRotos: criticas.filter((c) => c.hallazgos.some((h) => h.gravedad === "rompe"))
      .length,
    temas,
  };
}

/**
 * El mismo resumen, partido por variante — que es la lectura que contesta
 * "¿qué motor fue mejor Y en qué?".
 *
 * Un marcador dice CUÁL ganó; esto dice EN QUÉ, que es lo que se puede
 * convertir en el siguiente ajuste. Sin esto la ronda contesta "A ganó" y deja
 * a quien lee sin saber qué tocar.
 */
export function resumirPorVariante(
  porVariante: Record<string, CriticaStylist[]>
): Record<string, ResumenRonda> {
  return Object.fromEntries(
    Object.entries(porVariante).map(([clave, criticas]) => [clave, resumirRonda(criticas)])
  );
}
