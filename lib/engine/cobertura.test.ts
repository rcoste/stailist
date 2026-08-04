import { describe, it, expect } from "vitest";
import { coberturaDeReceta, bloqueCobertura } from "./cobertura";
import { RECETAS_HOMBRE } from "./recetario";
import type { EngineItem } from "./prompt";

const receta = (familia: string) => RECETAS_HOMBRE.find((r) => r.familia === familia)!;
const closet = (...nombres: string[]): EngineItem[] =>
  nombres.map((nombre, i) => ({ id: `i${i}`, attrs: { nombre } }));

describe("coberturaDeReceta", () => {
  it("el uniforme preppy de manual cuenta como preppy", () => {
    // El caso que tumbó la primera versión de este archivo: polo + chino +
    // mocasín ES preppy, aunque no haya rugby ni náutico. Si esto vuelve a dar
    // "ajustado", la métrica volvió a leer la receta como reglamento.
    const c = coberturaDeReceta(
      receta("preppy"),
      closet("Polo marino", "Chinos beige", "Mocasines café")
    );
    expect(c.veredicto).toBe("da");
    expect(c.huecos).toEqual([]);
  });

  it("detecta el clóset que no da para el estilo", () => {
    // Sudadera, joggers y botas: ni torso, ni pierna, ni calzado del vocabulario
    // preppy. Ése es el hueco que esta pieza existe para cazar.
    const c = coberturaDeReceta(
      receta("preppy"),
      closet("Sudadera crema", "Joggers deportivos", "Botas negras")
    );
    expect(c.veredicto).toBe("no-da");
    expect(c.huecos).toContain("pierna");
  });

  it("un hueco solo es 'ajustado', no 'no-da'", () => {
    const c = coberturaDeReceta(
      receta("preppy"),
      closet("Polo marino", "Chinos beige", "Botas negras")
    );
    expect(c.veredicto).toBe("ajustado");
    expect(c.huecos).toEqual(["pie"]);
  });

  it("LÍMITE CONOCIDO: no distingue el matiz dentro del tipo", () => {
    // Unos tenis skate negros cuentan como calzado preppy porque su receta usa
    // "tenis blanco liso" y el vocabulario trabaja con tipos, no con colores.
    // Está documentado a propósito: quien caza ese matiz es el juez con los
    // "evitar" de la receta. Si algún día esto empieza a distinguirlo, será una
    // decisión, no un accidente — y este test lo hará visible.
    const c = coberturaDeReceta(
      receta("preppy"),
      closet("Polo marino", "Chinos beige", "Tenis skate negros")
    );
    expect(c.veredicto).toBe("da");
  });

  it("en frío exige capa; en templado no", () => {
    const sinAbrigo = closet("Polo marino", "Chinos beige", "Mocasines café");
    expect(coberturaDeReceta(receta("preppy"), sinAbrigo, "templado").veredicto).toBe("da");
    expect(coberturaDeReceta(receta("preppy"), sinAbrigo, "frio").huecos).toEqual(["capa"]);
  });

  it("ignora lo que no es ropa de calle", () => {
    // Un traje de baño no cubre la zona de la pierna aunque el catálogo lo
    // liste como prenda: si contara, la app le diría que ya tiene con qué.
    const c = coberturaDeReceta(
      receta("resort-boho"),
      closet("Camisa de lino blanca", "Traje de baño marino", "Sandalias de cuero")
    );
    expect(c.huecos).toContain("pierna");
  });

  it("sugiere la prenda que más resuelve, no la más exótica", () => {
    // Al preppy le falta el torso: el consejo útil es una prenda que exista y
    // le sirva para varios estilos, no un rugby de rayas anchas vino y marino
    // —que además ni está en nuestra biblioteca—.
    const c = coberturaDeReceta(
      receta("preppy"),
      closet("Chinos beige", "Mocasines café")
    );
    expect(c.huecos).toEqual(["torso"]);
    expect(c.sugerencias.join(" ").toLowerCase()).not.toContain("rugby");
  });

  it("ninguna familia se queda sin vocabulario de las tres zonas", () => {
    // Si una receta no nombra prendas de una zona, la cobertura marcaría un
    // hueco que la persona no puede tapar: le echaría la culpa de algo que la
    // receta nunca definió. Pasó con la capa del preppy.
    for (const r of RECETAS_HOMBRE) {
      const todo = coberturaDeReceta(
        r,
        closet(...r.capsula, ...r.formulas.flatMap((f) => f.look.split(" + ")))
      );
      expect(todo.huecos, `${r.familia} no cubre sus propias prendas`).toEqual([]);
    }
  });
});

describe("bloqueCobertura", () => {
  it("no dice nada cuando el clóset da", () => {
    const c = coberturaDeReceta(
      receta("preppy"),
      closet("Polo marino", "Chinos beige", "Mocasines café")
    );
    expect(bloqueCobertura(c)).toBe("");
  });

  it("cuando no da, pide honestidad y prohíbe bautizar el look con el estilo", () => {
    const c = coberturaDeReceta(receta("preppy"), closet("Camiseta negra"));
    const b = bloqueCobertura(c);
    expect(b).toContain("NO DA");
    expect(b.toLowerCase()).toContain("no fuerces");
    expect(b.toLowerCase()).toContain("lo más cercano");
  });
});
