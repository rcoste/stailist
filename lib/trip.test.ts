import { describe, it, expect } from "vitest";
import { capsuleFloor, capsuleFloorGaps, type Occasion } from "./trip";

describe("capsuleFloor — piso de suficiencia (v24)", () => {
  it("caso NY real: 5 días, ciudad+noche+traslado, documentada (16)", () => {
    // El bug que motivó esto: el motor sugería 4 tops para 5 días con noches.
    const oc: Occasion[] = ["ciudad", "noche", "traslado"];
    const f = capsuleFloor(5, oc, 16);
    expect(f.tops).toBe(5); // ceil(5*0.8)=4 +1 por noche
    expect(f.bottoms).toBe(3); // ceil(5/2)
    expect(f.calzado).toBe(2);
  });

  it("sin noches no suma el top extra", () => {
    expect(capsuleFloor(5, ["ciudad"], 16).tops).toBe(4);
  });

  it("viajes largos no crecen infinito (se asume lavar/re-usar)", () => {
    const f = capsuleFloor(14, ["ciudad", "noche"], 32);
    expect(f.tops).toBeLessThanOrEqual(8);
    expect(f.bottoms).toBeLessThanOrEqual(4);
  });

  it("escapada corta con mochila: piso mínimo compacto", () => {
    const f = capsuleFloor(2, ["ciudad"], 7);
    expect(f.tops).toBe(3);
    expect(f.bottoms).toBe(1);
    expect(f.calzado).toBe(1);
    expect(f.tops + f.bottoms + f.calzado).toBeLessThanOrEqual(7);
  });

  it("el techo del equipaje comprime el piso (techo manda)", () => {
    // 7 días + noche pediría 7 tops, pero una mochila (7) no los aguanta.
    const f = capsuleFloor(7, ["ciudad", "noche"], 7);
    expect(f.tops + f.bottoms + f.calzado).toBeLessThanOrEqual(7);
    expect(f.tops).toBeGreaterThanOrEqual(3);
    expect(f.bottoms).toBeGreaterThanOrEqual(2);
  });

  it("sin equipaje definido (capacidad 0) el piso no se comprime", () => {
    const f = capsuleFloor(5, ["ciudad", "noche"], 0);
    expect(f.tops).toBe(5);
    expect(f.calzado).toBe(2);
  });
});

describe("capsuleFloorGaps — validación contra el piso", () => {
  const floor = { tops: 5, bottoms: 3, calzado: 2 };
  const items = (counts: Record<string, number>) =>
    Object.entries(counts).flatMap(([category, n]) =>
      Array.from({ length: n }, () => ({ category }))
    );

  it("cápsula corta reporta los huecos", () => {
    const gaps = capsuleFloorGaps(items({ top: 4, bottom: 3, calzado: 2 }), floor);
    expect(gaps).toEqual(["tops 4/5"]);
  });

  it("un vestido cuenta como top", () => {
    const gaps = capsuleFloorGaps(
      items({ top: 4, vestido: 1, bottom: 3, calzado: 2 }),
      floor
    );
    expect(gaps).toEqual([]);
  });

  it("cápsula que cumple devuelve []", () => {
    expect(capsuleFloorGaps(items({ top: 5, bottom: 3, calzado: 2 }), floor)).toEqual([]);
  });
});

describe("capsuleFloor — techos irreales (borde documentado)", () => {
  it("con capacidad < 7 el mínimo 3/2/2 gana sobre el techo (inalcanzable vía UI)", () => {
    // La compresión no baja de tops=3/bottoms=2: con techos irreales el piso
    // mínimo excede el techo a propósito — mejor piso honesto que cápsula rota.
    const f = capsuleFloor(5, ["ciudad"], 4);
    expect(f.tops).toBe(3);
    expect(f.bottoms).toBe(2);
  });
});

describe("capsuleFloorGaps — vestidos acreditan bottoms", () => {
  it("cápsula liderada por vestidos no exige bottoms de sobra", () => {
    const items = [
      ...Array.from({ length: 3 }, () => ({ category: "vestido" })),
      ...Array.from({ length: 2 }, () => ({ category: "top" })),
      { category: "bottom" },
      ...Array.from({ length: 2 }, () => ({ category: "calzado" })),
    ];
    // piso 5/3/2: tops = 2+3(vestidos) = 5 ✓, bottoms = 1+3 = 4 ≥ 3 ✓
    expect(capsuleFloorGaps(items, { tops: 5, bottoms: 3, calzado: 2 })).toEqual([]);
  });
});
