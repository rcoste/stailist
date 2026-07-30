import { describe, expect, it } from "vitest";
import { MARGEN, colocarNota, enPantalla, type Caja } from "./coach-mark";

// Pantalla de referencia: un iPhone típico.
const VW = 390;
const VH = 844;
const NOTE_W = 340;
const NOTE_H = 150;

const caja = (top: number, height = 48): Caja => ({
  top,
  left: 20,
  width: 200,
  height,
});

// La invariante que importa: la nota SIEMPRE cabe entera en la pantalla. Si no,
// el usuario ve un velo negro sin nada que tocar y con el scroll bloqueado.
function dentroDeLaPantalla(top: number, noteH = NOTE_H) {
  expect(top).toBeGreaterThanOrEqual(MARGEN);
  expect(top + noteH).toBeLessThanOrEqual(VH - MARGEN + 0.001);
}

describe("enPantalla", () => {
  it("acepta un elemento a la vista", () => {
    expect(enPantalla(caja(400), VH)).toBe(true);
  });

  it("rechaza uno que quedó por debajo del fold", () => {
    // El caso de Alberto: la cápsula tiene 15 filas y el target vive en la 9.
    expect(enPantalla(caja(1500), VH)).toBe(false);
  });

  it("rechaza uno que quedó por encima del área visible", () => {
    expect(enPantalla(caja(-200), VH)).toBe(false);
  });

  it("acepta un card más alto que la pantalla (no exige que quepa entero)", () => {
    expect(enPantalla(caja(-50, 1200), VH)).toBe(true);
  });

  it("rechaza una raya pegada al borde de abajo", () => {
    expect(enPantalla(caja(VH - 4), VH)).toBe(false);
  });
});

describe("colocarNota", () => {
  it("la pone debajo del elemento cuando hay lugar", () => {
    const c = colocarNota(caja(200), NOTE_H, VW, VH, NOTE_W);
    expect(c.punta).toBe("arriba");
    expect(c.top).toBeGreaterThan(200);
    dentroDeLaPantalla(c.top);
  });

  it("la pone encima cuando abajo no cabe", () => {
    const c = colocarNota(caja(700), NOTE_H, VW, VH, NOTE_W);
    expect(c.punta).toBe("abajo");
    expect(c.top).toBeLessThan(700);
    dentroDeLaPantalla(c.top);
  });

  // La regresión de la pantalla negra: aunque el rect llegue fuera de la
  // pantalla, la nota tiene que quedar dentro igual.
  it("nunca se sale, ni con el elemento muy por debajo del fold", () => {
    const c = colocarNota(caja(1500), NOTE_H, VW, VH, NOTE_W);
    dentroDeLaPantalla(c.top);
    expect(c.punta).toBeNull(); // no apunta a algo que no se ve
  });

  it("nunca se sale, ni con el elemento muy por encima", () => {
    const c = colocarNota(caja(-900), NOTE_H, VW, VH, NOTE_W);
    dentroDeLaPantalla(c.top);
  });

  it("nunca se sale con una nota larguísima", () => {
    const alta = 700;
    const c = colocarNota(caja(400), alta, VW, VH, NOTE_W);
    dentroDeLaPantalla(c.top, alta);
  });

  it("se mantiene dentro en un barrido de posiciones", () => {
    for (let top = -400; top <= 1600; top += 37) {
      const c = colocarNota(caja(top), NOTE_H, VW, VH, NOTE_W);
      dentroDeLaPantalla(c.top);
      expect(c.left).toBeGreaterThanOrEqual(MARGEN);
      expect(c.left + NOTE_W).toBeLessThanOrEqual(VW - MARGEN + 0.001);
    }
  });

  it("quita la punta cuando el elemento no cabe ni arriba ni abajo", () => {
    // Un card que ocupa casi toda la pantalla: no hay dónde poner la nota
    // "junto a él", así que apuntar sería mentir.
    const c = colocarNota(caja(20, 800), NOTE_H, VW, VH, NOTE_W);
    expect(c.punta).toBeNull();
    dentroDeLaPantalla(c.top);
  });

  it("centra la punta en el elemento", () => {
    const r = caja(200);
    const c = colocarNota(r, NOTE_H, VW, VH, NOTE_W);
    const centroElemento = r.left + r.width / 2;
    expect(c.left + c.puntaX).toBeCloseTo(centroElemento, 1);
  });

  it("no deja que la punta se salga por la esquina redondeada", () => {
    // Elemento pegado al borde izquierdo: la punta se topa con su mínimo.
    const c = colocarNota({ top: 200, left: 0, width: 30, height: 40 }, NOTE_H, VW, VH, NOTE_W);
    expect(c.puntaX).toBeGreaterThanOrEqual(18);
    expect(c.puntaX).toBeLessThanOrEqual(NOTE_W - 18);
  });
});
