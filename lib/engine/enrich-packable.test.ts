import { describe, expect, it } from "vitest";
import { enrichPackable, resolveRealAttrs, type RealAttrs } from "./enrich-packable";
import type { PackableItem } from "./trip-outfits";

const byName = (attrs: RealAttrs[]) => {
  const m = new Map<string, RealAttrs>();
  for (const a of attrs) {
    if (a.nombre) {
      m.set(a.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(), a);
    }
  }
  return m;
};

const pieza = (n: number, nombre: string): PackableItem => ({
  n,
  nombre,
  category: "top",
  color: "marino", // colorFamilia ideal (lo que había antes del enriquecimiento)
  formalidad: "casual",
});

describe("resolveRealAttrs", () => {
  it("resuelve por match exacto normalizado (acentos y mayúsculas)", () => {
    const m = byName([{ nombre: "Camisa Añil", color: "azul" }]);
    expect(resolveRealAttrs("camisa anil", m)?.color).toBe("azul");
  });

  it("cae al fallback por substring cuando hay UN solo candidato", () => {
    const m = byName([
      { nombre: "Camisa blanca de lino", color: "blanco" },
      { nombre: "Pantalón gris", color: "gris" },
    ]);
    expect(resolveRealAttrs("camisa blanca", m)?.color).toBe("blanco");
  });

  it("NO adivina cuando el substring es ambiguo (dos candidatos)", () => {
    const m = byName([
      { nombre: "Camisa blanca de lino", color: "blanco" },
      { nombre: "Camisa blanca oxford", color: "crudo" },
    ]);
    expect(resolveRealAttrs("camisa blanca", m)).toBeNull();
  });

  it("devuelve null sin match y con nombre vacío", () => {
    const m = byName([{ nombre: "Suéter verde", color: "verde" }]);
    expect(resolveRealAttrs("chamarra negra", m)).toBeNull();
    expect(resolveRealAttrs("   ", m)).toBeNull();
  });
});

describe("enrichPackable", () => {
  it("copia color/hex/temporada/material/patron de la prenda real", () => {
    const p = [pieza(0, "Blazer estructurado")];
    enrichPackable(p, [
      {
        nombre: "Blazer estructurado",
        color: "negro",
        color_hex: "#111111",
        temporada: "frio",
        material: "lana",
        patron: "liso",
      },
    ]);
    expect(p[0].color).toBe("negro"); // el color REAL pisa el ideal
    expect(p[0].hex).toBe("#111111");
    expect(p[0].temporada).toBe("frio");
    expect(p[0].material).toBe("lana");
    expect(p[0].patron).toBe("liso");
  });

  it("deja la pieza intacta si el nombre no resuelve", () => {
    const p = [pieza(0, "Prenda inexistente")];
    enrichPackable(p, [{ nombre: "Otra cosa", color: "rojo" }]);
    expect(p[0].color).toBe("marino");
    expect(p[0].hex).toBeUndefined();
  });

  it("no pisa el color si la prenda real no lo trae, pero sí llena el resto", () => {
    const p = [pieza(0, "Jeans rectos")];
    enrichPackable(p, [{ nombre: "Jeans rectos", color_hex: "#27425F" }]);
    expect(p[0].color).toBe("marino"); // conserva el ideal
    expect(p[0].hex).toBe("#27425F");
    expect(p[0].material).toBeNull(); // prenda vieja sin atributos ricos
  });

  it("ignora prendas del clóset sin nombre", () => {
    const p = [pieza(0, "Camisa azul")];
    enrichPackable(p, [{ color: "azul" }, { nombre: "Camisa azul", color: "azul" }]);
    expect(p[0].color).toBe("azul");
  });

  it("NO enriquece con nombres duplicados exactos (arquetipo + foto iguales)", () => {
    const p = [pieza(0, "Camisa blanca")];
    enrichPackable(p, [
      { nombre: "Camisa blanca", color: "blanco", color_hex: "#FFFFFF" },
      { nombre: "Camisa blanca", color: "crudo", color_hex: "#F5F0E8" },
    ]);
    // Adivinar entre dos devolvería los attrs de la prenda equivocada:
    // mejor dejar la pieza con sus datos ideales.
    expect(p[0].color).toBe("marino");
    expect(p[0].hex).toBeUndefined();
  });

  it("sanea attrs corruptos en el punto de consumo (hex inválido, textos largos, patrón desconocido)", () => {
    const p = [pieza(0, "Suéter gris")];
    enrichPackable(p, [
      {
        nombre: "Suéter gris",
        color: "g".repeat(200), // texto largo de un cliente manipulado
        color_hex: "javascript:alert(1)", // no es un hex
        material: "  lana\nmerino  ",
        patron: "invento-raro",
        color_secundario: "blanco",
      },
    ]);
    expect(p[0].color.length).toBeLessThanOrEqual(30); // truncado, no párrafos al prompt
    expect(p[0].hex).toBeNull(); // hex inválido no pasa
    expect(p[0].material).toBe("lana merino"); // normalizado a una línea
    expect(p[0].patron).toBeNull(); // fuera del vocabulario
    expect(p[0].color_secundario).toBe("blanco");
  });
});
