import { describe, it, expect } from "vitest";
import { parDeTraje, type PiezaLeida } from "./par-de-traje";

const p = (o: Partial<PiezaLeida> & { id: string }): PiezaLeida => ({ ...o });

describe("cuándo SÍ vale la pena preguntar si es traje", () => {
  it("un saco y un pantalón formal — el caso de la foto de Roberto", () => {
    expect(
      parDeTraje([
        p({ id: "s", categoria: "saco", nombre: "Saco de traje gris oscuro" }),
        p({ id: "c", categoria: "top", nombre: "Camisa blanca" }),
        p({ id: "b", categoria: "bottom", nombre: "Pantalón de vestir gris oscuro" }),
      ])
    ).toEqual({ saco: "s", pantalon: "b" });
  });

  it("el pantalón califica por formalidad aunque el nombre no lo diga", () => {
    expect(
      parDeTraje([
        p({ id: "s", categoria: "saco" }),
        p({ id: "b", categoria: "bottom", nombre: "Pantalón gris", formalidad: "formal" }),
      ])
    ).toEqual({ saco: "s", pantalon: "b" });
  });
});

describe("cuándo NO se pregunta — aquí está el valor", () => {
  it("un traje no lleva jeans", () => {
    // Sin este filtro la pregunta saldría cada vez que alguien suba un blazer
    // y unos jeans en la misma tanda, que es de lo más normal.
    expect(
      parDeTraje([
        p({ id: "s", categoria: "saco", nombre: "Blazer marino" }),
        p({ id: "b", categoria: "bottom", nombre: "Jeans azul oscuro", formalidad: "casual" }),
      ])
    ).toBeNull();
  });

  it("con dos sacos la pregunta ya no tiene UNA respuesta", () => {
    // "¿Son traje?" con dos sacos y un pantalón tiene cuatro respuestas
    // posibles. Una pregunta ambigua en un flujo de carga se contesta al azar,
    // y un lazo puesto al azar no se puede quitar: mejor no preguntar y dejar
    // que lo ate después desde la ficha.
    expect(
      parDeTraje([
        p({ id: "s1", categoria: "saco" }),
        p({ id: "s2", categoria: "saco" }),
        p({ id: "b", categoria: "bottom", formalidad: "formal" }),
      ])
    ).toBeNull();
  });

  it("un saco solo, sin pantalón, no es un par", () => {
    expect(parDeTraje([p({ id: "s", categoria: "saco" })])).toBeNull();
  });

  it("sin saco no hay traje que atar", () => {
    expect(
      parDeTraje([p({ id: "b", categoria: "bottom", formalidad: "formal" })])
    ).toBeNull();
  });
});
