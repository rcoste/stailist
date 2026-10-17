import { describe, expect, it } from "vitest";
import { textoDeClima } from "./trip";

// Regression: ISSUE-001 — el rango del clima salía en el header del celular pero el
// rail de escritorio seguía diciendo "~20°C"; una sola función para todos.
// Found by /qa on 2026-10-17
// Report: .gstack/qa-reports/qa-report-stailist-local-2026-10-17.md
describe("textoDeClima", () => {
  it("con rango: 'de X a Y°C'; sin rango: '~N°C'; sin clima: null", () => {
    expect(textoDeClima({ temp_c: 20, condition: "nublado", temp_min: 15, temp_max: 24 })).toBe("15 a 24°C");
    expect(textoDeClima({ temp_c: 20, condition: "nublado" })).toBe("~20°C");
    expect(textoDeClima({ temp_c: 20, condition: "nublado", temp_min: 20, temp_max: 20 })).toBe("~20°C");
    expect(textoDeClima(null)).toBeNull();
  });
});
