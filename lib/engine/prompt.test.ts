import { describe, it, expect } from "vitest";
import { describeItem, type EngineItem } from "./prompt";

// Helper: prenda del motor con attrs mínimos + overrides.
const item = (attrs: EngineItem["attrs"]): EngineItem => ({ id: "x", attrs });

describe("describeItem — datos ricos v21", () => {
  it("línea base: nombre · color hex · formalidad · temporada", () => {
    expect(
      describeItem(
        item({
          nombre: "Jeans rectos",
          color: "azul",
          color_hex: "#27437B",
          formalidad: "casual",
          temporada: "todo-el-año",
        })
      )
    ).toBe("Jeans rectos · azul #27437B · casual · todo-el-año");
  });

  it("color_secundario se pega al color ('azul #123456 con blanco')", () => {
    expect(
      describeItem(
        item({
          nombre: "Camisa de rayas",
          color: "azul",
          color_hex: "#123456",
          color_secundario: "blanco",
        })
      )
    ).toBe("Camisa de rayas · azul #123456 con blanco");
  });

  it("sin color base NO se agrega el secundario suelto", () => {
    expect(
      describeItem(item({ nombre: "Bufanda", color_secundario: "rojo" }))
    ).toBe("Bufanda");
  });

  it("material entra a los extras", () => {
    expect(
      describeItem(item({ nombre: "Suéter", color: "gris", material: "lana" }))
    ).toBe("Suéter · gris · lana");
  });

  it('patrón con estampado se anuncia como "estampado X"', () => {
    expect(
      describeItem(item({ nombre: "Falda", color: "negro", patron: "floral" }))
    ).toBe("Falda · negro · estampado floral");
  });

  it('patrón "liso" se dice liso a secas (no "estampado liso")', () => {
    expect(
      describeItem(item({ nombre: "Playera", color: "blanco", patron: "liso" }))
    ).toBe("Playera · blanco · liso");
  });

  it('patrón genérico "estampado" no se duplica (no "estampado estampado")', () => {
    expect(
      describeItem(item({ nombre: "Blusa", color: "verde", patron: "estampado" }))
    ).toBe("Blusa · verde · estampado");
  });

  it("sin patrón no aparece nada de estampado (prendas legacy)", () => {
    const line = describeItem(item({ nombre: "Playera", color: "blanco" }));
    expect(line).not.toContain("liso");
    expect(line).not.toContain("estampado");
  });

  it("orden completo: material y patrón van antes de corte/largo/manga", () => {
    expect(
      describeItem(
        item({
          nombre: "Camisa",
          color: "azul",
          color_hex: "#27437B",
          color_secundario: "blanco",
          formalidad: "formal",
          temporada: "calor",
          material: "lino",
          patron: "rayas",
          corte: "recto",
          largo: "regular",
          manga: "larga",
        })
      )
    ).toBe(
      "Camisa · azul #27437B con blanco · formal · calor · lino · estampado rayas · corte recto · largo regular · manga larga"
    );
  });

  it("cae al tipo cuando no hay nombre", () => {
    expect(describeItem(item({ tipo: "camisa", color: "azul" }))).toBe(
      "camisa · azul"
    );
  });
});

import { orderClosetForEngine } from "./prompt";

describe("orderClosetForEngine — anti sesgo posicional", () => {
  const it2 = (id: string, categoria: string): EngineItem => ({
    id,
    attrs: { nombre: id, categoria } as EngineItem["attrs"],
  });
  const closet = [
    it2("t1", "top"), it2("b1", "bottom"), it2("t2", "top"),
    it2("c1", "calzado"), it2("b2", "bottom"), it2("t3", "top"),
  ];

  it("conserva todas las prendas (mismo multiset)", () => {
    const out = orderClosetForEngine(closet, () => 0.5);
    expect(out.map((i) => i.id).sort()).toEqual(["b1", "b2", "c1", "t1", "t2", "t3"]);
  });

  it("agrupa por categoría (grupos contiguos)", () => {
    const out = orderClosetForEngine(closet, () => 0.5);
    const cats = out.map((i) => (i.attrs as { categoria?: string }).categoria);
    // Cada categoría aparece en un solo tramo contiguo.
    const seen = new Set<string>();
    let prev: string | undefined;
    for (const c of cats) {
      if (c !== prev && seen.has(c!)) throw new Error(`categoría partida: ${c}`);
      if (c !== prev) seen.add(c!);
      prev = c;
    }
    expect(seen.size).toBe(3);
  });

  it("baraja dentro del grupo según rand (determinista con seed)", () => {
    // rand=0 → Fisher-Yates siempre intercambia con el índice 0 (rota el grupo).
    const a = orderClosetForEngine(closet, () => 0).map((i) => i.id);
    const b = orderClosetForEngine(closet, () => 0.999).map((i) => i.id);
    expect(a).not.toEqual(b); // dos seeds distintas → órdenes distintos
  });
});
