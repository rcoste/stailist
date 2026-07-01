import { describe, expect, it } from "vitest";
import { styleReferenceForEngine } from "./estilo-referencia";

describe("styleReferenceForEngine", () => {
  it("sin referencia o sin summary → null", () => {
    expect(styleReferenceForEngine(null)).toBeNull();
    expect(styleReferenceForEngine({})).toBeNull();
    expect(styleReferenceForEngine({ summary: "  " })).toBeNull();
  });

  it("con verdict 'va' devuelve solo el summary (la nota es elogio, no guía)", () => {
    expect(
      styleReferenceForEngine({
        summary: "Minimal con estructura",
        fit: { verdict: "va", note: "va perfecto con tu invierno" },
      })
    ).toBe("Minimal con estructura");
  });

  it("con 'ajustes' u 'ojo' anexa la evaluación honesta", () => {
    const r = styleReferenceForEngine({
      summary: "Boho relajado",
      fit: { verdict: "ojo", note: "es muy cálido para ti; llévalo a tus tonos fríos" },
    });
    expect(r).toContain("Boho relajado");
    expect(r).toContain("es muy cálido para ti");
  });

  it("nota vacía o verdict desconocido no anexan nada", () => {
    expect(
      styleReferenceForEngine({ summary: "Clásico", fit: { verdict: "ajustes", note: " " } })
    ).toBe("Clásico");
    expect(
      styleReferenceForEngine({ summary: "Clásico", fit: { verdict: "otro", note: "x" } })
    ).toBe("Clásico");
  });
});
