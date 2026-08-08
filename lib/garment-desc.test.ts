import { describe, it, expect } from "vitest";
import { garmentDescPlain, garmentRenderDesc } from "@/lib/garment-desc";

// La descripción de una prenda tiene DOS consumidores con necesidades opuestas
// y por eso se partió en dos funciones. Lo que estos tests fijan es el contrato
// entre ellas, que es donde un refactor se rompe en silencio: si `plain`
// empezara a traer la orden de renderizar, el prompt de imagen→imagen quedaría
// con dos imperativos peleando y nadie lo notaría hasta ver renders raros.

describe("garmentDescPlain — describe, no ordena", () => {
  it("no lleva ninguna orden de renderizar", () => {
    const con = garmentDescPlain({ nombre: "Saco de traje marino", color: "azul marino" });
    const sin = garmentDescPlain({
      nombre: "x",
      visual: "chaqueta bomber de nylon negro mate, cierre metálico",
    });
    expect(con.toLowerCase()).not.toContain("renderiza");
    expect(sin.toLowerCase()).not.toContain("renderiza");
  });

  it("la descripción del estilista manda sobre los atributos sueltos", () => {
    const d = garmentDescPlain({
      nombre: "Chamarra negra",
      color: "negro",
      corte: "holgado",
      visual: "bomber de nylon negro mate, puños acanalados",
    });
    expect(d).toBe("bomber de nylon negro mate, puños acanalados");
  });

  it("mete el color sólo cuando el nombre no lo trae ya", () => {
    // Duplicar el color es lo que pasaba al pasarlo además por separado al
    // prompt de extracción: "…negros, en color negro".
    expect(garmentDescPlain({ nombre: "Tenis blancos", color: "blanco" })).not.toContain(
      "en color"
    );
    expect(garmentDescPlain({ nombre: "Tenis", color: "blanco" })).toContain("en color blanco");
  });
});

describe("garmentRenderDesc — describe Y ordena", () => {
  it("conserva la orden que texto→imagen necesita", () => {
    // Sin la orden, el modelo recibe una descripción suelta y no una petición:
    // ahí el texto es TODO lo que tiene.
    expect(garmentRenderDesc({ nombre: "Camisa blanca" }).toLowerCase()).toContain("renderiza");
  });

  it("empieza por la misma descripción que devuelve plain", () => {
    const g = { nombre: "Mocasines café", color: "café", categoria: "calzado" };
    expect(garmentRenderDesc(g).startsWith(garmentDescPlain(g))).toBe(true);
  });

  it("insiste en 'este TIPO de prenda' sólo cuando no hay descripción visual", () => {
    // El matiz importa: con la descripción del estilista se habla de ESTA
    // prenda; sin ella lo único que se tiene es un nombre, y ahí hay que pedir
    // explícitamente que no traiga otra prenda distinta.
    expect(garmentRenderDesc({ nombre: "Jeans rectos azules" })).toContain("este tipo de prenda");
    expect(garmentRenderDesc({ nombre: "x", visual: "jeans rectos de mezclilla índigo" })).toContain(
      "esta prenda"
    );
  });
});
