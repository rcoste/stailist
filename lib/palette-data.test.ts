import { describe, it, expect } from "vitest";
import { subPalette, carteraPalette, carteraGoSwatches } from "./palette-data";
import { hexToRgb, rgbToLab, deltaE2000 } from "./color/match";

describe("carteraPalette — incorpora el guiño y limpia el evita", () => {
  it("invierno con guiño a otoño: agrega guiños y marca la estación", () => {
    const p = carteraPalette("invierno", "dark", "otono");
    expect(p.guinos.length).toBeGreaterThan(0);
    expect(p.guinoSeason).toBe("otono");
  });

  it("saca del evita los cálidos que ya son guiños", () => {
    const base = subPalette("invierno", "dark");
    const p = carteraPalette("invierno", "dark", "otono");
    // El evita filtrado es más corto (se quitaron los que chocan con el guiño).
    expect(p.evita.length).toBeLessThan(base.evita.length);
    // Y ninguno de los que quedan está "cerca" de un guiño.
    for (const e of p.evita) {
      const el = rgbToLab(hexToRgb(e.hex));
      const choca = p.guinos.some(
        (g) => deltaE2000(el, rgbToLab(hexToRgb(g.hex))) <= 18
      );
      expect(choca).toBe(false);
    }
  });

  it("sin guiño: igual que subPalette (sin guiños)", () => {
    const p = carteraPalette("invierno", "dark", null);
    expect(p.guinos).toEqual([]);
    expect(p.guinoSeason).toBeNull();
  });

  it("carteraGoSwatches incluye los guiños en los 'que van'", () => {
    const conGuino = carteraGoSwatches("invierno", "dark", "otono");
    const sinGuino = carteraGoSwatches("invierno", "dark", null);
    expect(conGuino.length).toBeGreaterThan(sinGuino.length);
  });
});
