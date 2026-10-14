import { describe, it, expect } from "vitest";
import { lineaMetal, metalDePersona, quizMetalDe } from "@/lib/colorimetria";
import { lineaCorteCapsula } from "@/lib/engine/trip-capsule";

describe("metalDePersona — su respuesta manda", () => {
  it("el caso real: invierno con flow otoño que contestó plata es plata, no oro", () => {
    expect(metalDePersona("invierno", "otono", "plata")).toBe("plata");
  });
  it("si dijo oro, es oro aunque su estación sea fría", () => {
    expect(metalDePersona("invierno", null, "oro")).toBe("oro");
  });
  it("si dijo 'no sé', decide la estación; en la frontera le van los dos", () => {
    expect(metalDePersona("invierno", "otono", "ambos")).toBe("ambos");
    expect(metalDePersona("otono", null, null)).toBe("oro");
    expect(metalDePersona("verano", null, undefined)).toBe("plata");
  });
  it("lee el quiz guardado sin romperse con basura", () => {
    expect(quizMetalDe({ metal: "plata", ojos: "oscuros" })).toBe("plata");
    expect(quizMetalDe(null)).toBeNull();
    expect(quizMetalDe({ metal: 3 })).toBeNull();
  });
});

describe("lineaMetal", () => {
  it("plata elegida: prohíbe el oro y dice que lo eligió", () => {
    const l = lineaMetal("plata", true);
    expect(l).toContain("SIEMPRE plata, NUNCA oro");
    expect(l).toContain("lo eligió");
  });
  it("ambos: no fuerza ninguno", () => {
    const l = lineaMetal("ambos", false);
    expect(l).not.toMatch(/SIEMPRE/);
  });
});

describe("lineaCorteCapsula", () => {
  it("sólo dice algo cuando hay preferencia", () => {
    expect(lineaCorteCapsula(null)).toBe("");
    expect(lineaCorteCapsula("holgada")).toContain("HOLGADA");
    expect(lineaCorteCapsula("recta")).toContain("Recto no es entallado");
  });
});
