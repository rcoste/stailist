import { describe, it, expect } from "vitest";
import {
  briefParaRubrica,
  lookParaRubrica,
  SYSTEM_RUBRICA,
  SCHEMA_RUBRICA,
} from "./rubrica";

// La rúbrica nace de las 148 marcas y 32 comentarios de Roberto. Estos tests
// fijan que las decisiones de diseño que salieron de ahí no se pierdan en una
// edición del prompt.

describe("briefParaRubrica — el juez recibe el MISMO contexto que el motor", () => {
  it("un evento concreto llega con sus palabras y su formalidad", () => {
    // "Evento es algo muy ambiguo — cuando hay cosas más específicas es más
    // fácil decir si estuvo bien" (Roberto). Sin plan+formalidad, el juez
    // tendría su mismo problema.
    const t = briefParaRubrica({
      objective: "evento",
      plan: "una boda de noche, en salón",
      formality: "formal",
      momento: "noche",
      weather: { temp_c: 18, condition: "nublado" },
    });
    expect(t).toContain("una boda de noche, en salón");
    expect(t).toContain("formal");
    expect(t).toContain("de noche");
  });

  it("la temperatura va TRADUCIDA, no solo el número", () => {
    const t = briefParaRubrica({
      objective: "diario",
      weather: { temp_c: 18, condition: "nublado" },
    });
    expect(t).toContain("18°C");
    expect(t).toContain("TEMPLADO");
  });

  it("la lluvia distingue con y sin paraguas — y el calzado exige en ambos", () => {
    const base = {
      objective: "diario",
      weather: { temp_c: 17, condition: "lluvia" },
    };
    const sin = briefParaRubrica({ ...base, paraguas: false });
    const con = briefParaRubrica({ ...base, paraguas: true });
    expect(sin).toContain("NO lleva paraguas");
    expect(con).toContain("Lleva paraguas");
    // El paraguas tapa el torso, no los pies: el calzado se exige en los dos.
    for (const t of [sin, con]) expect(t.toLowerCase()).toContain("calzado");
  });
});

describe("lookParaRubrica", () => {
  it("las prendas van con color y material — el criterio de lluvia es el material", () => {
    const t = lookParaRubrica({
      nombre: "Gris en capas",
      explicacion: "x",
      tip: null,
      prendas: [{ nombre: "Tenis de lona blancos", color: "blanco", material: "lona" }],
    });
    expect(t).toContain("Tenis de lona blancos (blanco, lona)");
    expect(t).toContain("Sin tip de styling");
  });
});

describe("el sistema de la rúbrica — anclas que no deben perderse", () => {
  it("el 3 del wow es la etiqueta de Roberto: correcto pero plano", () => {
    expect(SYSTEM_RUBRICA).toContain("CORRECTO PERO PLANO");
  });

  it("la prosa bonita sin gesto no compra wow", () => {
    expect(SYSTEM_RUBRICA.toLowerCase()).toContain("la prosa bonita sin gesto no cuenta");
  });

  it("la duda razonable no reprueba — Roberto votó así ('no sé si lino con algodón')", () => {
    expect(SYSTEM_RUBRICA).toContain("NO lo tira");
  });

  it("el schema exige las cuatro dimensiones + aprobado", () => {
    expect(SCHEMA_RUBRICA.required).toEqual([
      "analisis",
      "ocasion",
      "clima",
      "armado",
      "wow",
      "aprobado",
      "porQue",
    ]);
  });
});
