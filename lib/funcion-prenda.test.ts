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
