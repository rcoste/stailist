import { describe, it, expect } from "vitest";
import {
  buildTripGrid,
  keepOccasionCoverage,
  packableDesc,
  type PackableItem,
} from "./trip-outfits";
import type { TripOutfit } from "@/lib/trip";

// Helpers: prendas empacables mínimas, numeradas secuencialmente.
let seq = 0;
const p = (category: string, over: Partial<PackableItem> = {}): PackableItem => ({
  n: ++seq,
  nombre: `${category}-${seq}`,
  category,
  color: "negro",
  formalidad: "casual",
  ...over,
});
const reset = () => (seq = 0);

// Todas las prendas de una categoría que aparecen en ≥1 celda de la rejilla.
const coveredNs = (grid: ReturnType<typeof buildTripGrid>) =>
  new Set(grid.flatMap((c) => c.base));

describe("buildTripGrid — cobertura garantizada", () => {
  it("cada top, bottom y calzado aparece en ≥1 celda (maleta realista)", () => {
    reset();
    const packable = [
      ...Array.from({ length: 5 }, () => p("top")),
      ...Array.from({ length: 3 }, () => p("bottom")),
      ...Array.from({ length: 2 }, () => p("calzado")),
    ];
    const grid = buildTripGrid(packable);
    const used = coveredNs(grid);
    for (const item of packable) expect(used.has(item.n)).toBe(true);
  });

  it("cada vestido aparece en ≥1 celda aunque haya muchos separables (el bug del capProduct)", () => {
    reset();
    const tops = Array.from({ length: 6 }, () => p("top"));
    const bottoms = Array.from({ length: 4 }, () => p("bottom"));
    const shoes = Array.from({ length: 3 }, () => p("calzado"));
    const vestidos = Array.from({ length: 2 }, () => p("vestido"));
    const grid = buildTripGrid([...tops, ...bottoms, ...shoes, ...vestidos]);
    const used = coveredNs(grid);
    // 6×4×3 = 72 combos de separables > presupuesto, pero los vestidos NUNCA
    // se quedan fuera (antes el recorte los dejaba con cero looks).
    for (const v of vestidos) expect(used.has(v.n)).toBe(true);
    // Y la cobertura de separables también se mantiene (round-robin primero).
    for (const t of tops) expect(used.has(t.n)).toBe(true);
    for (const b of bottoms) expect(used.has(b.n)).toBe(true);
    for (const s of shoes) expect(used.has(s.n)).toBe(true);
  });

  it("no hay celdas duplicadas", () => {
    reset();
    const grid = buildTripGrid([
      ...Array.from({ length: 3 }, () => p("top")),
      ...Array.from({ length: 2 }, () => p("bottom")),
      p("calzado"),
      p("vestido"),
    ]);
    const keys = grid.map((c) => c.base.join("-"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("respeta el tope MAX_CELLS=40 con maletas grandes", () => {
    reset();
    const grid = buildTripGrid([
      ...Array.from({ length: 10 }, () => p("top")),
      ...Array.from({ length: 8 }, () => p("bottom")),
      ...Array.from({ length: 4 }, () => p("calzado")),
      ...Array.from({ length: 3 }, () => p("vestido")),
    ]);
    expect(grid.length).toBeLessThanOrEqual(40);
  });

  it("sin calzado: celdas de top+bottom (2 piezas), sin nulls", () => {
    reset();
    const tops = [p("top"), p("top")];
    const bottoms = [p("bottom")];
    const grid = buildTripGrid([...tops, ...bottoms]);
    expect(grid.length).toBe(2); // 2 tops × 1 bottom
    for (const c of grid) {
      expect(c.kind).toBe("sep");
      expect(c.base).toHaveLength(2);
      expect(c.base.every((n) => Number.isInteger(n))).toBe(true);
    }
  });

  it("sin bottoms ni vestidos → rejilla vacía (no hay look que armar)", () => {
    reset();
    expect(buildTripGrid([p("top"), p("top"), p("calzado")])).toEqual([]);
  });

  it("maleta solo de vestidos: cada vestido con calzado rotado", () => {
    reset();
    const vestidos = [p("vestido"), p("vestido")];
    const shoes = [p("calzado"), p("calzado")];
    const grid = buildTripGrid([...vestidos, ...shoes]);
    expect(grid.every((c) => c.kind === "vestido")).toBe(true);
    const used = coveredNs(grid);
    for (const v of vestidos) expect(used.has(v.n)).toBe(true);
    for (const s of shoes) expect(used.has(s.n)).toBe(true);
    // Producto completo cabe en el presupuesto: 2 vestidos × 2 calzados.
    expect(grid.length).toBe(4);
  });

  it("presupuesto de vestidos: muchos vestidos × calzados se recortan a ~12 celdas", () => {
    reset();
    const vestidos = Array.from({ length: 6 }, () => p("vestido"));
    const shoes = Array.from({ length: 4 }, () => p("calzado"));
    const grid = buildTripGrid([...vestidos, ...shoes]);
    // dressWanted = 6 × min(4,3) = 18 → recortado al presupuesto de 12,
    // pero con TODOS los vestidos cubiertos.
    expect(grid.length).toBe(12);
    const used = coveredNs(grid);
    for (const v of vestidos) expect(used.has(v.n)).toBe(true);
  });

  it("producto chico: enumera el producto completo (cobertura + relleno sin perder combos)", () => {
    reset();
    const grid = buildTripGrid([
      p("top"),
      p("top"),
      p("bottom"),
      p("bottom"),
      p("calzado"),
    ]);
    expect(grid.length).toBe(4); // 2×2×1, sin duplicados por el round-robin previo
  });

  it("capas, sacos y accesorios NO entran a la rejilla base", () => {
    reset();
    const top = p("top");
    const bottom = p("bottom");
    const abrigo = p("abrigo");
    const saco = p("saco");
    const acc = p("accesorio");
    const grid = buildTripGrid([top, bottom, abrigo, saco, acc]);
    const used = coveredNs(grid);
    expect(used.has(abrigo.n)).toBe(false);
    expect(used.has(saco.n)).toBe(false);
    expect(used.has(acc.n)).toBe(false);
    expect(used.has(top.n)).toBe(true);
    expect(used.has(bottom.n)).toBe(true);
  });
});

describe("packableDesc — línea de prompt con datos ricos", () => {
  it("prenda legacy (sin datos ricos): formalidad + color, como antes", () => {
    const item: PackableItem = {
      n: 3,
      nombre: "Camisa blanca",
      category: "top",
      color: "blanco",
      formalidad: "formal",
    };
    expect(packableDesc(item)).toBe("3. Camisa blanca (formal, blanco)");
  });

  it("con hex, material, patrón y temporada: todo entra en orden", () => {
    const item: PackableItem = {
      n: 1,
      nombre: "Suéter de rayas",
      category: "top",
      color: "azul",
      formalidad: "casual",
      hex: "#1F3A5F",
      material: "lana",
      patron: "rayas",
      temporada: "frio",
    };
    expect(packableDesc(item)).toBe(
      "1. Suéter de rayas (casual, azul #1F3A5F, lana, estampado rayas, para frio)"
    );
  });

  it('patrón "liso" se dice liso (no "estampado liso") y todo-el-año se omite', () => {
    const item: PackableItem = {
      n: 2,
      nombre: "Playera negra",
      category: "top",
      color: "negro",
      formalidad: "casual",
      patron: "liso",
      temporada: "todo-el-año",
    };
    expect(packableDesc(item)).toBe("2. Playera negra (casual, negro, liso)");
  });

  it('patrón genérico "estampado" no se duplica y color_secundario se pega al color', () => {
    const item: PackableItem = {
      n: 5,
      nombre: "Blusa bicolor",
      category: "top",
      color: "verde",
      formalidad: "casual",
      hex: "#2E5D4B",
      patron: "estampado",
      color_secundario: "blanco",
    };
    expect(packableDesc(item)).toBe(
      "5. Blusa bicolor (casual, verde #2E5D4B con blanco, estampado)"
    );
  });

  it("withCategory antepone la categoría (formato del juez)", () => {
    const item: PackableItem = {
      n: 4,
      nombre: "Tenis blancos",
      category: "calzado",
      color: "blanco",
      formalidad: "casual",
    };
    expect(packableDesc(item, true)).toBe("4. Tenis blancos (calzado, casual, blanco)");
  });
});

describe("keepOccasionCoverage — el juez no deja ocasiones huérfanas (v24)", () => {
  const look = (ocasion: TripOutfit["ocasion"], titulo: string): TripOutfit => ({
    ocasion,
    titulo,
    porque: "x",
    prendas: ["a", "b"],
  });

  it("restaura el primer look original de una ocasión vaciada por el juez", () => {
    const before = [look("ciudad", "C1"), look("noche", "N1"), look("noche", "N2")];
    const after = [look("ciudad", "C1")]; // el juez tiró las dos noches
    const out = keepOccasionCoverage(before, after);
    expect(out.map((o) => o.titulo)).toEqual(["C1", "N1"]);
  });

  it("no toca nada si todas las ocasiones siguen cubiertas", () => {
    const before = [look("ciudad", "C1"), look("noche", "N1")];
    const after = [look("ciudad", "C2"), look("noche", "N1")];
    expect(keepOccasionCoverage(before, after)).toEqual(after);
  });

  it("una ocasión que nunca tuvo looks no inventa nada", () => {
    const before = [look("ciudad", "C1")];
    const after: TripOutfit[] = [look("ciudad", "C1")];
    expect(keepOccasionCoverage(before, after).length).toBe(1);
  });
});

describe("keepOccasionCoverage — el veto gana a la cobertura (fix de review)", () => {
  const look = (ocasion: TripOutfit["ocasion"], titulo: string): TripOutfit => ({
    ocasion,
    titulo,
    porque: "x",
    prendas: ["a", "b"],
  });

  it("un look rechazado por veto NO se restaura aunque deje la ocasión huérfana", () => {
    const before = [look("ciudad", "C1"), look("noche", "N1-vetado")];
    const after = [look("ciudad", "C1")]; // el juez tiró N1 por veto
    const out = keepOccasionCoverage(before, after, new Set([1]));
    expect(out.map((o) => o.titulo)).toEqual(["C1"]);
  });

  it("con dos looks de la ocasión, se restaura el no-vetado", () => {
    const before = [look("ciudad", "C1"), look("noche", "N1-vetado"), look("noche", "N2")];
    const after = [look("ciudad", "C1")];
    const out = keepOccasionCoverage(before, after, new Set([1]));
    expect(out.map((o) => o.titulo)).toEqual(["C1", "N2"]);
  });
});
