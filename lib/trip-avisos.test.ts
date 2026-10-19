import { describe, it, expect } from "vitest";
import { avisosDeLoQueLlevas } from "@/lib/trip-avisos";
import type { CapsuleItem, CapsuleMatch, CapsuleTarget } from "@/lib/capsule";

// LO QUE BLINDA: el juez revisa lo que la persona DE VERDAD lleva. El caso
// real (2026-10-19): la lista ideal traía un trench para la lluvia de Kioto,
// pero el trench le faltaba y nadie le avisó que lo que llevaba no aguantaba.

const pieza = (nombre: string, category: string, tipo = "x", formalidad = "casual"): CapsuleItem =>
  ({ nombre, tipo, category, colorFamilia: "negro", formalidad, temporada: "todo-el-año", prioridad: 1, porque: "" }) as CapsuleItem;

const target = (items: CapsuleItem[]): CapsuleTarget => ({ items }) as CapsuleTarget;
const match = (...st: ("tienes" | "falta")[]): CapsuleMatch =>
  // Cada "tienes" con su propia prenda: la misma prenda cubriendo dos huecos se empaca una vez.
  ({ signature: "x", entries: st.map((s, i) => ({ status: s, by: s === "tienes" ? `mía ${i}` : null, difiere: null })) }) as CapsuleMatch;

const kioto = { paradas: [{ lugar: "Kioto", temp_c: 12, temp_min: 8, temp_max: 17, condition: "lluvia" }], ocasiones: ["ciudad"], dias: 5 };
const abrigo = pieza("Abrigo largo de lana negro", "abrigo", "abrigo-largo");
const botines = pieza("Botines negros", "calzado", "botin");
const trench = pieza("Trench impermeable negro", "abrigo", "trench");

describe("avisosDeLoQueLlevas", () => {
  it("su caso: lluvia en Kioto, el trench le falta → aviso que nombra el trench", () => {
    const a = avisosDeLoQueLlevas(target([abrigo, botines, trench]), match("tienes", "tienes", "falta"), null, kioto);
    expect(a).toHaveLength(1);
    expect(a[0].texto).toBe("En Kioto se espera lluvia y no llevas nada que la aguante.");
    expect(a[0].loResuelve).toBe("Trench impermeable negro");
  });

  it("si el trench es suyo, no hay aviso", () => {
    expect(avisosDeLoQueLlevas(target([abrigo, botines, trench]), match("tienes", "tienes", "tienes"), null, kioto)).toEqual([]);
  });

  it("si sacó el trench del viaje, avisa sin proponerlo", () => {
    const a = avisosDeLoQueLlevas(target([abrigo, botines, trench]), match("tienes", "tienes", "falta"), { "fuera:2": "no lo necesito" } as never, kioto);
    expect(a[0].regla).toBe("sin-lluvia");
    expect(a[0].loResuelve).toBeNull();
  });

  it("trabajo informal: no le pide algo formal", () => {
    const ctx = { paradas: [{ lugar: "Lima", temp_c: 20 }], ocasiones: ["trabajo"], dias: 4 };
    const t = target([pieza("Playera negra", "top"), pieza("Jeans negros", "bottom"), botines]);
    const m = match("tienes", "tienes", "tienes");
    expect(avisosDeLoQueLlevas(t, m, null, ctx).map((x) => x.regla)).toEqual(["sin-formal"]);
    expect(avisosDeLoQueLlevas(t, m, null, { ...ctx, contexto: "mi trabajo es bastante informal" })).toEqual([]);
  });

  it("nunca dice 'la maleta': le habla a ella", () => {
    const frio = { paradas: [{ lugar: "Seúl", temp_c: 3, temp_min: 0, temp_max: 6, condition: "despejado" }], ocasiones: ["ciudad"], dias: 5 };
    const a = avisosDeLoQueLlevas(target([pieza("Suéter negro", "top"), botines]), match("tienes", "tienes"), null, frio);
    expect(a.length).toBeGreaterThan(0);
    for (const x of a) expect(x.texto).not.toMatch(/la maleta|no hay /);
  });
});
