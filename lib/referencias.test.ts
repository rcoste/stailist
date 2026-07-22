import { describe, expect, it } from "vitest";
import { REFERENCIAS_PRECARGADAS, referenciaPreset } from "./referencias";

// El catálogo entra al motor vía styleReferenceForEngine — estos tests pinnean
// el contrato: ids únicos, summary con sustancia, tags acotados (el motor corta
// en 6), y cero menciones de color específico (la colorimetría de la usuaria
// manda; la referencia solo inspira vibe y siluetas).
describe("REFERENCIAS_PRECARGADAS", () => {
  it("ids únicos y resolubles", () => {
    const ids = REFERENCIAS_PRECARGADAS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(referenciaPreset(id)?.id).toBe(id);
  });

  it("id desconocido → null (la action lo rechaza)", () => {
    expect(referenciaPreset("hacker")).toBeNull();
    expect(referenciaPreset("")).toBeNull();
  });

  it("cada preset trae summary con sustancia y 1-6 tags", () => {
    for (const r of REFERENCIAS_PRECARGADAS) {
      expect(r.summary.length).toBeGreaterThan(80);
      expect(r.tags.length).toBeGreaterThanOrEqual(1);
      expect(r.tags.length).toBeLessThanOrEqual(6);
      expect(r.nombre.length).toBeGreaterThan(0);
      expect(r.desc.length).toBeGreaterThan(0);
    }
  });
});
