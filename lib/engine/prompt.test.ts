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

import { contextBlock, type EngineContext } from "./prompt";
import { EMPTY_TASTE_SIGNAL } from "./taste-signal";

// Contexto mínimo: todo apagado, para probar cada línea nueva por separado.
const baseCtx: EngineContext = {
  gender: null,
  objective: null,
  plan: null,
  lifestyle: null,
  tasteTags: [],
  archetype: null,
  season: null,
  flow: null,
  items: [],
  weather: null,
  recentCombos: [],
  vetoes: [],
  timeOfDay: null,
  silueta: null,
  tasteSignal: EMPTY_TASTE_SIGNAL,
};

describe("contextBlock — género en el generador (v23)", () => {
  it("mujer: pide concordancia femenina y ojo de moda femenina", () => {
    const lines = contextBlock({ ...baseCtx, gender: "mujer" });
    expect(lines[0]).toContain("EN FEMENINO");
    expect(lines[0]).toContain("moda femenina");
  });

  it("hombre: pide concordancia masculina y criterio masculino", () => {
    const lines = contextBlock({ ...baseCtx, gender: "hombre" });
    expect(lines[0]).toContain("EN MASCULINO");
    expect(lines[0]).toContain("moda masculina");
  });

  it("sin género: pide frases neutras (no cae al masculino)", () => {
    const lines = contextBlock({ ...baseCtx, gender: null });
    expect(lines[0]).toContain("Género no definido");
    expect(lines[0]).toContain("frases neutras");
  });
});

describe("contextBlock — señales de estilo (v24)", () => {
  it("los tags se anuncian en orden de fuerza", () => {
    const lines = contextBlock({ ...baseCtx, tasteTags: ["pulido", "edgy"] });
    expect(lines).toContain("Tags de gusto (en orden de fuerza): pulido, edgy.");
  });

  it("sus palabras entran citadas y mandan sobre los tags", () => {
    const lines = contextBlock({ ...baseCtx, styleWords: "  básicos neutros  " });
    const line = lines.find((l) => l.includes("EN SUS PALABRAS"));
    expect(line).toContain('"básicos neutros"'); // trim aplicado
    expect(line).toContain("sus palabras mandan");
  });

  it("styleWords vacío o en blanco no agrega línea", () => {
    for (const words of [null, undefined, "", "   "]) {
      const lines = contextBlock({ ...baseCtx, styleWords: words });
      expect(lines.some((l) => l.includes("EN SUS PALABRAS"))).toBe(false);
    }
  });
});

import { tasteSignalLines } from "./prompt";

describe("tasteSignalLines — compartida por 4 motores (v24)", () => {
  it("señal vacía → sin líneas (no estorba el prompt)", () => {
    expect(tasteSignalLines(EMPTY_TASTE_SIGNAL)).toEqual([]);
  });

  it("worn/liked/disliked producen sus marcadores", () => {
    const lines = tasteSignalLines({
      worn: [{ title: "Look A", items: ["camisa", "jeans"], occasion: "oficina", reason: null }],
      liked: [{ title: null, items: ["polo"], occasion: null, reason: null }],
      disliked: [{ title: "Look B", items: ["saco"], occasion: null, reason: "muy formal" }],
      skipped: [],
    }).join("\n");
    expect(lines).toContain("SE LO PUSO");
    expect(lines).toContain("👍");
    expect(lines).toContain("RECHAZÓ");
    expect(lines).toContain("muy formal");
  });
});
