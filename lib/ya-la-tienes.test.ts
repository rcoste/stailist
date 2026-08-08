import { describe, it, expect } from "vitest";
import { yaLaTienes, palabras, type PrendaExistente } from "./ya-la-tienes";

const existente = (o: Partial<PrendaExistente> & { id: string }): PrendaExistente => ({
  nombre: "Pantalón negro",
  categoria: "bottom",
  colorHex: "#1A1A1A",
  imagen: null,
  ...o,
});

describe("cuándo SÍ avisar", () => {
  it("la misma prenda subida dos veces", () => {
    const r = yaLaTienes(
      { nombre: "Pantalón negro", categoria: "bottom", colorHex: "#1A1A1A" },
      [existente({ id: "viejo" })]
    );
    expect(r?.id).toBe("viejo");
  });

  it("basta con que compartan una palabra con contenido", () => {
    // "Mocasines café de ante" contra "Mocasines de ante café": la visión no
    // ordena las palabras igual dos veces.
    const r = yaLaTienes(
      { nombre: "Mocasines café de ante", categoria: "calzado", colorHex: "#6B4F3A" },
      [existente({ id: "v", nombre: "Mocasines de ante café", categoria: "calzado", colorHex: "#6B4F3A" })]
    );
    expect(r?.id).toBe("v");
  });

  it("un material ausente NO cuenta como distinto", () => {
    // Media base no tiene material leído. Tratar el hueco como diferencia
    // apagaría el aviso justo en las prendas viejas, que son las que más se
    // repiten.
    const r = yaLaTienes(
      { nombre: "Pantalón negro", categoria: "bottom", colorHex: "#1A1A1A", material: "lana" },
      [existente({ id: "v", material: null })]
    );
    expect(r?.id).toBe("v");
  });

  it("devuelve la MÁS parecida, no una lista", () => {
    const r = yaLaTienes(
      { nombre: "Camisa blanca", categoria: "top", colorHex: "#F5F5F2" },
      [
        existente({ id: "lejos", nombre: "Camisa blanca", categoria: "top", colorHex: "#E8E4DA" }),
        existente({ id: "cerca", nombre: "Camisa blanca", categoria: "top", colorHex: "#F5F5F3" }),
      ]
    );
    expect(r?.id).toBe("cerca");
  });
});

describe("cuándo NO avisar — aquí está el valor", () => {
  it("los tres pantalones negros de Roberto son tres pantalones", () => {
    // Sintético, lana y algodón. Medido: sin esta comprobación el aviso daba
    // 12 falsas alarmas contra 10 aciertos, y un aviso que falla más de lo que
    // atina se aprende a ignorar.
    const r = yaLaTienes(
      { nombre: "Pantalón negro", categoria: "bottom", colorHex: "#1A1A1A", material: "algodón" },
      [existente({ id: "v", material: "lana" })]
    );
    expect(r).toBeNull();
  });

  it("un corte distinto los separa — pero SÓLO si el viejo es de fiar", () => {
    const nueva = {
      nombre: "Jeans azules",
      categoria: "bottom",
      colorHex: "#2C3E50",
      corte: "holgado",
    };
    const vieja = { id: "v", nombre: "Jeans azules", colorHex: "#2C3E50", corte: "entallado" };
    // De su foto o confirmado a mano: separa.
    expect(yaLaTienes(nueva, [existente({ ...vieja, corteDeFiar: true })])).toBeNull();
    // Copiado del arquetipo: NO puede callar el aviso. Se vio en vivo — una
    // camisa blanca de vestir no avisó porque la "Camisa blanca" del clóset
    // traía corte "recto" que nadie confirmó. 491 de 670 prendas asumidas lo
    // traen; dejar que un dato inventado silencie el aviso es el mismo error
    // de siempre con otro disfraz.
    expect(yaLaTienes(nueva, [existente({ ...vieja, corteDeFiar: false })])?.id).toBe("v");
  });

  it("otra categoría no se compara, aunque el nombre coincida", () => {
    // "Negro" y "negro": un cinturón negro no es un pantalón negro.
    const r = yaLaTienes(
      { nombre: "Cinturón negro", categoria: "accesorio", colorHex: "#1A1A1A" },
      [existente({ id: "v" })]
    );
    expect(r).toBeNull();
  });

  it("el mismo color sin nombre en común no basta", () => {
    // Un clóset tiene decenas de prendas negras.
    const r = yaLaTienes(
      { nombre: "Suéter negro", categoria: "bottom", colorHex: "#1A1A1A" },
      [existente({ id: "v", nombre: "Pantalón negro" })]
    );
    expect(r).toBeNull();
  });

  it("el COLOR en el nombre no cuenta como parecido", () => {
    // Este caso lo destapó el test de arriba, escrito mal a propósito de otra
    // cosa: "Camisa negra" y "Camiseta negra" comparten la palabra "negra",
    // son las dos `top` y las dos negras. El color ya se compara aparte con
    // matemática de verdad; dejar que además cuente como identidad es medirlo
    // dos veces y encima mal.
    const r = yaLaTienes(
      { nombre: "Camisa negra", categoria: "top", colorHex: "#1A1A1A" },
      [existente({ id: "v", nombre: "Camiseta negra", categoria: "top" })]
    );
    expect(r).toBeNull();
  });

  it("marino no es negro, aunque los dos sean 'Pantalón'", () => {
    // El fallo real, cazado en el navegador y no por la calibración: unos
    // "Pantalón chino azul marino" avisaban contra un "Pantalón negro". Marino
    // y negro distan 0.071 y dos lecturas de la misma prenda distan 0.010 — el
    // umbral estaba en 0.08, o sea por encima de la diferencia entre dos
    // colores que nadie confunde.
    const r = yaLaTienes(
      { nombre: "Pantalón chino azul marino", categoria: "bottom", colorHex: "#22304C" },
      [existente({ id: "v", nombre: "Pantalón negro", colorHex: "#1A1A1A" })]
    );
    expect(r).toBeNull();
  });

  it("pero dos lecturas del mismo negro sí se reconocen", () => {
    const r = yaLaTienes(
      { nombre: "Pantalón negro", categoria: "bottom", colorHex: "#1C1C1E" },
      [existente({ id: "v", colorHex: "#1A1A1A" })]
    );
    expect(r?.id).toBe("v");
  });

  it("sin color o sin categoría no se aventura", () => {
    expect(
      yaLaTienes({ nombre: "Pantalón negro", categoria: "bottom", colorHex: null }, [existente({ id: "v" })])
    ).toBeNull();
    expect(
      yaLaTienes({ nombre: "Pantalón negro", categoria: null, colorHex: "#1A1A1A" }, [existente({ id: "v" })])
    ).toBeNull();
  });
});

describe("las palabras que cuentan", () => {
  it("descarta las que no distinguen nada", () => {
    // Sin esto, "camisa DE vestir" y "pantalón DE lino" comparten "de" y todo
    // se parecería con todo.
    expect([...palabras("Camisa de vestir")]).toEqual(["camisa", "vestir"]);
  });

  it("ignora tildes y mayúsculas", () => {
    expect(palabras("Pantalón NEGRO").has("pantalon")).toBe(true);
  });
});
