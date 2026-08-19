import { describe, it, expect } from "vitest";
import { mismoColorAOjo } from "./color-perceptual";

describe("mismoColorAOjo — un neutro y un color nunca son el mismo color", () => {
  // EL FALSO NEGATIVO QUE VIVIÓ MESES, con los hexes reales del catálogo. La
  // distancia entre estos dos es 0.074 (por debajo del umbral de 0.09) y el
  // matiz sale 0 porque el carbón es acromático — así que la regla
  // `cueros-que-no-se-hablan` los daba por el mismo color y no marcaba nada.
  // Roberto lo confirmó cinco veces calificando al juez: "Agree, no va café
  // con negro".
  it("cinturón gris carbón con mocasines burdeos NO son el mismo color", () => {
    expect(mismoColorAOjo("#3A3A3C", "#5E2A33")).toBe(false);
  });

  it("negro con chocolate tampoco", () => {
    expect(mismoColorAOjo("#1a1a1a", "#4B3526")).toBe(false);
  });

  // LO QUE NO SE TOCÓ: dos neutros entre sí se siguen comparando por claridad
  // y croma. Ahí la benevolencia con el matiz era correcta.
  it("dos negros siguen siendo el mismo color", () => {
    expect(mismoColorAOjo("#1a1a1a", "#1A1A1E")).toBe(true);
  });

  it("un negro y un gris claro siguen siendo colores distintos, por claridad", () => {
    expect(mismoColorAOjo("#1a1a1a", "#c9c9c9")).toBe(false);
  });

  // Y dos colores con matiz siguen decidiéndose por matiz, como antes.
  it("café con burdeos siguen distintos por matiz", () => {
    expect(mismoColorAOjo("#5a3826", "#5E2A33")).toBe(false);
  });

  it("dos cafés reales del catálogo siguen siendo el mismo color", () => {
    expect(mismoColorAOjo("#5a3826", "#5C4433")).toBe(true);
  });
});
