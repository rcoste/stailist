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

import { subPalette as _sub } from "./palette-data";
describe("la profundidad no ensucia los neutros ni hunde los oscuros", () => {
  // Roberto, 2026-08-22: su "Blanco puro" de invierno oscuro salía #E2E2CC
  // (verdoso) y "Pino" en #030907 (negro con nombre de color).
  it("en oscuro, el blanco sigue siendo blanco y el negro, negro", () => {
    const dark = _sub("invierno", "dark");
    const medium = _sub("invierno", "medium");
    expect(dark.familias.blancos).toEqual(medium.familias.blancos);
    expect(dark.familias.grises).toEqual(medium.familias.grises);
  });
  it("un color que ya era profundo no se oscurece hasta el negro", () => {
    const pino = _sub("invierno", "dark").familias.verdes!.find((c) => c.nombre === "Pino")!;
    expect(pino.hex.toUpperCase()).toBe("#143A30");
  });
  it("un color medio sí se profundiza en oscuro", () => {
    const rubiM = _sub("invierno", "medium").familias.rojos!.find((c) => c.nombre === "Rubí")!;
    const rubiD = _sub("invierno", "dark").familias.rojos!.find((c) => c.nombre === "Rubí")!;
    expect(rubiD.hex).not.toBe(rubiM.hex);
  });
});
