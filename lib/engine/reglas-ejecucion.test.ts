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

describe("el traje con el pantalón de otro", () => {
  // El par #11 del A/B ciego, tal cual salió. Roberto, sin saber qué lado era
  // cuál: "depende del evento... y también si el traje azul marino y el
  // pantalón son del mismo juego y que no sean diferentes". Tenía razón: el
  // motor no sabía que un traje ya trae su pantalón, porque el vocabulario lo
  // leía solo como capa y la zona pierna seguía pareciendo vacía.
  it("caza el look del par #11", () => {
    const v = revisarEjecucion([
      p("Traje marino de lana", "#1F2A44"),
      p("Camisa blanca", "#FFFFFF"),
      p("Pantalón de vestir marino", "#1F2A44"),
      p("Corbata de seda vino", "#722F37"),
      p("Zapato formal negro", "#1A1A1A"),
    ]);
    expect(v.map((x) => x.regla)).toContain("traje-con-pantalon-ajeno");
  });

  it("un traje solo, con su propio pantalón, no dispara nada", () => {
    const v = revisarEjecucion([
      p("Traje marino de lana", "#1F2A44"),
      p("Camisa blanca", "#FFFFFF"),
      p("Zapato formal negro", "#1A1A1A"),
    ]);
    expect(v.map((x) => x.regla)).not.toContain("traje-con-pantalon-ajeno");
  });

  it("un SACO de traje con pantalón aparte es legítimo", () => {
    // Es la diferencia que importa: el saco suelto SÍ pide un pantalón. Si la
    // regla no distinguiera "traje" de "saco de traje", prohibiría el look más
    // normal que existe.
    const v = revisarEjecucion([
      p("Saco de traje azul marino", "#1F2A44"),
      p("Camisa blanca", "#FFFFFF"),
      p("Pantalón de traje gris carbón", "#36454F"),
      p("Zapato formal negro", "#1A1A1A"),
    ]);
    expect(v.map((x) => x.regla)).not.toContain("traje-con-pantalon-ajeno");
  });

  it("un vestido sobre pantalón NO se toca — es un look real", () => {
    const v = revisarEjecucion([
      p("Vestido midi burdeos", "#722F37"),
      p("Pantalón de vestir negro", "#1A1A1A"),
      p("Botines Chelsea negros", "#1A1A1A"),
    ]);
    expect(v.map((x) => x.regla)).not.toContain("traje-con-pantalon-ajeno");
  });
});

// Los looks REALES del veredicto de Gemini que dispararon estas dos reglas.
// 4 de los 6 defectos de clima de toda la corrida cayeron en el brief de
// lluvia, y los DOS motores fallaron ahí — producción incluida, con el prompt
// afinado 38 veces. Por eso van comprobadas y no pedidas.
describe("lluvia-calzado", () => {
  // "Gris en capas" (Gemini): la chamarra impermeable SÍ estaba; el look se
  // cayó por los tenis. Roberto: "Falla en no poner botas o calzado para lluvia".
  const look = [
    p("Camiseta carbón", "#3A3A3A"),
    p("Chamarra impermeable ligera", "#4A4A4A", { material: "sintético" }),
    p("Chinos carbón", "#3A3A3A"),
    p("Tenis de lona blancos", "#F0F0F0", { material: "lona" }),
  ];
  const closet = [...look, p("Botines Chelsea negros", "#111111", { material: "piel" })];

  it("marca el calzado que el agua arruina, y ofrece el que sí aguanta", () => {
    const r = revisarEjecucion(look, { lluvia: true, closet }).find(
      (x) => x.regla === "lluvia-calzado"
    );
    expect(r).toBeDefined();
    expect(r!.detalle).toContain("Tenis de lona blancos");
    expect(r!.detalle).toContain("Botines Chelsea negros");
  });

  it("el criterio es el MATERIAL, no el tipo: tenis de piel pasan", () => {
    // Roberto, textual: "hay unos tenis que pueden ser tenis de piel o con
    // suela grande… seamos un poquito más tolerantes".
    const conPiel = [...look.slice(0, 3), p("Tenis de piel blancos", "#F0F0F0", { material: "piel" })];
    expect(
      revisarEjecucion(conPiel, { lluvia: true, closet }).find((x) => x.regla === "lluvia-calzado")
    ).toBeUndefined();
  });

  it("la gamuza NO pasa aunque sea un botín", () => {
    const gamuza = [...look.slice(0, 3), p("Botín chukka de gamuza", "#8A6B4F", { material: "gamuza" })];
    expect(
      revisarEjecucion(gamuza, { lluvia: true, closet }).find((x) => x.regla === "lluvia-calzado")
    ).toBeDefined();
  });

  it("una sandalia cae aunque sea de piel: el material no la salva", () => {
    const sandalia = [...look.slice(0, 3), p("Sandalia de cuero negra", "#111111", { material: "piel" })];
    expect(
      revisarEjecucion(sandalia, { lluvia: true, closet }).find((x) => x.regla === "lluvia-calzado")
    ).toBeDefined();
  });

  it("sin material no se juzga: datos incompletos no inventan violaciones", () => {
    const sinMat = [...look.slice(0, 3), p("Zapato derby chocolate", "#5A3A22")];
    expect(
      revisarEjecucion(sinMat, { lluvia: true, closet }).find((x) => x.regla === "lluvia-calzado")
    ).toBeUndefined();
  });

  it("sin recambio en el clóset se calla: es carencia, no fallo reparable", () => {
    expect(
      revisarEjecucion(look, { lluvia: true, closet: look }).find(
        (x) => x.regla === "lluvia-calzado"
      )
    ).toBeUndefined();
  });

  it("el paraguas NO salva el calzado — tapa el torso, no los pies", () => {
    expect(
      revisarEjecucion(look, { lluvia: true, paraguas: true, closet }).find(
        (x) => x.regla === "lluvia-calzado"
      )
    ).toBeDefined();
  });

  it("sin lluvia no dice nada", () => {
    expect(
      revisarEjecucion(look, { closet }).find((x) => x.regla === "lluvia-calzado")
    ).toBeUndefined();
  });
});

describe("lluvia-sin-impermeable", () => {
  // "Charcoal en la llovizna" (Gemini): abrigo de LANA bajo la lluvia.
  const look = [
    p("Cuello tortuga negro", "#111111", { material: "lana" }),
    p("Abrigo charcoal", "#3A3A3A", { material: "lana" }),
    p("Jeans negros", "#1A1A1A", { material: "mezclilla" }),
    p("Botines Chelsea negros", "#111111", { material: "piel" }),
  ];
  const closet = [...look, p("Chamarra impermeable ligera", "#4A4A4A", { material: "sintético" })];

  it("sin paraguas, la capa de lana no basta", () => {
    const r = revisarEjecucion(look, { lluvia: true, closet }).find(
      (x) => x.regla === "lluvia-sin-impermeable"
    );
    expect(r).toBeDefined();
    expect(r!.detalle).toContain("Chamarra impermeable ligera");
  });

  it("CON paraguas la deja pasar: es lo que evita que la temporada de lluvias sea la misma chamarra todos los días", () => {
    expect(
      revisarEjecucion(look, { lluvia: true, paraguas: true, closet }).find(
        (x) => x.regla === "lluvia-sin-impermeable"
      )
    ).toBeUndefined();
  });

  it("el look que ya trae la impermeable pasa limpio", () => {
    const conImper = [...look.slice(0, 1), closet[4], ...look.slice(2)];
    expect(
      revisarEjecucion(conImper, { lluvia: true, closet }).find(
        (x) => x.regla === "lluvia-sin-impermeable"
      )
    ).toBeUndefined();
  });

  it("sin impermeable en el clóset se calla", () => {
    expect(
      revisarEjecucion(look, { lluvia: true, closet: look }).find(
        (x) => x.regla === "lluvia-sin-impermeable"
      )
    ).toBeUndefined();
  });
});

describe("lluvia-calzado: la FORMA manda sobre el material", () => {
  // Cazado en la corrida de verificación: 5 de los 17 looks de lluvia traían
  // mocasín, y el mocasín es de PIEL — se colaba por el filtro de material.
  // Roberto había dicho las dos cosas y las dos son ciertas: "mocasín en
  // lluvia no aplica" Y "tenis de piel o suela grande, Chelsea… seamos
  // tolerantes". La diferencia no es de qué está hecho sino de cómo: el
  // Chelsea cubre el tobillo, el tenis te levanta del charco, el mocasín es
  // escotado y de suela fina.
  const arriba = [
    p("Camisa oxford blanca", "#F5F5F0", { material: "algodón" }),
    p("Chamarra impermeable ligera", "#4A4A4A", { material: "sintético" }),
    p("Chinos carbón", "#3A3A3A", { material: "algodón" }),
  ];
  const closet = [
    ...arriba,
    p("Botines Chelsea negros", "#111111", { material: "piel" }),
    p("Mocasines negros", "#111111", { material: "piel" }),
  ];
  const conCalzado = (zapato: ReturnType<typeof p>) => [...arriba, zapato];

  it("el mocasín de PIEL cae — el material no lo absuelve", () => {
    const r = revisarEjecucion(
      conCalzado(p("Mocasines negros", "#111111", { material: "piel" })),
      { lluvia: true, closet }
    ).find((x) => x.regla === "lluvia-calzado");
    expect(r).toBeDefined();
    expect(r!.detalle).toContain("Mocasines negros");
  });

  it("el náutico también, por la misma razón", () => {
    expect(
      revisarEjecucion(conCalzado(p("Náuticos café", "#5A3A22", { material: "piel" })), {
        lluvia: true,
        closet,
      }).find((x) => x.regla === "lluvia-calzado")
    ).toBeDefined();
  });

  it("pero el Chelsea de piel y el tenis de piel SIGUEN pasando", () => {
    // Si esto se rompiera, la regla dejó de ser la que Roberto pidió.
    for (const zapato of [
      p("Botines Chelsea negros", "#111111", { material: "piel" }),
      p("Tenis de piel negros", "#111111", { material: "piel" }),
      p("Botas de senderismo negras", "#111111", { material: "sintético" }),
    ]) {
      expect(
        revisarEjecucion(conCalzado(zapato), { lluvia: true, closet }).find(
          (x) => x.regla === "lluvia-calzado"
        ),
        zapato.attrs.nombre
      ).toBeUndefined();
    }
  });

  it("sin lluvia el mocasín no molesta a nadie", () => {
    expect(
      revisarEjecucion(conCalzado(p("Mocasines negros", "#111111", { material: "piel" })), {
        closet,
      }).find((x) => x.regla === "lluvia-calzado")
    ).toBeUndefined();
  });
});
