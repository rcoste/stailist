import { describe, expect, it } from "vitest";
import { climaDeParada, reglaDeAbrigo } from "./trip-capsule";

// Contrato sano sin cobertura hasta hoy (QA 2026-10-17, v0.2.387.0): lo que el
// motor de la maleta lee del clima y la regla de abrigo.
describe("climaDeParada", () => {
  it("con rango dice mañanas/noches y tardes; sin rango, el promedio", () => {
    expect(climaDeParada({ temp_c: 10, temp_min: 5, temp_max: 15 })).toBe("de 5°C a 15°C (mañanas y noches ~5°C, tardes ~15°C)");
    expect(climaDeParada({ temp_c: 10 })).toBe("~10°C");
    expect(climaDeParada({ temp_c: 10, temp_min: 10, temp_max: 10 })).toBe("~10°C");
  });
});

describe("reglaDeAbrigo", () => {
  it("bajo 5°C de mínima pide abrigo de verdad y descarta la impermeable sola", () => {
    const r = reglaDeAbrigo([{ temp_c: 15, temp_min: 11, temp_max: 18 }, { temp_c: 10, temp_min: 5, temp_max: 15 }]);
    expect(r).toContain("La mínima del viaje es ~5°C");
    expect(r).toContain("ABRIGO DE VERDAD");
    expect(r).toContain("NO sustituyen al abrigo");
  });
  it("entre 6 y 12°C pide una capa real, no un abrigo", () => {
    const r = reglaDeAbrigo([{ temp_c: 12, temp_min: 8, temp_max: 16 }]);
    expect(r).toContain("capa de abrigo real");
    expect(r).not.toContain("ABRIGO DE VERDAD");
  });
  it("frío y calor juntos: dos bloques que comparten neutros", () => {
    const r = reglaDeAbrigo([{ temp_c: 3, temp_min: -1, temp_max: 7 }, { temp_c: 28, temp_min: 23, temp_max: 32 }]);
    expect(r).toContain("DOS BLOQUES");
  });
  it("templado sin extremos: nada que agregar; sin climas tampoco", () => {
    expect(reglaDeAbrigo([{ temp_c: 20, temp_min: 15, temp_max: 25 }])).toBe("");
    expect(reglaDeAbrigo([null])).toBe("");
  });
});
