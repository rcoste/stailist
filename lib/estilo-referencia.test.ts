import { describe, expect, it } from "vitest";
import { styleReferenceForEngine, REFERENCIA_DE_ESTILO_ACTIVA } from "./estilo-referencia";

// APAGADO PARA EL RELEASE (2026-09-08, ver la constante en el módulo): estos
// tests pasan `true` a propósito — cubren el camino de vuelta, cuando se
// encienda. El caso apagado (el que corre en producción hoy) va al final.
describe("styleReferenceForEngine", () => {
  it("sin referencia o sin summary → null", () => {
    expect(styleReferenceForEngine(null, true)).toBeNull();
    expect(styleReferenceForEngine({}, true)).toBeNull();
    expect(styleReferenceForEngine({ summary: "  " }, true)).toBeNull();
  });

  it("con verdict 'va' devuelve solo el summary (la nota es elogio, no guía)", () => {
    expect(
      styleReferenceForEngine({
        summary: "Minimal con estructura",
        fit: { verdict: "va", note: "va perfecto con tu invierno" },
      }, true)
    ).toBe("Minimal con estructura");
  });

  it("con 'ajustes' u 'ojo' anexa la evaluación honesta", () => {
    const r = styleReferenceForEngine({
      summary: "Boho relajado",
      fit: { verdict: "ojo", note: "es muy cálido para ti; llévalo a tus tonos fríos" },
    }, true);
    expect(r).toContain("Boho relajado");
    expect(r).toContain("es muy cálido para ti");
  });

  it("nota vacía o verdict desconocido no anexan nada", () => {
    expect(
      styleReferenceForEngine({ summary: "Clásico", fit: { verdict: "ajustes", note: " " } }, true)
    ).toBe("Clásico");
    expect(
      styleReferenceForEngine({ summary: "Clásico", fit: { verdict: "otro", note: "x" } }, true)
    ).toBe("Clásico");
  });

  it("los tags de visión se anexan como claves (v24 — antes se tiraban)", () => {
    expect(
      styleReferenceForEngine({
        summary: "Minimal con estructura",
        tags: ["monocromo", "oversize", "sastrería"],
      }, true)
    ).toBe("Minimal con estructura (claves: monocromo, oversize, sastrería)");
  });

  it("tags + nota de fit conviven en la misma línea", () => {
    const r = styleReferenceForEngine({
      summary: "Boho relajado",
      tags: ["fluido", "capas"],
      fit: { verdict: "ojo", note: "llévalo a tus tonos fríos" },
    }, true);
    expect(r).toContain("(claves: fluido, capas)");
    expect(r).toContain("llévalo a tus tonos fríos");
  });

  it("tags vacíos o en blanco no anexan claves", () => {
    expect(styleReferenceForEngine({ summary: "Clásico", tags: [] }, true)).toBe("Clásico");
    expect(styleReferenceForEngine({ summary: "Clásico", tags: ["  "] }, true)).toBe("Clásico");
  });
});

describe("styleReferenceForEngine — apagada (lo que corre en el release)", () => {
  const completa = {
    summary: "sastrería relajada en tonos tierra",
    tags: ["oversize", "capas"],
    fit: { verdict: "ajustes", note: "llévalo a tus tonos fríos" },
  };

  it("el motor NO la ve, aunque la persona la tenga guardada", () => {
    expect(styleReferenceForEngine(completa, false)).toBeNull();
  });

  it("el default de la función es la constante real del release", () => {
    expect(styleReferenceForEngine(completa)).toBe(
      styleReferenceForEngine(completa, REFERENCIA_DE_ESTILO_ACTIVA)
    );
  });
});
