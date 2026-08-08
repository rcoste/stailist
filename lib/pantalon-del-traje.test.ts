import { describe, it, expect } from "vitest";
import { nombrePantalon, attrsDelPantalon } from "./pantalon-del-traje";

describe("el nombre del pantalón sale del saco", () => {
  it("los cuatro casos reales de la base", () => {
    expect(nombrePantalon("Saco de traje marino de lana")).toBe(
      "Pantalón de traje marino de lana"
    );
    expect(nombrePantalon("Saco de traje de lana gris carbón")).toBe(
      "Pantalón de traje de lana gris carbón"
    );
    expect(nombrePantalon("Saco de traje gris carbón")).toBe(
      "Pantalón de traje gris carbón"
    );
  });

  it("también con los otros nombres que usa la visión", () => {
    expect(nombrePantalon("Blazer marino")).toBe("Pantalón de traje marino");
    expect(nombrePantalon("Saco azul de lana")).toBe("Pantalón de traje azul de lana");
  });

  it("no deja un nombre a medias si no queda nada que describir", () => {
    // "Pantalón de traje " con un espacio colgando se ve a un descuido.
    expect(nombrePantalon("Saco")).toBe("Pantalón de traje");
    expect(nombrePantalon("   ")).toBe("Pantalón de traje");
  });
});

describe("qué se hereda y qué se afirma", () => {
  it("color, material y temporada vienen del saco fotografiado", () => {
    const a = attrsDelPantalon({
      nombre: "Saco de traje marino de lana",
      color: "azul marino",
      colorHex: "#1F2A44",
      material: "lana",
      temporada: "frio",
    });
    expect(a).toMatchObject({
      nombre: "Pantalón de traje marino de lana",
      categoria: "bottom",
      color_hex: "#1F2A44",
      material: "lana",
      temporada: "frio",
      formalidad: "formal",
    });
  });

  it("lo que el saco no tiene, no se rellena", () => {
    // Un material inventado alimenta las reglas de clima. Mejor sin dato: el
    // motor ya sabe tratar el hueco, no sabe tratar una mentira.
    const a = attrsDelPantalon({ nombre: "Saco de traje gris" });
    expect(a).not.toHaveProperty("material");
    expect(a).not.toHaveProperty("color_hex");
    // La temporada sí cae a un default neutro: es un enum y "todo-el-año" no
    // afirma nada que estorbe.
    expect(a.temporada).toBe("todo-el-año");
  });
});
