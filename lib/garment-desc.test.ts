import { describe, it, expect } from "vitest";
import { descripcionObsoleta, garmentDescPlain, garmentRenderDesc } from "@/lib/garment-desc";
import { buildImagePrompt } from "@/lib/archetype-image";

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

// LA TRAMPA QUE SE ARMÓ SOLA el día que `visual` empezó a guardarse: la
// descripción le gana al nombre en el generador, y la ficha ofrece rehacer la
// imagen justo después de renombrar. Sin esta regla, corriges el nombre,
// aceptas la oferta, y te devuelve la misma prenda equivocada.
describe("descripcionObsoleta — corregir la prenda invalida su descripción", () => {
  it("el caso real: 'Blazer marrón de lana' → 'Abrigo de lana marrón'", () => {
    expect(
      descripcionObsoleta({
        nombreViejo: "Blazer marrón de lana",
        nombreNuevo: "Abrigo de lana marrón",
      })
    ).toBe(true);
  });

  it("cambiar el color también la invalida", () => {
    // La descripción lleva el color dentro ("bomber de nylon NEGRO mate") y le
    // ganaría al color corregido.
    expect(descripcionObsoleta({ hexViejo: "#1B1B1B", hexNuevo: "#1F3A5F" })).toBe(true);
  });

  it("guardar sin cambiar nada NO la tira", () => {
    // Lo importante: abrir la ficha, tocar la formalidad y guardar no puede
    // costarte la descripción de la prenda.
    expect(
      descripcionObsoleta({
        nombreViejo: "Abrigo de lana marrón",
        nombreNuevo: "Abrigo de lana marrón",
        hexViejo: "#5B4636",
        hexNuevo: "#5B4636",
      })
    ).toBe(false);
  });

  it("un campo que no llega no cuenta como cambio", () => {
    // updateItemAttrs puede recibir un patch parcial: sin nombre nuevo, el
    // nombre no cambió — no es que haya cambiado a vacío.
    expect(descripcionObsoleta({ nombreViejo: "Camisa blanca" })).toBe(false);
    expect(descripcionObsoleta({ hexViejo: "#FFFFFF" })).toBe(false);
  });

  it("mayúsculas y espacios no son un cambio", () => {
    expect(
      descripcionObsoleta({ nombreViejo: "Camisa blanca", nombreNuevo: "  Camisa Blanca " })
    ).toBe(false);
    expect(descripcionObsoleta({ hexViejo: "#1b1b1b", hexNuevo: "#1B1B1B" })).toBe(false);
  });
});

describe("patrón y material — lo que el generador de imágenes nunca supo", () => {
  // EL CASO REAL (Roberto, veredicto de 3.7): "los pantalones se renderían como
  // con cuadros y no son así". La prenda tiene patron: liso en la base; la
  // descripción que llegaba al modelo no lo mencionaba, y el modelo rellenó con
  // un príncipe de Gales.
  it("dice LISO explícitamente para que el modelo no invente un estampado", () => {
    const d = garmentDescPlain({
      nombre: "Pantalón de vestir gris",
      categoria: "bottom",
      formalidad: "formal",
      patron: "liso",
    });
    expect(d).toContain("SIN estampado");
  });

  it("un patrón real sí viaja", () => {
    const d = garmentDescPlain({ nombre: "Camisa", patron: "rayas" });
    expect(d).toContain("patrón rayas");
  });

  it("el material también, que no se dibuja igual la lana que el lino", () => {
    const d = garmentDescPlain({ nombre: "Saco de traje gris", material: "lana fría" });
    expect(d).toContain("lana fría");
  });

  // Sin patrón declarado NO se inventa una afirmación: las 447 prendas sin ese
  // dato no deben empezar a decir "liso" por nuestra cuenta.
  it("sin patrón declarado, no afirma nada", () => {
    const d = garmentDescPlain({ nombre: "Camisa blanca" });
    expect(d).not.toContain("SIN estampado");
    expect(d).not.toContain("patrón");
  });

  // La Capa 2 sigue mandando: si el estilista escribió la descripción visual,
  // esa gana entera y no se le encima nada.
  it("la descripción del estilista sigue ganando", () => {
    const d = garmentDescPlain({
      nombre: "Pantalón",
      patron: "liso",
      visual: "chino carbón de algodón, corte recto",
    });
    expect(d).toBe("chino carbón de algodón, corte recto");
  });
});

describe("el prompt del flat-lay prohíbe lo que de verdad se colaba", () => {
  it("nombra el pañuelo de bolsillo y los patrones inventados", () => {
    const p = buildImagePrompt("Saco de traje gris", "flat", "hombre");
    expect(p).toContain("no pocket squares");
    expect(p).toContain("do NOT add any pattern");
  });

  // "slightly styled" era la puerta abierta al estilismo que nadie pidió.
  it("ya no pide la prenda 'slightly styled'", () => {
    expect(buildImagePrompt("Camisa blanca", "flat")).not.toContain("slightly styled");
  });
});
