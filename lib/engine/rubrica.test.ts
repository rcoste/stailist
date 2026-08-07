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

  it("el schema exige las seis dimensiones + aprobado", () => {
    expect(SCHEMA_RUBRICA.required).toEqual([
      "analisis",
      "ocasion",
      "clima",
      "armado",
      "estilo",
      "color",
      "wow",
      "aprobado",
      "porQue",
    ]);
  });

  // La dimensión de color (r8) tiene DOS lados y el segundo es el que la hace
  // útil: sin él, premiar "está en su paleta" volvería al motor más monótono —
  // que es exactamente lo que Roberto ve ("casi todo es verde esmeralda o
  // vino") y lo que la línea base midió (wow 3.16, la nota más baja).
  it("un neutral cerca de la cara está BIEN, no es un castigo", () => {
    expect(SYSTEM_RUBRICA).toContain("NO lo castigues por no ser uno de sus colores estrella");
  });

  it("repetir el color estrella de siempre BAJA la nota aunque favorezca", () => {
    expect(SYSTEM_RUBRICA).toContain("Favorecer es el piso, no el objetivo");
  });

  it("ni el neutral ni el color repetido reprueban el look", () => {
    expect(SYSTEM_RUBRICA).toContain("eso baja la nota de color, no reprueba el look");
  });

  // El juez con sombrero de stylist (r7). Las dos anclas que no deben perderse:
  // la formalidad acota al estilo (el boho que va de gala no reprueba por no
  // verse boho), y sin estilo declarado la dimensión queda neutra.
  it("la formalidad acota al estilo, no al revés", () => {
    expect(SYSTEM_RUBRICA).toContain("la formalidad ACOTA al estilo");
    expect(SYSTEM_RUBRICA).toContain("NO castigues");
  });

  it("sin estilo declarado, la dimensión es neutra y no pesa en aprobado", () => {
    expect(SYSTEM_RUBRICA).toContain("pon 3 y no lo uses para aprobar");
  });
});

describe("el estilo en el brief — el juez lee lo MISMO que el motor recibió", () => {
  it("marca, palabras y arquetipo viajan al brief", () => {
    const t = briefParaRubrica({
      objective: "diario",
      weather: { temp_c: 18, condition: "nublado" },
      estilo: {
        marca: "minimalismo cálido de líneas limpias",
        palabras: "sencillo pero con intención",
        arquetipo: "El arquitecto — neutros y estructura",
      },
    });
    expect(t).toContain("SU ESTILO");
    expect(t).toContain("minimalismo cálido");
    expect(t).toContain("sencillo pero con intención");
    expect(t).toContain("El arquitecto");
  });

  it("sin señal de estilo, el brief no finge una", () => {
    const t = briefParaRubrica({
      objective: "diario",
      weather: { temp_c: 18, condition: "nublado" },
      estilo: { marca: null, palabras: null, arquetipo: null },
    });
    expect(t).not.toContain("SU ESTILO");
  });
});

describe("la colorimetría en el brief", () => {
  const paleta = {
    estacion: "invierno",
    mejores: [{ nombre: "Vino", hex: "#722F37" }],
    prestados: [{ nombre: "Verde esmeralda", hex: "#046307" }],
    evita: [{ nombre: "Mostaza", hex: "#D4A017" }],
  };

  it("los tres grupos viajan CON su hex — dos 'vino' distintos no son lo mismo", () => {
    const t = briefParaRubrica({
      objective: "diario",
      weather: null,
      color: paleta,
    });
    expect(t).toContain("SU COLORIMETRÍA (invierno)");
    expect(t).toContain("Vino #722F37");
    expect(t).toContain("Verde esmeralda");
    expect(t).toContain("Mostaza");
  });

  it("los neutrales se declaran PERMITIDOS en el propio brief", () => {
    // Sin esta línea, el juez leería la paleta como una lista cerrada y
    // castigaría el marino — que es exactamente lo que no queremos.
    const t = briefParaRubrica({ objective: "diario", weather: null, color: paleta });
    expect(t).toContain("NEUTRAL");
    expect(t).toContain("está permitido");
  });

  it("sin colorimetría, el brief no inventa una paleta", () => {
    const t = briefParaRubrica({
      objective: "diario",
      weather: null,
      color: { estacion: null, mejores: [], prestados: [], evita: [] },
    });
    expect(t).not.toContain("SU COLORIMETRÍA");
  });
});
