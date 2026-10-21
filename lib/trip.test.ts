import { describe, it, expect } from "vitest";
import {
  capsuleFloor,
  capsuleFloorGaps,
  preguntarLavado,
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

  // Hasta el 2026-10-21 eran ~0.8 tops por día contando suéteres (5 días sin
  // noches = 4). La base no se repite: ahora es una por día.
  it("sin noches: una prenda base por día", () => {
    const f = capsuleFloor(5, ["ciudad"], 16);
    expect(f.base).toBe(5);
    expect(f.tops).toBe(5);
  });

  // Antes se suponía que lavas y el piso se topaba en 8. Ahora sólo si lo dice:
  // pantalones y calzado sí se topan (se repiten), la base no.
  it("viaje largo sin decir que lava: una base por día si cabe; los pantalones no crecen", () => {
    const f = capsuleFloor(14, ["ciudad", "noche"], 32);
    expect(f.base).toBe(14);
    expect(f.bottoms).toBeLessThanOrEqual(4);
  });

  it("viaje largo y lava: la base es de una semana", () => {
    const f = capsuleFloor(14, ["ciudad", "noche"], 32, { lavar: true });
    expect(f.base).toBe(7);
    expect(f.baseModo).toBe("lavando");
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

// Su maleta de Mineápolis (2026-10-21): 8 días, carry-on y maleta (27). Le
// quedaron 5 camisas y playeras y 3 suéteres, y el piso de 7 "tops" se
// cumplía. "Abrigos, suéteres y pantalones se repiten; playeras y camisas no."
describe("capsuleFloor — la base no se repite", () => {
  it("su caso: 8 días, se cambia seguido, 27 de espacio → 10 prendas base con colchón", () => {
    const f = capsuleFloor(8, ["ciudad", "traslado", "noche"], 27, { cambio: "seguido" });
    expect(f.base).toBe(10);
    expect(f.baseModo).toBe("colchon");
    expect(f.tops).toBeGreaterThanOrEqual(10);
  });

  it("si repite sin problema: una por día", () => {
    expect(capsuleFloor(8, ["ciudad"], 27, { cambio: "repito" })).toMatchObject({ base: 8, baseModo: "una-por-dia" });
  });

  it("si el colchón no cabe, se suelta primero el colchón", () => {
    // 5 días con carry-on (11): con colchón serían 7 + 3 + 2 = 12 sin dejar lugar al abrigo.
    const f = capsuleFloor(5, ["ciudad"], 11, { cambio: "seguido" });
    expect(f.base).toBe(5);
    expect(f.baseModo).toBe("una-por-dia");
  });

  it("si ni una por día cabe, baja y lo marca", () => {
    const f = capsuleFloor(8, ["ciudad"], 11, { cambio: "repito" });
    expect(f.baseModo).toBe("no-cabe");
    expect(f.base).toBeLessThan(8);
    expect(f.unaPorDia).toBe(8);
    expect(f.tops + f.bottoms + f.calzado).toBeLessThanOrEqual(11);
  });

  it("27 días con tres bolsas: el abrigo y los suéteres guardan lugar, así que pregunta si lava", () => {
    expect(preguntarLavado(27, ["ciudad", "noche"], 34)).toBe(true);
    expect(capsuleFloor(27, ["ciudad", "noche"], 34, { cambio: "seguido", lavar: true }).base).toBe(9);
  });

  it("8 días con carry-on y maleta: cabe, no pregunta", () => {
    expect(preguntarLavado(8, ["ciudad", "noche"], 27)).toBe(false);
  });

  it("sin equipaje definido no pregunta", () => {
    expect(preguntarLavado(20, ["ciudad"], 0)).toBe(false);
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

  it("los suéteres no cuentan como base", () => {
    const lista = [
      ...["Camisa blanca", "Playera negra", "Polo marino"].map((nombre) => ({ category: "top", nombre, tipo: "x" })),
      ...["Suéter de merino gris", "Cuello tortuga negro"].map((nombre) => ({ category: "top", nombre, tipo: "x" })),
      ...items({ bottom: 3, calzado: 2 }),
    ];
    expect(capsuleFloorGaps(lista, { ...floor, base: 5 })).toEqual(["base 3/5"]);
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
