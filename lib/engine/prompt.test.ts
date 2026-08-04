import { describe, it, expect } from "vitest";
import {
  describeItem,
  REGLA_PRENDAS_REALES,
  SYSTEM_PROMPT,
  type EngineItem,
} from "./prompt";

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

import { ageStylingLine } from "@/lib/edad";

describe("contextBlock — edad como señal suave (feedback Nuri)", () => {
  it("con ageStyling la línea entra tal cual al contexto", () => {
    const linea = ageStylingLine("13-17");
    const lines = contextBlock({ ...baseCtx, ageStyling: linea });
    expect(lines).toContain(linea);
  });

  it("55+ también entra (el otro extremo con señal)", () => {
    const linea = ageStylingLine("55+");
    const lines = contextBlock({ ...baseCtx, ageStyling: linea });
    expect(lines).toContain(linea);
  });

  it("sin ageStyling (null/undefined/rangos medios) no agrega línea", () => {
    for (const v of [null, undefined, ageStylingLine("25-34")]) {
      const lines = contextBlock({ ...baseCtx, ageStyling: v });
      expect(lines.some((l) => l.includes("SUAVE"))).toBe(false);
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

// v27 · Ropa de baño y de entrenar fuera de los looks de calle. El catálogo no
// marca contexto en ninguna prenda (todas "casual"), y bikini/traje de baño están
// como categoría "vestido" — o sea, el motor los podía servir como look COMPLETO.
// La única defensa es esta regla, así que se blinda con test.
describe("SYSTEM_PROMPT — ropa de baño y de entrenar (v27)", () => {
  it("prohíbe traje de baño / bikini / short de baño en looks de calle", () => {
    expect(SYSTEM_PROMPT).toContain("Ropa de baño y de entrenar NO es ropa de calle");
    expect(SYSTEM_PROMPT).toContain("bikini");
    expect(SYSTEM_PROMPT).toContain("short de baño");
    // Nombra el hueco del catálogo: vienen categorizados como "vestido".
    expect(SYSTEM_PROMPT).toContain('"vestido"');
  });

  it("al top deportivo tipo bra le pide una capa, no lo prohíbe", () => {
    expect(SYSTEM_PROMPT).toContain("bra");
    expect(SYSTEM_PROMPT).toContain("ÚNICO top");
    expect(SYSTEM_PROMPT).toMatch(/capa encima/);
  });
});

describe("REGLA_PRENDAS_REALES — no inventar prendas que no existen", () => {
  it("prohíbe explícitamente los tejidos de punto en lino", () => {
    // El motor le propuso a Roberto una "Playera de lino esmeralda" (tipo
    // "playera-lino"). El lino no se teje en punto: esa prenda no se vende.
    const r = REGLA_PRENDAS_REALES.toLowerCase();
    expect(r).toContain("lino no se teje en punto");
    expect(r).toContain("no playeras");
    expect(r).toContain("suéteres de lino");
  });

  it("nombra el test que debe aplicar el modelo: que se pueda comprar tal cual", () => {
    expect(REGLA_PRENDAS_REALES.toLowerCase()).toContain("comprar tal cual");
  });

  it("cubre las prendas cuyo nombre ya implica su tela", () => {
    expect(REGLA_PRENDAS_REALES.toLowerCase()).toContain("jeans son de mezclilla");
  });
});

describe("contextBlock — preferencia de corte (v29)", () => {
  it("holgada: manda elegir el corte amplio pero conserva la regla de una sola zona con volumen", () => {
    const line = contextBlock({ ...baseCtx, fitPref: "holgada" }).find((l) =>
      l.includes("Cómo le gusta que le quede")
    );
    expect(line).toContain("HOLGADA");
    // Sin este freno, "prefiere holgado" se lee como permiso para inflar todo
    // el look y sale un disfraz, que es justo lo que las recetas vetan.
    expect(line).toContain("solo UNA zona lleva volumen");
  });

  it("recta: pide corte recto y aclara que recto no es entallado", () => {
    const line = contextBlock({ ...baseCtx, fitPref: "recta" }).find((l) =>
      l.includes("Cómo le gusta que le quede")
    );
    expect(line).toContain("RECTA");
    expect(line).toContain("no es entallado");
  });

  it("mixta: NO se traduce a un corte — deja mandar a la receta", () => {
    // Cuando los dos pares se contradicen, la persona no tiene preferencia
    // fuerte. Convertir esa moneda al aire en "recta" u "holgada" haría que el
    // motor actuara con confianza sobre un dato falso.
    const line = contextBlock({ ...baseCtx, fitPref: "mixta" }).find((l) =>
      l.includes("Cómo le gusta que le quede")
    );
    expect(line).toContain("NO tiene preferencia fuerte");
    expect(line).not.toContain("elige la de corte amplio");
    expect(line).not.toContain("elige el corte recto");
  });

  it("sin dato no agrega línea (perfiles anteriores a los pares)", () => {
    for (const fitPref of [null, undefined] as const) {
      const lines = contextBlock({ ...baseCtx, fitPref });
      expect(lines.some((l) => l.includes("Cómo le gusta que le quede"))).toBe(false);
    }
  });

  it("el gusto de corte y el cuerpo son líneas distintas y conviven", () => {
    // La trampa a evitar: que alguien confunda body_build (qué cuerpo tienes)
    // con fit_pref (cómo te gusta que quede). Son preguntas distintas y el
    // prompt debe llevar las dos sin que una pise a la otra.
    const lines = contextBlock({
      ...baseCtx,
      fitPref: "holgada",
      silueta: "complexión media, carga arriba",
    });
    expect(lines.some((l) => l.includes("Su cuerpo (orientación de styling"))).toBe(true);
    expect(lines.some((l) => l.includes("Cómo le gusta que le quede"))).toBe(true);
  });
});
