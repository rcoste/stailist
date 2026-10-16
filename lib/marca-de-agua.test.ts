import { describe, expect, it } from "vitest";
import { medidasDeMarca } from "./marca-de-agua";

// LO QUE BLINDAN: que la marca escale con la imagen y nunca quede ilegible.

describe("medidasDeMarca", () => {
  it("escala con el ancho de la imagen", () => {
    expect(medidasDeMarca(1536).fuente / medidasDeMarca(768).fuente).toBeCloseTo(2, 1);
  });
  it("en una imagen chica no baja de 14 px", () => {
    expect(medidasDeMarca(200).fuente).toBe(14);
  });
});
