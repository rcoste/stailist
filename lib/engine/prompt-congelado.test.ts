import { describe, it, expect } from "vitest";
import { idsDelMensaje } from "./prompt-congelado";

// Un congelado que no se pueda EJECUTAR es papel. Lo que estos tests protegen
// es la parte que lo hace ejecutable: reconstruir el enum del schema desde el
// propio mensaje, sin depender de un clóset que pudo cambiar.

describe("idsDelMensaje", () => {
  it("saca los ids del clóset tal como los escribe describeItem", () => {
    const texto = [
      "Su clóset:",
      "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b: Camisa oxford blanca [top]",
      "7e8d9c0b-1a2b-4c3d-9e8f-7a6b5c4d3e2f: Chinos carbón [bottom]",
    ].join("\n");
    expect(idsDelMensaje(texto)).toEqual([
      "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b",
      "7e8d9c0b-1a2b-4c3d-9e8f-7a6b5c4d3e2f",
    ]);
  });

  it("no repite un id que aparece dos veces (ancla, historial)", () => {
    const id = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";
    expect(idsDelMensaje(`${id}: algo\nANCLA: ${id}`)).toEqual([id]);
  });

  it("un mensaje sin clóset no inventa ids", () => {
    expect(idsDelMensaje("Ocasión: diario. Clima: 18°C.")).toEqual([]);
  });
});
