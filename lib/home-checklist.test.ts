import { describe, it, expect } from "vitest";
import { buildHomeChecklist, type ChecklistSignals } from "./home-checklist";

const nada: ChecklistSignals = {
  hasAvatar: false,
  editedCloset: false,
  hasStyleReference: false,
  hasCapsule: false,
  siluetaApplies: true,
  hasSilueta: false,
};

describe("buildHomeChecklist", () => {
  it("hombre/mujer sin nada: 5 pasos, avatar primero y cápsula al final", () => {
    const c = buildHomeChecklist(nada);
    expect(c).not.toBeNull();
    expect(c!.steps.map((s) => s.id)).toEqual([
      "avatar",
      "prendas",
      "estilo",
      "silueta",
      "capsula",
    ]);
    expect(c!.steps.every((s) => !s.done)).toBe(true);
    expect(c!.doneCount).toBe(0);
    expect(c!.total).toBe(5);
  });

  it("silueta se omite cuando no aplica (género sin contenido de silueta)", () => {
    const c = buildHomeChecklist({ ...nada, siluetaApplies: false });
    expect(c!.steps.map((s) => s.id)).toEqual([
      "avatar",
      "prendas",
      "estilo",
      "capsula",
    ]);
    expect(c!.total).toBe(4);
  });

  it("refleja el estado de cada señal", () => {
    const c = buildHomeChecklist({
      ...nada,
      hasAvatar: true,
      hasStyleReference: true,
    });
    expect(c!.doneCount).toBe(2);
    const byId = Object.fromEntries(c!.steps.map((s) => [s.id, s.done]));
    expect(byId.avatar).toBe(true);
    expect(byId.estilo).toBe(true);
    expect(byId.prendas).toBe(false);
  });

  it("se autodestruye (null) cuando todos los pasos aplicables están hechos", () => {
    const c = buildHomeChecklist({
      hasAvatar: true,
      editedCloset: true,
      hasStyleReference: true,
      hasCapsule: true,
      siluetaApplies: true,
      hasSilueta: true,
    });
    expect(c).toBeNull();
  });

  it("no se completa si falta la silueta (cuando aplica)", () => {
    const c = buildHomeChecklist({
      hasAvatar: true,
      editedCloset: true,
      hasStyleReference: true,
      hasCapsule: true,
      siluetaApplies: true,
      hasSilueta: false,
    });
    expect(c).not.toBeNull();
    expect(c!.doneCount).toBe(4);
    expect(c!.total).toBe(5);
  });

  it("la cápsula siempre va al final", () => {
    const c = buildHomeChecklist(nada);
    expect(c!.steps[c!.steps.length - 1].id).toBe("capsula");
  });
});
