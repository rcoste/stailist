import { describe, it, expect } from "vitest";
import { repartirCandidatas } from "./trip-candidatas";

// LO QUE BLINDA: que la misma prenda no se proponga para dos lugares de la
// maleta. El caso real: un solo suéter de cuello alto negro, propuesto y
// aceptado para dos piezas.
const m = (...nombres: string[]) => nombres.map((nombre) => ({ nombre }));

describe("repartirCandidatas", () => {
  it("el mismo suéter no sale para dos huecos: el segundo toma su siguiente opción", () => {
    const r = repartirCandidatas(
      [
        { i: 15, matches: m("Suéter de cuello alto negro", "Suéter gris") },
        { i: 13, matches: m("Suéter de cuello alto negro", "Camisa negra fluida") },
      ],
      new Set()
    );
    expect(r.get(13)?.nombre).toBe("Suéter de cuello alto negro");
    expect(r.get(15)?.nombre).toBe("Suéter gris");
  });

  it("si todas sus opciones ya están tomadas, el hueco se queda sin candidata", () => {
    const r = repartirCandidatas([{ i: 3, matches: m("Jeans wide leg azul medio") }], new Set(["Jeans wide leg azul medio"]));
    expect(r.get(3)).toBeNull();
  });

  it("una prenda ya propuesta en otro hueco cuenta como tomada", () => {
    const r = repartirCandidatas([{ i: 21, matches: m("Camisa negra fluida", "Camisa azul claro") }], new Set(["Camisa negra fluida"]));
    expect(r.get(21)?.nombre).toBe("Camisa azul claro");
  });
});
