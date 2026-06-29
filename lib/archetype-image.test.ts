import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "./archetype-image";

// Regression: render de prenda salía de MUJER por default en prendas ambiguas
// (ej. "Traje de baño negro") porque el prompt no llevaba el género.
// Found by /investigate on 2026-06-28 (bug reportado por Leo Gil en modo maleta).
describe("buildImagePrompt — desambigua por género", () => {
  // Marcadores con "a " adelante para evitar el solape "women"⊃"men".
  it("hombre → marca el prompt como prenda de hombre", () => {
    const p = buildImagePrompt("Traje de baño negro", "flat", "hombre");
    expect(p).toContain("a men's item");
    expect(p).not.toContain("a women's item");
  });

  it("mujer → marca el prompt como prenda de mujer", () => {
    const p = buildImagePrompt("Traje de baño negro", "flat", "mujer");
    expect(p).toContain("a women's item");
    expect(p).not.toContain("a men's item");
  });

  it("sin género → no fuerza ninguno (no rompe arquetipos ya gendered)", () => {
    const p = buildImagePrompt("Camiseta blanca", "flat");
    expect(p).not.toContain("a men's item");
    expect(p).not.toContain("a women's item");
  });

  it("aplica también a calzado (shoes)", () => {
    const p = buildImagePrompt("Sandalias", "shoes", "hombre");
    expect(p).toContain("a men's item");
    expect(p).toContain("shoes"); // mantiene el encuadre de calzado
  });
});
