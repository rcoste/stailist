import { describe, expect, it } from "vitest";
import { revisarEjecucion, bloqueEjecucion } from "./reglas-ejecucion";
import type { EngineItem } from "./prompt";

const p = (
  nombre: string,
  color_hex: string,
  extra: Partial<EngineItem["attrs"]> = {}
): EngineItem => ({ id: nombre, attrs: { nombre, color_hex, ...extra } });

// Los looks REALES que dispararon esto: los cinco primeros que generó el motor
// con el recetario v2 puesto, y el 👎 que les dio Roberto.
describe("reglas de ejecución — los casos que la motivaron", () => {
  it("negro sobre negro: la capa desaparece", () => {
    // El look del 👎. Camisa negra abierta sobre camiseta negra: mismo tono y
    // misma superficie, así que no se lee como look en capas sino como mancha.
    const v = revisarEjecucion([
      p("Camisa negra", "#1A1A1A"),
      p("Camiseta negra", "#1A1A1A"),
      p("Jeans azul oscuro", "#2C3E50"),
      p("Botines Chelsea negros", "#1A1A1A"),
    ]);
    expect(v.map((x) => x.regla)).toContain("capa-invisible");
  });

  it("saco y pantalón del mismo color sin ser traje", () => {
    // La misma trampa con otras prendas: dos piezas fingiendo ser una que no
    // son. Esta regla existía en v28 y se perdió al re-destilar.
    const v = revisarEjecucion([
      p("Blazer marino", "#27425F"),
      p("Camisa blanca", "#FAFAF7"),
      p("Pantalón de vestir marino", "#27425F"),
    ]);
    expect(v.map((x) => x.regla)).toContain("traje-desparejado");
  });

  it("cueros que no se hablan: botín negro con reloj café", () => {
    const v = revisarEjecucion([
      p("Botines Chelsea negros", "#1A1A1A"),
      p("Reloj de piel café", "#6B4A2B"),
    ]);
    expect(v.map((x) => x.regla)).toContain("cueros-que-no-se-hablan");
  });
});

// La otra mitad, y la que decide si esto es una regla o un parche: los looks
// que se ven así pero SÍ funcionan no deben marcarse.
describe("reglas de ejecución — lo que NO debe marcar", () => {
  it("mismo tono con material distinto sí funciona (es la jugada de edgy)", () => {
    // La receta de edgy lo dice con todas sus letras: "cuando todo es negro, la
    // textura hace el contraste, no el color". Una regla de "mismo tono = mal"
    // a secas rompería esa carta y monocromático — y ahí sí sería un parche.
    const v = revisarEjecucion([
      p("Chamarra de piel negra", "#1A1A1A", { material: "piel" }),
      p("Suéter negro", "#1A1A1A", { material: "punto" }),
    ]);
    expect(v).toEqual([]);
  });

  it("cueros del mismo color pasan", () => {
    const v = revisarEjecucion([
      p("Mocasines café", "#6B4A33"),
      p("Reloj de piel café", "#6B4A2B"),
      p("Cinturón café", "#5C4433"),
    ]);
    expect(v).toEqual([]);
  });

  it("cueros claramente distintos NO son error: café con crema son dos decisiones", () => {
    // Lo que se lee como accidente es la franja de en medio (café con negro),
    // no el contraste franco.
    const v = revisarEjecucion([
      p("Mocasines café", "#6B4A33"),
      p("Cinturón crema", "#EDE3D2"),
    ]);
    expect(v).toEqual([]);
  });

  it("un look correcto no dispara nada", () => {
    const v = revisarEjecucion([
      p("Polo blanco", "#FAFAF7"),
      p("Pantalón de lino marino", "#27425F"),
      p("Mocasines café", "#6B4A33"),
      p("Reloj de piel café", "#6B4A2B"),
    ]);
    expect(v).toEqual([]);
  });
});

describe("reglas de ejecución — cuándo callarse", () => {
  it("sin hex no se inventa una violación", () => {
    // Una regla que dispara con datos incompletos manda al juez a "reparar" lo
    // que estaba bien, y eso hace más daño que no detectar.
    expect(
      revisarEjecucion([{ id: "a", attrs: { nombre: "Camisa negra" } }, { id: "b", attrs: { nombre: "Camiseta negra" } }])
    ).toEqual([]);
  });

  it("nombre irreconocible: no se adivina el material", () => {
    const v = revisarEjecucion([
      p("Prenda rara de arriba", "#1A1A1A"),
      p("Otra cosa", "#1A1A1A"),
    ]);
    expect(v).toEqual([]);
  });

  it("el bloque para el juez va vacío cuando el look está limpio", () => {
    expect(bloqueEjecucion([p("Polo blanco", "#FAFAF7")])).toEqual([]);
  });

  it("el bloque se marca como VERIFICADO, no como opinión", () => {
    // Importa el encuadre: el juez tiene que repararlo, no debatirlo.
    const b = bloqueEjecucion([p("Camisa negra", "#1A1A1A"), p("Camiseta negra", "#1A1A1A")]);
    expect(b.join("\n")).toContain("YA VERIFICADOS");
    expect(b.join("\n")).toContain("REPÁRALOS");
  });
});

describe("reglas de ejecución — el catálogo de básicos", () => {
  // Es el clóset con el que arranca TODA la gente nueva y sus prendas no traen
  // material. Si la regla dependiera de ese campo, no dispararía nunca en el
  // caso más común — que es justo donde se detectó el fallo.
  it("deduce el material del nombre cuando la prenda no lo declara", () => {
    const v = revisarEjecucion([
      p("Camisa negra", "#1A1A1A"),
      p("Camiseta negra", "#1A1A1A"),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].regla).toBe("capa-invisible");
  });
});

describe("codigo-de-smoking", () => {
  // El look #18 del barrido, literal: saco de smoking + camisa azul + corbata
  // burdeos + pantalón de vestir gris. Roberto: "el peor de todos... un
  // Frankenstein espantoso". El clóset TENÍA pantalón de smoking y moño negro.
  const smokingRoto = [
    p("Saco de smoking negro", "#111111"),
    p("Camisa azul claro", "#A8C4E0"),
    p("Corbata burdeos", "#6B2434"),
    p("Pantalón de vestir gris", "#808080"),
  ];

  it("caza el smoking armado con piezas que no son de smoking", () => {
    const v = revisarEjecucion(smokingRoto);
    const r = v.find((x) => x.regla === "codigo-de-smoking");
    expect(r).toBeDefined();
    expect(r!.detalle).toContain("galón");
    expect(r!.detalle).toContain("blanca");
    expect(r!.detalle).toContain("moño");
  });

  it("un smoking completo pasa limpio", () => {
    const v = revisarEjecucion([
      p("Saco de smoking negro", "#111111"),
      p("Camisa blanca", "#FFFFFF"),
      p("Moño negro", "#111111"),
      p("Pantalón de smoking negro", "#111111"),
    ]);
    expect(v.find((x) => x.regla === "codigo-de-smoking")).toBeUndefined();
  });

  it("no toca los looks que no llevan smoking", () => {
    const v = revisarEjecucion([
      p("Blazer marino", "#1F2A44"),
      p("Camisa azul claro", "#A8C4E0"),
      p("Chinos beige", "#D2B48C"),
    ]);
    expect(v.find((x) => x.regla === "codigo-de-smoking")).toBeUndefined();
  });
});

describe("frio-sin-abrigo", () => {
  const looksito = [p("Camiseta marino", "#1F2A44"), p("Pantalón negro", "#111111")];

  it("marca el look sin capa a 8°C cuando el clóset SÍ tiene abrigo", () => {
    const v = revisarEjecucion(looksito, {
      clima: "frio",
      closet: [...looksito, p("Abrigo de lana marino", "#1F2A44")],
    });
    const r = v.find((x) => x.regla === "frio-sin-abrigo");
    expect(r).toBeDefined();
    expect(r!.detalle).toContain("Abrigo de lana marino");
  });

  it("NO marca cuando el clóset no tiene ninguna capa", () => {
    // Ahí no es un fallo reparable sino una carencia: mandar al juez a
    // "arreglarlo" es mandarlo a inventar una prenda. Eso se dice con
    // honestidad en la explicación, no se repara.
    const v = revisarEjecucion(looksito, { clima: "frio", closet: looksito });
    expect(v.find((x) => x.regla === "frio-sin-abrigo")).toBeUndefined();
  });

  it("no dice nada en templado ni en calor", () => {
    const closet = [...looksito, p("Abrigo de lana marino", "#1F2A44")];
    for (const clima of ["templado", "calor"] as const) {
      expect(
        revisarEjecucion(looksito, { clima, closet }).find(
          (x) => x.regla === "frio-sin-abrigo"
        ),
        clima
      ).toBeUndefined();
    }
  });

  it("el look que ya trae abrigo pasa limpio", () => {
    const conAbrigo = [...looksito, p("Abrigo de lana marino", "#1F2A44")];
    const v = revisarEjecucion(conAbrigo, { clima: "frio", closet: conAbrigo });
    expect(v.find((x) => x.regla === "frio-sin-abrigo")).toBeUndefined();
  });
});
