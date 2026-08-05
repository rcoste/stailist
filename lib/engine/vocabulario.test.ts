import { describe, it, expect } from "vitest";
import { tipoDePrenda, tiposEnTexto } from "./vocabulario";
import { RECETAS_HOMBRE } from "./recetario";

describe("tipoDePrenda", () => {
  it("distingue la camisa oxford del zapato oxford", () => {
    // La misma palabra nombra dos prendas de zonas distintas. Si el orden de las
    // reglas se altera, este par truena — que es justo para lo que está.
    expect(tipoDePrenda("Camisa oxford azul")).toEqual({
      tipo: "camisa-oxford",
      zona: "torso",
      zonas: ["torso"],
    });
    expect(tipoDePrenda("Oxford negro de charol")).toEqual({
      tipo: "zapato-formal",
      zona: "pie",
      zonas: ["pie"],
    });
  });

  describe("prendas de cuerpo entero", () => {
    // El bug del par #11 del A/B: el motor armó "Traje marino de lana" MÁS
    // "Pantalón de vestir marino" — un traje puesto con el pantalón de otro.
    // Roberto: "si el traje azul marino y el pantalón son del mismo juego y que
    // no sean diferentes". Pasaba porque el traje se leía solo como capa, así
    // que la zona pierna seguía pareciendo vacía y el motor la rellenaba.
    it("el traje trae su pantalón", () => {
      expect(tipoDePrenda("Traje marino de lana")?.zonas).toEqual(["capa", "pierna"]);
      expect(tipoDePrenda("Esmoquin negro")?.zonas).toEqual(["capa", "pierna"]);
    });

    it("el vestido y el jumpsuit resuelven torso y pierna", () => {
      expect(tipoDePrenda("Vestido midi burdeos")?.zonas).toEqual(["torso", "pierna"]);
      expect(tipoDePrenda("Slip dress satinado negro")?.zonas).toEqual(["torso", "pierna"]);
      expect(tipoDePrenda("Jumpsuit elegante negro")?.zonas).toEqual(["torso", "pierna"]);
      expect(tipoDePrenda("Enterizo negro")?.zonas).toEqual(["torso", "pierna"]);
    });

    it("las PIEZAS de un traje siguen siendo piezas sueltas", () => {
      // "Saco de traje azul marino" y "Pantalón de traje" existen en el catálogo
      // como prendas independientes: si el patrón del traje se las llevara, un
      // saco solo pasaría a cubrir la pierna y volveríamos a armar looks sin
      // pantalón — el bug de v33 al revés.
      expect(tipoDePrenda("Saco de traje azul marino")?.zonas).toEqual(["capa"]);
      expect(tipoDePrenda("Pantalón de traje azul marino")?.zonas).toEqual(["pierna"]);
      expect(tipoDePrenda("Chaleco de traje gris")?.zonas).toEqual(["capa"]);
    });

    it("el traje de baño sigue siendo no-calle, no un traje", () => {
      expect(tipoDePrenda("Traje de baño negro")?.tipo).toBe("bano");
    });

    it("el moño de corbata no se confunde con el mono/jumpsuit", () => {
      // La ñ se descompone al normalizar, así que "moño" llega como "mono". En
      // ESTE catálogo esa cadena es la corbata; el jumpsuit siempre viene
      // nombrado.
      expect(tipoDePrenda("Moño negro")?.tipo).toBe("corbata");
    });
  });

  it("no confunde camisa con camiseta", () => {
    expect(tipoDePrenda("Camisa blanca")?.tipo).toBe("camisa");
    expect(tipoDePrenda("Camiseta blanca")?.tipo).toBe("camiseta");
  });

  it("el polo de punto es un polo, no un suéter", () => {
    expect(tipoDePrenda("Polo de punto oliva")?.tipo).toBe("polo");
    expect(tipoDePrenda("Suéter de punto grueso crema")?.tipo).toBe("sueter");
  });

  it("un short no es un pantalón", () => {
    // El largo de pierna es otra prenda, no un matiz: no vas a una junta en
    // bermudas. "pantalón corto" es la trampa del español.
    expect(tipoDePrenda("Bermuda caqui")?.tipo).toBe("short");
    expect(tipoDePrenda("Pantalón corto de lino")?.tipo).toBe("short");
    expect(tipoDePrenda("Pantalón de vestir marino")?.tipo).toBe("pantalon-vestir");
  });

  it("reconoce lo que NO es ropa de calle", () => {
    // Un "short de baño" caza el patrón de short: sin esto contaría como si
    // tuviera con qué armar un look de verano.
    expect(tipoDePrenda("Traje de baño marino")?.zona).toBe("no-calle");
    expect(tipoDePrenda("Short de playa")?.zona).toBe("no-calle");
    expect(tipoDePrenda("Shorts running")?.zona).toBe("no-calle");
  });

  it("normaliza acentos Y la ñ", () => {
    // La ñ se descompone igual que un acento: un patrón con ñ literal no casa
    // nunca. Este test existe porque el archivo se escribió con ese bug.
    expect(tipoDePrenda("Moño negro")?.tipo).toBe("corbata");
    expect(tipoDePrenda("Riñonera cruzada negra")?.tipo).toBe("bolsa");
    expect(tipoDePrenda("Sueter marino")?.tipo).toBe("sueter");
    expect(tipoDePrenda("Suéter marino")?.tipo).toBe("sueter");
  });

  it("devuelve null en vez de adivinar", () => {
    // Un tipo equivocado es peor que ninguno: quien llama trata null como
    // "no sé" y no inventa un hueco.
    expect(tipoDePrenda("")).toBeNull();
    expect(tipoDePrenda("Algo indescriptible")).toBeNull();
  });

  it("reconoce cada línea de las 10 cápsulas destiladas", () => {
    // El vocabulario existe para leer estas recetas. Si la destilación añade una
    // prenda que no está en el léxico, aquí truena antes de que la cobertura
    // reporte un hueco falso.
    const sinTipo = RECETAS_HOMBRE.flatMap((r) =>
      r.capsula.filter((l) => !tipoDePrenda(l)).map((l) => `${r.familia}: ${l}`)
    );
    expect(sinTipo).toEqual([]);
  });
});

describe("tiposEnTexto", () => {
  it("separa las prendas de una fórmula", () => {
    const tipos = tiposEnTexto(
      "polo tejido azul cielo + short chino caqui + tenis blanco"
    ).map((t) => t.tipo);
    expect(tipos).toEqual(["polo", "short", "tenis"]);
  });

  it("entiende las capas escritas con 'sobre'", () => {
    const tipos = tiposEnTexto(
      "suéter de ochos azul marino sobre camisa oxford celeste + chino crema"
    ).map((t) => t.tipo);
    expect(tipos).toContain("sueter-ochos");
    expect(tipos).toContain("camisa-oxford");
    expect(tipos).toContain("chino");
  });

  it("no repite un tipo que sale dos veces", () => {
    const tipos = tiposEnTexto("camiseta blanca + camiseta negra");
    expect(tipos).toHaveLength(1);
  });
});
