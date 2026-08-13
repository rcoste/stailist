import { describe, it, expect } from "vitest";
import {
  capsuleFloor,
  capsuleFloorGaps,
  fmtDiaMes,
  rangoFechas,
  nombreDeViaje,
  rutaDeViaje,
  type Occasion,
} from "./trip";

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

describe("fmtDiaMes / rangoFechas — las fechas como se leen (handoff viaje 2)", () => {
  it("fmtDiaMes: día sin cero a la izquierda + mes corto", () => {
    expect(fmtDiaMes("2026-12-07")).toBe("7 dic");
    expect(fmtDiaMes("2026-01-31")).toBe("31 ene");
  });

  it("rangoFechas mismo mes: el mes se dice UNA vez", () => {
    expect(rangoFechas("2026-12-07", "2026-12-13")).toBe("7 – 13 dic");
  });

  it("rangoFechas cruzando de mes: cada fecha con su mes", () => {
    expect(rangoFechas("2026-11-28", "2026-12-03")).toBe("28 nov – 3 dic");
  });
});

describe("nombreDeViaje — el nombre corto para títulos (handoff viaje 2)", () => {
  const p = (lugar: string) => ({ lugar });

  it("una parada: el nombre tal cual", () => {
    expect(nombreDeViaje("Nueva York", [p("Nueva York, Nueva York, Estados Unidos")])).toBe(
      "Nueva York"
    );
    expect(nombreDeViaje("Tokio", null)).toBe("Tokio");
  });

  it("multidestino con país compartido: el país (la fila 'Japón' del handoff)", () => {
    expect(
      nombreDeViaje("Tokio · Kioto · Osaka", [
        p("Tokio, Tokio, Japón"),
        p("Kioto, Kioto, Japón"),
        p("Osaka, Osaka, Japón"),
      ])
    ).toBe("Japón");
  });

  it("multidestino cruzando países: cae a 'X y N más'", () => {
    expect(
      nombreDeViaje("Madrid · París", [p("Madrid, Madrid, España"), p("París, Isla de Francia, Francia")])
    ).toBe("Madrid y 1 más");
  });

  it("paradas sin país (escritas a mano, sin geocodificar): cae a 'X y N más'", () => {
    expect(nombreDeViaje("Comala · Suchitlán", [p("Comala"), p("Suchitlán")])).toBe(
      "Comala y 1 más"
    );
  });
});

describe("rutaDeViaje — la ruta en el renglón de fechas", () => {
  it("multidestino: primeras partes unidas con flechas", () => {
    expect(
      rutaDeViaje([
        { lugar: "Tokio, Tokio, Japón" },
        { lugar: "Kioto, Kioto, Japón" },
        { lugar: "Osaka, Osaka, Japón" },
      ])
    ).toBe("Tokio → Kioto → Osaka");
  });

  it("una parada o ninguna: no hay ruta que contar", () => {
    expect(rutaDeViaje([{ lugar: "Tokio, Tokio, Japón" }])).toBeNull();
    expect(rutaDeViaje(null)).toBeNull();
  });
});
