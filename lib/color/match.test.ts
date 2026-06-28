import { describe, it, expect } from "vitest";
import { deltaE2000, rgbToLab, hexToRgb, checkColor } from "./match";
import type { Swatch } from "@/lib/palette-data";

const lab = (hex: string) => rgbToLab(hexToRgb(hex));

describe("deltaE2000", () => {
  it("es 0 para colores idénticos", () => {
    expect(deltaE2000(lab("#722F37"), lab("#722F37"))).toBeCloseTo(0, 4);
  });
  it("negro vs blanco es grande (~100)", () => {
    expect(deltaE2000(lab("#000000"), lab("#ffffff"))).toBeGreaterThan(95);
  });
  it("dos tonos casi iguales dan delta chico", () => {
    expect(deltaE2000(lab("#1E2A4A"), lab("#1F2B4B"))).toBeLessThan(2);
  });
});

describe("checkColor (paleta de invierno)", () => {
  const va: Swatch[] = [
    { nombre: "Azul marino", hex: "#1E2A4A" },
    { nombre: "Azul rey", hex: "#2E4FA3" },
    { nombre: "Rubí", hex: "#8E2438" },
    { nombre: "Blanco puro", hex: "#FAFAF7" },
  ];
  const evita: Swatch[] = [
    { nombre: "Camel", hex: "#B08D57" },
    { nombre: "Naranja tierra", hex: "#C9742E" },
    { nombre: "Oliva apagado", hex: "#6B7A4C" },
  ];

  it("un azul marino casi exacto → va", () => {
    expect(checkColor("#1F2B4B", va, evita).verdict).toBe("va");
  });
  it("un naranja tierra → no-ideal y nombra el evita", () => {
    const r = checkColor("#C9742E", va, evita);
    expect(r.verdict).toBe("no-ideal");
    expect(r.nearEvita?.nombre).toBe("Naranja tierra");
  });
  it("siempre devuelve hasta 3 alternativas que sí van", () => {
    expect(checkColor("#888888", va, evita).alternatives.length).toBeGreaterThan(0);
  });
});
