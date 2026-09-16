import { describe, expect, it } from "vitest";
import { esCombinacionRepetida } from "./combinacion-repetida";

describe("esCombinacionRepetida", () => {
  const recientes = [["jeans", "botas", "blazer", "camiseta-negra"]];

  it("el mismo look en otro orden es el mismo look (el caso real del 2026-09-16)", () => {
    expect(esCombinacionRepetida(["blazer", "jeans", "camiseta-negra", "botas"], recientes)).toBe(true);
  });

  it("repetir una prenda en otro conjunto no es repetir el look", () => {
    expect(esCombinacionRepetida(["jeans", "tenis", "blazer", "camiseta-negra"], recientes)).toBe(false);
  });

  it("un subconjunto tampoco cuenta: le falta o le sobra una prenda", () => {
    expect(esCombinacionRepetida(["jeans", "botas", "blazer"], recientes)).toBe(false);
  });

  it("sin recientes nada se repite", () => {
    expect(esCombinacionRepetida(["jeans"], [])).toBe(false);
  });
});
