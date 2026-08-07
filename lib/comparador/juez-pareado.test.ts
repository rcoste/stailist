import { describe, it, expect } from "vitest";
import { marcadorPareado, paresNecesarios, puntajeDeNota } from "./juez-pareado";
import type { NotaRubrica } from "@/lib/engine/rubrica";

// El instrumento pareado nace de un número: dos corridas del eval CON EL MISMO
// CÓDIGO dieron 76% y 88%. Doce puntos de varianza. Lo que estos tests protegen
// es que la comparación cancele la varianza del brief, que es donde está toda
// la ganancia.

const nota = (p: Partial<NotaRubrica> = {}): NotaRubrica => ({
  analisis: "x",
  ocasion: 4,
  clima: 4,
  armado: 4,
  estilo: 4,
  color: 4,
  wow: 4,
  aprobado: true,
  porQue: "x",
  ...p,
});

const par = (n: number, a: NotaRubrica[], b: NotaRubrica[]) => ({
  n,
  etiqueta: `brief ${n}`,
  lados: [
    { variante: "A", notas: a },
    { variante: "B", notas: b },
  ],
});

describe("marcadorPareado", () => {
  it("gana quien saca mejor promedio EN EL MISMO brief", () => {
    const r = marcadorPareado(
      [
        par(1, [nota({ wow: 5 })], [nota({ wow: 3 })]),
        par(2, [nota({ wow: 5 })], [nota({ wow: 3 })]),
      ],
      ["A", "B"]
    );
    expect(r.gana).toEqual({ A: 2, B: 0 });
    expect(r.comparables).toBe(2);
  });

  it("LA GANANCIA DEL PAREADO: briefs de dificultad distinta no ensucian", () => {
    // El brief 1 es "fácil" (los dos sacan alto) y el 2 "difícil" (los dos
    // bajo). Sin parear, esa diferencia entre días domina el promedio; al
    // restar A−B dentro del mismo brief, desaparece — y queda la ventaja
    // constante de A, que es lo que se quiere medir.
    const r = marcadorPareado(
      [
        par(1, [nota({ ocasion: 5, clima: 5, armado: 5, estilo: 5, color: 5, wow: 5 })],
             [nota({ ocasion: 5, clima: 5, armado: 5, estilo: 5, color: 5, wow: 4 })]),
        par(2, [nota({ ocasion: 2, clima: 2, armado: 2, estilo: 2, color: 2, wow: 2 })],
             [nota({ ocasion: 2, clima: 2, armado: 2, estilo: 2, color: 2, wow: 1 })]),
      ],
      ["A", "B"]
    );
    expect(r.gana).toEqual({ A: 2, B: 0 });
    // La diferencia es la MISMA en los dos pares pese a que los niveles
    // absolutos difieren muchísimo: eso es exactamente lo que el pareado logra.
    expect(r.diferencia!.media).toBeCloseTo(1 / 6, 3);
    expect(r.diferencia!.se).toBe(0);
  });

  it("los looks de un lado se PROMEDIAN, no se cuentan por separado", () => {
    // Salen de UNA llamada al motor: contarlos como observaciones
    // independientes inflaría la significancia. La unidad es el par.
    const r = marcadorPareado(
      [par(1, [nota({ wow: 5 }), nota({ wow: 5 }), nota({ wow: 5 })], [nota({ wow: 4 })])],
      ["A", "B"]
    );
    expect(r.comparables).toBe(1);
    expect(r.gana.A).toBe(1);
  });

  it("un par con un lado vacío no es comparable y NO cuenta", () => {
    const r = marcadorPareado(
      [par(1, [nota()], []), par(2, [nota({ wow: 5 })], [nota({ wow: 3 })])],
      ["A", "B"]
    );
    expect(r.comparables).toBe(1);
  });

  it("empate cuando los dos sacan lo mismo", () => {
    const r = marcadorPareado([par(1, [nota()], [nota()])], ["A", "B"]);
    expect(r.empates).toBe(1);
    expect(r.gana).toEqual({ A: 0, B: 0 });
  });

  it("dice DÓNDE está la diferencia, por dimensión", () => {
    const r = marcadorPareado(
      [par(1, [nota({ color: 5, wow: 2 })], [nota({ color: 2, wow: 5 })])],
      ["A", "B"]
    );
    expect(r.porDimension.A.color).toBe(5);
    expect(r.porDimension.B.color).toBe(2);
    expect(r.porDimension.A.wow).toBe(2);
  });

  it("sin pares comparables no inventa un resultado", () => {
    const r = marcadorPareado([], ["A", "B"]);
    expect(r).toMatchObject({ comparables: 0, empates: 0, p: null, diferencia: null });
  });
});

describe("puntajeDeNota", () => {
  it("las seis dimensiones pesan igual", () => {
    // Ponderarlas sería meter una opinión justo en la pieza que existe para
    // quitar opiniones de la medición.
    expect(puntajeDeNota(nota())).toBe(4);
    expect(puntajeDeNota(nota({ wow: 1 }))).toBeCloseTo((4 * 5 + 1) / 6, 5);
  });
});

describe("paresNecesarios — decir 'con esto no alcanza' ANTES de gastar", () => {
  it("cuanto menor la varianza, menos pares hacen falta", () => {
    expect(paresNecesarios(0.5, 0.2)).toBeLessThan(paresNecesarios(1.0, 0.2));
  });

  it("con la sd típica del pareado, la muestra es manejable", () => {
    // El argumento de todo esto: sin parear haría falta ~169 looks por lado
    // (~$26); pareado con sd 0.4 y efecto 0.2 son 32 pares.
    expect(paresNecesarios(0.4, 0.2)).toBe(32);
  });

  it("no revienta con entradas degeneradas", () => {
    expect(paresNecesarios(0, 0.2)).toBe(0);
    expect(paresNecesarios(0.5, 0)).toBe(0);
  });
});
