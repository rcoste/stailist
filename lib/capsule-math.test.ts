import { describe, it, expect } from "vitest";
import { outfitsNow, unlocksByIndex } from "./capsule-math";
import type { CapsuleRow } from "./capsule";

// Helper: fila mínima con lo que la combinatoria necesita (categoría + covered).
let n = 0;
const row = (category: string, covered: boolean): CapsuleRow =>
  ({
    index: n++,
    item: { nombre: "x", tipo: "x", category, colorFamilia: "x", formalidad: "casual", temporada: "todo-el-año", prioridad: 1, porque: "x" },
    base: covered ? "tienes" : "falta",
    covered,
    by: null,
  }) as unknown as CapsuleRow;

describe("outfitsNow", () => {
  it("(tops×bottoms + vestidos) × (capas+1) × calzado, calibrado 0.5", () => {
    // 4 tops, 2 bottoms, 0 vestidos, 1 capa, 2 calzado → (8)×2×2=32 → ×0.5 = 16
    n = 0;
    const rows = [
      ...Array.from({ length: 4 }, () => row("top", true)),
      ...Array.from({ length: 2 }, () => row("bottom", true)),
      row("abrigo", true),
      ...Array.from({ length: 2 }, () => row("calzado", true)),
    ];
    expect(outfitsNow(rows)).toBe(16);
  });

  it("una categoría multiplicadora vacía → 0 outfits completos", () => {
    n = 0;
    expect(outfitsNow([row("top", true), row("top", true), row("calzado", true)])).toBe(0); // sin bottoms ni vestidos
  });

  it("los no-cubiertos no cuentan", () => {
    n = 0;
    const rows = [row("top", true), row("bottom", false), row("calzado", true)];
    expect(outfitsNow(rows)).toBe(0); // el único bottom no está cubierto
  });
});

describe("unlocksByIndex", () => {
  it("la prenda que destapa una categoría vacía desbloquea más", () => {
    n = 0;
    // Tengo 4 tops, 2 calzado cubiertos; 0 bottoms. Me falta 1 bottom y 1 quinto top.
    const bottom = row("bottom", false);
    const quintoTop = row("top", false);
    const rows = [
      ...Array.from({ length: 4 }, () => row("top", true)),
      ...Array.from({ length: 2 }, () => row("calzado", true)),
      bottom,
      quintoTop,
    ];
    const u = unlocksByIndex(rows);
    // bottom: base 0 → con 1 bottom = (4×1)×1×2×0.5 = 4. quinto top: sigue 0 bottoms = 0.
    expect(u.get(bottom.index)).toBe(4);
    expect(u.get(quintoTop.index)).toBe(0);
    expect(u.get(bottom.index)!).toBeGreaterThan(u.get(quintoTop.index)!);
  });

  it("accesorios no desbloquean por la fórmula", () => {
    n = 0;
    const acc = row("accesorio", false);
    const u = unlocksByIndex([row("top", true), row("bottom", true), row("calzado", true), acc]);
    expect(u.has(acc.index)).toBe(false);
  });
});
