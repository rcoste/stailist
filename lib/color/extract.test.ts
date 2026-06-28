import { describe, it, expect } from "vitest";
import { dominantColor } from "./extract";
import { deltaE2000, rgbToLab, hexToRgb, type RGB } from "./match";

// Construye un RGBA sintético: fondo blanco + bloque central de color.
function makeImage(w: number, h: number, [r, g, b]: RGB): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const center = x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7;
      const [R, G, B] = center ? [r, g, b] : [255, 255, 255];
      data[i] = R; data[i + 1] = G; data[i + 2] = B; data[i + 3] = 255;
    }
  }
  return data;
}

describe("dominantColor", () => {
  it("ignora el fondo blanco y devuelve el color de la prenda (navy)", () => {
    const navy: RGB = [30, 42, 74];
    const hex = dominantColor(makeImage(100, 100, navy), 100, 100);
    const d = deltaE2000(rgbToLab(hexToRgb(hex)), rgbToLab(navy));
    expect(d).toBeLessThan(5);
  });

  it("detecta un naranja sobre blanco", () => {
    const orange: RGB = [201, 116, 46];
    const hex = dominantColor(makeImage(100, 100, orange), 100, 100);
    const d = deltaE2000(rgbToLab(hexToRgb(hex)), rgbToLab(orange));
    expect(d).toBeLessThan(5);
  });
});
