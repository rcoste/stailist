import { describe, it, expect } from "vitest";
import { buildHomeChecklist, type ChecklistSignals } from "./home-checklist";

const nada: ChecklistSignals = {
  hasStyleReference: false,
  hasCapsule: false,
  siluetaApplies: true,
  hasSilueta: false,
};

describe("buildHomeChecklist (v2 — solo one-time sin otra casa)", () => {
  it("hombre/mujer sin nada: 3 pasos — estilo, silueta, cápsula al final", () => {
    const c = buildHomeChecklist(nada);
    expect(c).not.toBeNull();
    expect(c!.steps.map((s) => s.id)).toEqual(["estilo", "silueta", "capsula"]);
    expect(c!.steps.every((s) => !s.done)).toBe(true);
    expect(c!.doneCount).toBe(0);
    expect(c!.total).toBe(3);
  });

  // EL CONTRATO DEL REDISEÑO 2026-08-11: avatar y prendas NO viven aquí.
  // Avatar: su empujón es el CTA del try-on (look-detail). Prendas: es acción
  // RECURRENTE con tile permanente en el home — aquí duplicaría la pantalla.
  it("ni avatar ni prendas son pasos del checklist", () => {
    const ids = buildHomeChecklist(nada)!.steps.map((s) => s.id as string);
    expect(ids).not.toContain("avatar");
    expect(ids).not.toContain("prendas");
  });

  it("silueta se omite cuando no aplica (género sin contenido de silueta)", () => {
    const c = buildHomeChecklist({ ...nada, siluetaApplies: false });
    expect(c!.steps.map((s) => s.id)).toEqual(["estilo", "capsula"]);
    expect(c!.total).toBe(2);
  });

  it("refleja el estado de cada señal", () => {
    const c = buildHomeChecklist({ ...nada, hasStyleReference: true });
    expect(c!.doneCount).toBe(1);
    const byId = Object.fromEntries(c!.steps.map((s) => [s.id, s.done]));
    expect(byId.estilo).toBe(true);
    expect(byId.silueta).toBe(false);
  });

  it("se autodestruye (null) cuando todos los pasos aplicables están hechos", () => {
    const c = buildHomeChecklist({
      hasStyleReference: true,
      hasCapsule: true,
      siluetaApplies: true,
      hasSilueta: true,
    });
    expect(c).toBeNull();
  });

  it("no se completa si falta la silueta (cuando aplica)", () => {
    const c = buildHomeChecklist({
      hasStyleReference: true,
      hasCapsule: true,
      siluetaApplies: true,
      hasSilueta: false,
    });
    expect(c).not.toBeNull();
    expect(c!.doneCount).toBe(2);
    expect(c!.total).toBe(3);
  });

  it("la cápsula siempre va al final", () => {
    const c = buildHomeChecklist(nada);
    expect(c!.steps[c!.steps.length - 1].id).toBe("capsula");
  });
});
