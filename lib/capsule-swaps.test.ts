import { describe, it, expect } from "vitest";
import {
  capsuleRows,
  capsuleView,
  capsuleRejectCount,
  capsuleEscalated,
  SWAP_CAP,
  type CapsuleItem,
  type CapsuleMatch,
  type CapsuleSwaps,
  type CapsuleTarget,
  type MatchStatus,
} from "./capsule";

// --- Fixtures --------------------------------------------------------------
const item = (nombre: string, category: CapsuleItem["category"] = "top"): CapsuleItem => ({
  nombre,
  tipo: nombre,
  category,
  colorFamilia: "neutro",
  formalidad: "casual",
  temporada: "todo-el-año",
  prioridad: 1,
  porque: "x",
});

const target = (n: number): CapsuleTarget => ({
  version: 2,
  items: Array.from({ length: n }, (_, i) => item(`ideal${i}`)),
});

const matchAll = (n: number, status: MatchStatus): CapsuleMatch => ({
  signature: "sig",
  entries: Array.from({ length: n }, () => ({ status, by: null })),
});

// --- capsuleRows: overlay de swaps ----------------------------------------
describe("capsuleRows con swaps", () => {
  it("sobrepone la alternativa del swap sobre el ideal de ese slot", () => {
    const swaps: CapsuleSwaps = { "1": { item: item("alternativa"), rejectedCount: 1 } };
    const rows = capsuleRows(target(3), matchAll(3, "falta"), null, swaps);
    expect(rows[1].item.nombre).toBe("alternativa"); // el slot swapeado muestra la alt
    expect(rows[1].swapCount).toBe(1);
    expect(rows[1].atSwapCap).toBe(false);
    expect(rows[0].item.nombre).toBe("ideal0"); // los demás siguen con su ideal
    expect(rows[0].swapCount).toBe(0);
  });

  it("marca atSwapCap y dismissed al llegar al tope", () => {
    const swaps: CapsuleSwaps = {
      "0": { item: item("alt"), rejectedCount: SWAP_CAP, dismissed: true },
    };
    const rows = capsuleRows(target(2), matchAll(2, "falta"), null, swaps);
    expect(rows[0].atSwapCap).toBe(true);
    expect(rows[0].dismissed).toBe(true);
    expect(rows[1].dismissed).toBe(false);
  });

  it("sin swaps se comporta como antes (ideal + sin flags)", () => {
    const rows = capsuleRows(target(2), matchAll(2, "falta"), null, null);
    expect(rows.every((r) => r.swapCount === 0 && !r.atSwapCap && !r.dismissed)).toBe(true);
  });
});

// --- capsuleView: excluye los retirados -----------------------------------
describe("capsuleView con dismissed", () => {
  it("los slots retirados no cuentan en total ni cobertura", () => {
    const swaps: CapsuleSwaps = {
      "2": { item: item("alt"), rejectedCount: SWAP_CAP, dismissed: true },
    };
    const view = capsuleView(target(3), matchAll(3, "tienes"), null, swaps);
    expect(view.totalCount).toBe(2); // 3 - 1 retirado
    expect(view.haveCount).toBe(2);
    expect(view.coveragePct).toBe(100);
  });
});

// --- Conteo de rechazos ----------------------------------------------------
describe("capsuleRejectCount", () => {
  it("cuenta los slots con rechazo", () => {
    const swaps: CapsuleSwaps = {
      "0": { item: item("a"), rejectedCount: 1 },
      "3": { item: item("b"), rejectedCount: 2, dismissed: true },
    };
    expect(capsuleRejectCount(swaps)).toBe(2);
    expect(capsuleRejectCount(null)).toBe(0);
  });
});

// --- Umbral de escalada (1 de cada 3) --------------------------------------
describe("capsuleEscalated", () => {
  const swapsOf = (n: number): CapsuleSwaps =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => [String(i), { item: item(`a${i}`), rejectedCount: 1 }])
    );

  it("escala al descartar >= ceil(total/3)", () => {
    const t = target(9); // umbral = 3
    expect(capsuleEscalated(t, null)).toBe(false);
    expect(capsuleEscalated(t, swapsOf(2))).toBe(false); // 2 < 3
    expect(capsuleEscalated(t, swapsOf(3))).toBe(true); // 3 >= 3
  });

  it("redondea hacia arriba (6 piezas → umbral 2)", () => {
    const t = target(6);
    expect(capsuleEscalated(t, swapsOf(1))).toBe(false);
    expect(capsuleEscalated(t, swapsOf(2))).toBe(true);
  });

  it("cápsula vacía nunca escala", () => {
    expect(capsuleEscalated(target(0), null)).toBe(false);
  });
});
