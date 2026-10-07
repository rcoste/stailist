import { describe, expect, it } from "vitest";
import { anclaParaPrimerLook, debeVerTuRopa, hrefLookConPrenda } from "./tu-ropa";

describe("debeVerTuRopa", () => {
  it("sólo a quien no tiene fotos propias y no la ha visto", () => {
    expect(debeVerTuRopa({ fotosPropias: 0, yaVista: false })).toBe(true);
    expect(debeVerTuRopa({ fotosPropias: 3, yaVista: false })).toBe(false);
    expect(debeVerTuRopa({ fotosPropias: 0, yaVista: true })).toBe(false);
  });
});

describe("anclaParaPrimerLook", () => {
  it("de una foto de cuerpo entero elige lo de arriba, no el outfit entero", () => {
    expect(
      anclaParaPrimerLook([
        { id: "tenis", categoria: "calzado" },
        { id: "jeans", categoria: "bottom" },
        { id: "playera", categoria: "top" },
      ])
    ).toBe("playera");
  });

  it("el vestido manda", () => {
    expect(
      anclaParaPrimerLook([
        { id: "top", categoria: "top" },
        { id: "vestido", categoria: "vestido" },
      ])
    ).toBe("vestido");
  });

  it("un abrigo no le gana al pantalón (el clima lo rechazaría de entrada)", () => {
    expect(
      anclaParaPrimerLook([
        { id: "abrigo", categoria: "abrigo" },
        { id: "jeans", categoria: "bottom" },
      ])
    ).toBe("jeans");
  });

  it("sin categoría conocida toma la primera; sin prendas, nada", () => {
    expect(anclaParaPrimerLook([{ id: "x", categoria: null }, { id: "y", categoria: "rara" }])).toBe("x");
    expect(anclaParaPrimerLook([])).toBeNull();
  });
});

describe("hrefLookConPrenda", () => {
  it("lleva al mismo destino que 'arma un look con esta prenda'", () => {
    expect(hrefLookConPrenda("abc", 123)).toBe("/hoy?generar=123&prenda=abc");
  });
});
