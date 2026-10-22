import { describe, it, expect } from "vitest";
import { agruparPiezas, grupoDePieza, resumenDeMaleta } from "@/lib/trip-grupos";

// LO QUE BLINDA: la maleta se lee por grupos y contra lo que el viaje pide
// ("6 de 10 camisas y playeras"), no revuelta.

const p = (category: string, nombre: string) => ({ category, nombre, tipo: "x" });
const maleta = [
  p("top", "Camisa blanca"),
  p("top", "Playera negra"),
  p("top", "Suéter de merino gris"),
  p("top", "Cárdigan marino"),
  p("bottom", "Jeans negros"),
  p("abrigo", "Chamarra acolchada marino"),
  p("saco", "Blazer marino"),
  p("calzado", "Botines Chelsea negros"),
  p("accesorio", "Gorro de punto negro"),
];

describe("grupoDePieza", () => {
  it("separa lo pegado a la piel de la capa media, y juntas abrigo y saco", () => {
    expect(maleta.map(grupoDePieza)).toEqual(["base", "base", "capas", "capas", "abajo", "abrigos", "abrigos", "calzado", "accesorios"]);
  });
});

describe("agruparPiezas", () => {
  it("en el orden de los grupos y sin grupos vacíos", () => {
    const g = agruparPiezas(maleta, (x) => x);
    expect(g.map((x) => x.id)).toEqual(["base", "capas", "abajo", "abrigos", "calzado", "accesorios"]);
    expect(g[0].items.map((x) => x.nombre)).toEqual(["Camisa blanca", "Playera negra"]);
  });
});

describe("resumenDeMaleta", () => {
  it("cuenta por grupo y dice cuántas pide el viaje donde hay piso", () => {
    const r = resumenDeMaleta(maleta, (x) => x, { base: 10, bottoms: 4, calzado: 2 });
    expect(r.find((x) => x.id === "base")).toMatchObject({ n: 2, pide: 10 });
    expect(r.find((x) => x.id === "abajo")).toMatchObject({ n: 1, pide: 4 });
    expect(r.find((x) => x.id === "abrigos")).toMatchObject({ n: 2, pide: null });
  });

  it("un grupo vacío que el viaje sí pide aparece (0 de 2 zapatos)", () => {
    const r = resumenDeMaleta([p("top", "Camisa blanca")], (x) => x, { base: 5, bottoms: 3, calzado: 2 });
    expect(r.find((x) => x.id === "calzado")).toMatchObject({ n: 0, pide: 2 });
  });
});
