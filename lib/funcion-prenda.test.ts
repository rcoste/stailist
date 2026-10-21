import { describe, it, expect } from "vitest";
import { funcionDe, sirveComoSustituto } from "@/lib/funcion-prenda";

describe("funcionDe", () => {
  it("reconoce las piezas que existen para una tarea", () => {
    expect(funcionDe("Trench negro impermeable")).toBe("lluvia");
    expect(funcionDe("Traje de baño negro")).toBe("nadar");
    expect(funcionDe("Chamarra acolchada negra")).toBe("frio-extremo");
    expect(funcionDe("Parka impermeable")).toBe("lluvia");
    expect(funcionDe("Playera térmica")).toBe("frio-extremo");
  });
  it("la ropa intercambiable no tiene función", () => {
    expect(funcionDe("Blazer estructurado negro")).toBeNull();
    expect(funcionDe("Shorts de mezclilla")).toBeNull();
    expect(funcionDe("Abrigo largo de lana negro")).toBeNull();
  });
});

describe("sirveComoSustituto", () => {
  const trench = { nombre: "Trench negro impermeable", tipo: "trench", category: "abrigo" };
  it("el caso real: un blazer no sustituye un trench impermeable", () => {
    expect(sirveComoSustituto(trench, { nombre: "Blazer estructurado negro", category: "saco" })).toBe(false);
  });
  it("aunque estuviera en la misma categoría, sin la función no sirve", () => {
    expect(sirveComoSustituto(trench, { nombre: "Abrigo de piel sintética blanco", category: "abrigo" })).toBe(false);
  });
  it("otra prenda para lluvia sí", () => {
    expect(sirveComoSustituto(trench, { nombre: "Gabardina beige", category: "abrigo" })).toBe(true);
  });
  it("unos shorts no sustituyen un traje de baño", () => {
    const tb = { nombre: "Traje de baño negro", tipo: "traje-de-bano", category: "vestido" };
    expect(sirveComoSustituto(tb, { nombre: "Shorts de mezclilla", category: "bottom" })).toBe(false);
    expect(sirveComoSustituto(tb, { nombre: "Vestido corto negro", category: "vestido" })).toBe(false);
  });
  it("sin función, manda sólo la categoría; y un trench sí puede cubrir un abrigo de lana", () => {
    const lana = { nombre: "Abrigo largo de lana negro", tipo: "abrigo-largo", category: "abrigo" };
    expect(sirveComoSustituto(lana, { nombre: "Trench beige", category: "abrigo" })).toBe(true);
    expect(sirveComoSustituto(lana, { nombre: "Blazer negro", category: "saco" })).toBe(false);
  });
});

describe("candidatasPosibles (el buscador de sustitutos del viaje)", async () => {
  const { candidatasPosibles } = await import("@/lib/engine/trip-substitutes");
  const closet = [
    { nombre: "Medias opacas negras", category: "accesorio" },
    { nombre: "Bufanda de lana vino", category: "accesorio" },
    { nombre: "Cinturón de piel negro con hebilla plateada", category: "accesorio" },
    { nombre: "Blazer estructurado negro", category: "saco" },
  ];
  it("para un cinturón sólo ve cinturones, no medias ni bufandas", () => {
    const r = candidatasPosibles({ nombre: "Cinturón negro con hebilla dorada", tipo: "cinturon", category: "accesorio" }, closet);
    expect(r.map((c) => c.nombre)).toEqual(["Cinturón de piel negro con hebilla plateada"]);
  });
  it("para el trench impermeable no ve nada (y no se llama a la IA)", () => {
    expect(candidatasPosibles({ nombre: "Trench negro impermeable", tipo: "trench", category: "abrigo" }, closet)).toEqual([]);
  });
});

describe("'no lo necesito en este viaje' saca la pieza de todo", async () => {
  const { capsuleRows, fueraKey } = await import("@/lib/capsule");
  const { empacablesDelViaje } = await import("@/lib/trip-maleta");
  const item = (nombre: string) => ({ tipo: "x", nombre, porque: "", category: "accesorio", prioridad: 1, temporada: "todo-el-año", formalidad: "casual", colorFamilia: "negro" }) as never;
  const target = { version: 2, items: [item("Cinturón negro"), item("Bolsa negra")] } as never;
  const match = { signature: "s", entries: [{ status: "tienes", by: "Mi cinturón" }, { status: "tienes", by: "Mi bolsa" }] } as never;
  it("queda retirada y no se empaca aunque algo suyo la cubra", () => {
    const overrides = { [fueraKey(0)]: "no-va-clima" } as never;
    expect(capsuleRows(target, match, overrides)[0].dismissed).toBe(true);
    expect(empacablesDelViaje(target, match, overrides).map((p) => p.nombre)).toEqual(["Mi bolsa"]);
  });
});

// 2026-10-19: la foto guardó su "Suéter de punto verde" como abrigo y la maleta
// pedía un "Suéter de punto esmeralda" como top: no aparecía para elegirlo.
describe("un suéter es un suéter entre top y abrigo", () => {
  const falta = { nombre: "Suéter de punto esmeralda", tipo: "sueter", category: "top" };
  it("su suéter guardado como abrigo sí cubre el suéter top", () => {
    expect(sirveComoSustituto(falta, { nombre: "Suéter de punto verde", category: "abrigo" })).toBe(true);
  });
  it("y al revés: un cuello alto top cubre un cárdigan abrigo", () => {
    expect(sirveComoSustituto({ nombre: "Cárdigan largo negro", category: "abrigo" }, { nombre: "Cuello alto negro", category: "top" })).toBe(true);
  });
  it("un abrigo de verdad no cubre un suéter", () => {
    expect(sirveComoSustituto(falta, { nombre: "Abrigo largo negro", category: "abrigo" })).toBe(false);
  });
  it("un suéter no cubre una blusa", () => {
    expect(sirveComoSustituto({ nombre: "Blusa de satén rubí", category: "top" }, { nombre: "Suéter de punto morado", category: "abrigo" })).toBe(false);
  });
});

// Su maleta de Mineápolis (2026-10-21): para "Camisa blanca de franela ligera"
// (frío, mañanas de 8 °C) el duelo le ofreció su "Camisa de lino blanca".
describe("la temporada también manda en los sustitutos", async () => {
  const { candidatasPosibles } = await import("@/lib/engine/trip-substitutes");
  const closet = [
    { nombre: "Camisa de lino blanca", category: "top", temporada: "calor" },
    { nombre: "Camisa oxford blanca", category: "top", temporada: "todo-el-año" },
    { nombre: "Camisa de franela gris", category: "top", temporada: "frio" },
    { nombre: "Camisa blanca", category: "top", temporada: null, material: "lino" },
  ];
  const franela = { nombre: "Camisa blanca de franela ligera", tipo: "camisa", category: "top" as const, temporada: "frio" };

  it("una pieza de frío no la cubre una de calor ni una de lino", () => {
    expect(candidatasPosibles(franela, closet).map((c) => c.nombre)).toEqual(["Camisa oxford blanca", "Camisa de franela gris"]);
  });

  it("si la pieza pide lino, el lino sí entra", () => {
    const lino = { nombre: "Camisa de lino blanca", tipo: "camisa", category: "top" as const, temporada: "frio" };
    expect(candidatasPosibles(lino, closet).map((c) => c.nombre)).toContain("Camisa blanca");
  });

  it("una pieza de calor no la cubre una de frío", () => {
    const calor = { nombre: "Camisa blanca de manga larga", tipo: "camisa", category: "top" as const, temporada: "calor" };
    expect(candidatasPosibles(calor, closet).map((c) => c.nombre)).not.toContain("Camisa de franela gris");
  });

  it("sin temporada en la pieza no bloquea nada", () => {
    expect(candidatasPosibles({ nombre: "Camisa blanca", tipo: "camisa", category: "top" }, closet)).toHaveLength(4);
  });
});
