import { describe, it, expect } from "vitest";
import {
  normSeason,
  seasonPalette,
  seasonDisplayLabel,
  flowToDepth,
  carteraDepth,
  computeDepth,
} from "./colorimetria";

// Objeto legacy de la colorimetría por foto (NO son respuestas del quiz MC).
const FOTO_QUIZ = { source: "foto+quiz", por_que: "tonos terrosos", confianza: "media" };

describe("normSeason — tolera legacy con mayúscula y acento", () => {
  it("baja mayúsculas", () => {
    expect(normSeason("Invierno")).toBe("invierno");
  });
  it("normaliza la ñ de otoño", () => {
    expect(normSeason("Otoño")).toBe("otono");
  });
  it("devuelve null para basura o vacío", () => {
    expect(normSeason("xyz")).toBeNull();
    expect(normSeason(null)).toBeNull();
  });
});

describe("seasonPalette — el guiño legacy con mayúscula ya no se pierde", () => {
  it("recupera los prestados aunque el flow venga 'Invierno'", () => {
    // cruzmaureen: otoño con guiño a 'Invierno' (mayúscula) → antes prestados=[].
    const ok = seasonPalette("otono", "Invierno" as never);
    const bueno = seasonPalette("otono", "invierno");
    expect(ok.prestados.length).toBeGreaterThan(0);
    expect(ok.prestados.length).toBe(bueno.prestados.length);
  });
});

describe("seasonDisplayLabel — case-tolerante", () => {
  it("'Invierno' (mayúscula) sigue dando la sub-estación", () => {
    expect(seasonDisplayLabel("otono", "Invierno" as never)).toBe("Otoño profundo");
  });
});

describe("flowToDepth — el guiño implica profundidad", () => {
  it("invierno+otoño → oscuro", () => {
    expect(flowToDepth("invierno", "otono")).toBe("dark");
  });
  it("invierno+verano → claro", () => {
    expect(flowToDepth("invierno", "verano")).toBe("light");
  });
  it("sin guiño → medio", () => {
    expect(flowToDepth("invierno", null)).toBe("medium");
  });
});

describe("carteraDepth — quiz MC manda; si no, deriva del guiño", () => {
  it("perfil de foto (sin quiz MC) usa el guiño: invierno+otoño → oscuro", () => {
    // El bug: antes caía a 'medium'. roberto@kublau.com es este caso.
    expect(carteraDepth(FOTO_QUIZ as never, "invierno", "otono")).toBe("dark");
  });
  it("si hizo el quiz MC, respeta su profundidad real", () => {
    const mc = { cabello: "oscuro" }; // d:+2 → dark
    expect(carteraDepth(mc, "invierno", "verano")).toBe(computeDepth(mc));
  });
});
