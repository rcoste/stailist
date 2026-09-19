import { describe, expect, it } from "vitest";
import { pct, tiene, UMBRALES_GRAVEDAD } from "./tabla-examen";
import type { CriticaStylist, Gravedad } from "@/lib/engine/juez-stylist";
import { muestrearParaExamen, FIN_DEL_AFINADO, type CasoVotado } from "./casos-votados";

// La aritmética del examen se prueba porque es la razón de ser del archivo: dos
// exámenes que cuenten distinto producen la peor clase de resultado, uno que se
// lee como comparación y no lo es.

const critica = (...gs: Gravedad[]): CriticaStylist => ({
  resumen: "",
  loQueFunciona: "",
  hallazgos: gs.map((gravedad, i) => ({
    pieza: "x",
    problema: "y",
    arreglo: "z",
    gravedad,
    defecto: ["color", "clima", "ocasion"][i % 3],
  })),
});

describe("pct", () => {
  it("redondea al entero", () => {
    expect(pct(1, 3)).toBe("33%");
    expect(pct(2, 3)).toBe("67%");
  });

  it("con denominador cero NO dice 0% — dice que no hay nada que medir", () => {
    // Un lado vacío con "0%" se lee como un resultado perfecto. Es la diferencia
    // entre "no falló nunca" y "nunca se midió".
    expect(pct(0, 0)).toBe("—");
  });

  it("0 de N sí es 0%", () => {
    expect(pct(0, 12)).toBe("0%");
  });
});

describe("tiene", () => {
  it("un umbral estricto no cuenta los hallazgos leves", () => {
    expect(tiene(critica("detalle"), ["rompe"])).toBe(false);
    expect(tiene(critica("rompe"), ["rompe"])).toBe(true);
  });

  it("basta UN hallazgo del nivel buscado, aunque el resto sean leves", () => {
    expect(tiene(critica("detalle", "detalle", "rompe"), ["rompe"])).toBe(true);
  });

  it("una crítica sin hallazgos no cuenta en ningún umbral", () => {
    for (const [, niveles] of UMBRALES_GRAVEDAD) expect(tiene(critica(), niveles)).toBe(false);
  });

  it("un look sin crítica no cuenta como marcado", () => {
    // Sale null cuando la ronda corrió sin juez. Contarlo como marcado inflaría
    // la caza; contarlo como limpio inflaría la falsa alarma. No cuenta.
    for (const [, niveles] of UMBRALES_GRAVEDAD) expect(tiene(null, niveles)).toBe(false);
  });
});

describe("los umbrales de la casa", () => {
  it("son tres y van de estricto a permisivo, cada uno conteniendo al anterior", () => {
    // Si un umbral dejara de contener al anterior, las tres filas de la tabla
    // dejarían de ser una escala y pasarían a ser tres medidas distintas.
    expect(UMBRALES_GRAVEDAD).toHaveLength(3);
    for (let i = 1; i < UMBRALES_GRAVEDAD.length; i++)
      for (const nivel of UMBRALES_GRAVEDAD[i - 1][1])
        expect(UMBRALES_GRAVEDAD[i][1], `${UMBRALES_GRAVEDAD[i][0]} debe contener ${nivel}`).toContain(nivel);
  });
});

// El muestreo vive junto al cargador de casos, pero se prueba aquí con el resto
// de la aritmética del examen: es la otra decisión que, si difiere entre dos
// exámenes, hace que sus tablas no se puedan comparar sin que nada lo avise.
describe("muestrearParaExamen", () => {
  const caso = (creada: string) => ({ creada }) as unknown as CasoVotado;
  const viejos = Array.from({ length: 10 }, () => caso("2026-08-01T00:00:00Z"));
  const nuevos = Array.from({ length: 40 }, (_, i) => caso(`2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`));
  const todos = [...viejos, ...nuevos];

  it("sin límite devuelve todo, sin filtrar", () => {
    expect(muestrearParaExamen(todos, 0)).toHaveLength(50);
  });

  it("con límite deja fuera las rondas que el juez vio al afinarse", () => {
    for (const c of muestrearParaExamen(todos, 10)) expect(c.creada > FIN_DEL_AFINADO).toBe(true);
  });

  it("es determinista: dos corridas del mismo N miden los MISMOS looks", () => {
    // Es lo que permite comparar una versión del juez con la siguiente. Con una
    // muestra al azar, la diferencia entre dos corridas incluiría qué looks tocaron.
    expect(muestrearParaExamen(todos, 12)).toEqual(muestrearParaExamen(todos, 12));
  });

  it("nunca devuelve más de lo pedido", () => {
    expect(muestrearParaExamen(todos, 7).length).toBeLessThanOrEqual(7);
  });

  it("pedir más de lo que hay no truena ni repite", () => {
    const m = muestrearParaExamen(todos, 999);
    expect(m.length).toBe(nuevos.length);
    expect(new Set(m).size).toBe(m.length);
  });
});
