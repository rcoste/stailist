import { describe, expect, it } from "vitest";
import { alcanzaParaLooks, elegirVariante, esVarianteFotos, queFalta } from "./onboarding-variante";

// LO QUE BLINDAN: que la prueba reparta mitad y mitad de forma estable, que el
// apagador apague, y que la regla de "alcanza para looks" sea la misma que la
// de la lista de básicos.

const ids = Array.from({ length: 400 }, (_, i) => {
  const hex = (i * 2654435761 >>> 0).toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-000000000000`;
});

describe("elegirVariante", () => {
  it("reparte cerca de mitad y mitad", () => {
    const fotos = ids.filter((id) => elegirVariante(id, true) === "fotos").length;
    expect(fotos).toBeGreaterThan(150);
    expect(fotos).toBeLessThan(250);
  });
  it("es estable: el mismo id cae siempre del mismo lado", () => {
    for (const id of ids.slice(0, 20)) expect(elegirVariante(id, true)).toBe(elegirVariante(id, true));
  });
  it("apagada, todo el mundo va a la lista", () => {
    expect(ids.every((id) => elegirVariante(id, false) === "basicos")).toBe(true);
  });
  it("null (antes de la prueba) se lee como básicos", () => {
    expect(esVarianteFotos(null)).toBe(false);
    expect(esVarianteFotos("fotos")).toBe(true);
  });
});

describe("alcanzaParaLooks (la regla de la lista de básicos)", () => {
  it("dos de arriba, dos de abajo y zapatos (4 combinaciones) alcanza", () => {
    expect(alcanzaParaLooks(["top", "top", "bottom", "bottom", "calzado"])).toBe(true);
    expect(alcanzaParaLooks(["top", "bottom", "bottom", "calzado"])).toBe(false);
    expect(alcanzaParaLooks(["top", "top", "bottom", "bottom"])).toBe(false);
  });
  it("un vestido es UN look, no arriba y abajo a la vez", () => {
    // El caso real del 12-oct: blusa, shorts, vestido y tenis = 2 looks posibles.
    expect(alcanzaParaLooks(["top", "bottom", "vestido", "calzado"])).toBe(false);
    expect(alcanzaParaLooks(["vestido", "vestido", "calzado"])).toBe(false);
    expect(alcanzaParaLooks(["vestido", "vestido", "vestido", "calzado"])).toBe(true);
    expect(alcanzaParaLooks(["top", "top", "bottom", "vestido", "calzado"])).toBe(true);
  });
  it("dice qué falta en palabras, pidiendo lo que más combinaciones suma", () => {
    expect(queFalta(["top", "top", "bottom"])).toEqual(["algo de abajo", "unos zapatos"]);
    expect(queFalta(["top", "bottom", "vestido", "calzado"])).toEqual(["algo de arriba"]);
    expect(queFalta(["top", "bottom", "bottom", "bottom", "calzado"])).toEqual([]);
    expect(queFalta(["bottom", "bottom", "bottom", "calzado"])).toEqual(["algo de arriba"]);
    expect(queFalta([])).toEqual(["algo de arriba", "algo de abajo", "unos zapatos"]);
    expect(queFalta(["vestido", "vestido", "vestido", "calzado"])).toEqual([]);
  });
});
