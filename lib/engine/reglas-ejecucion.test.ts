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
  it("un TRAJE de verdad no es un traje desparejado", () => {
    // El caso que lo destapó: Roberto sube la foto de su traje gris, la visión
    // lo parte —bien— en saco y pantalón, y el par resultante es exactamente
    // lo que la regla prohíbe. Sin el lazo, tener un traje bueno impedía
    // usarlo. El lazo lo pone la persona al dar de alta, no el código: un
    // blazer con pantalón del mismo tono que NO son traje es justo el error
    // que la regla existe para cazar.
    const v = revisarEjecucion([
      p("Saco de traje gris oscuro", "#3A3A3C", { conjunto: "t1" }),
      p("Camisa blanca", "#FAFAF7"),
      p("Pantalón de vestir gris oscuro", "#3A3A3C", { conjunto: "t1" }),
    ]);
    expect(v.map((x) => x.regla)).not.toContain("traje-desparejado");
  });

  it("pero dos conjuntos DISTINTOS siguen siendo un traje desparejado", () => {
    // El saco de un traje con el pantalón de otro es el error clásico, y el
    // lazo no debe taparlo: sin esta comprobación bastaría con que ambos
    // tuvieran conjunto —cualquiera— para que la regla callara.
    const v = revisarEjecucion([
      p("Saco de traje gris oscuro", "#3A3A3C", { conjunto: "t1" }),
      p("Pantalón de vestir gris oscuro", "#3A3A3C", { conjunto: "t2" }),
    ]);
    expect(v.map((x) => x.regla)).toContain("traje-desparejado");
  });

  it("mismo tono con material distinto sí funciona (es la jugada de edgy)", () => {
    // La receta de edgy lo dice con todas sus letras: "cuando todo es negro, la
    // textura hace el contraste, no el color". Una regla de "mismo tono = mal"
    // a secas rompería esa carta y monocromático — y ahí sí sería un parche.
    // El fixture lleva camiseta debajo porque el look real la lleva: cuando
    // entró `sueter-sin-base` este test empezó a fallar y tenía razón — un
    // suéter a piel es justo lo que Roberto marcó siete veces. Se completó el
    // look sin tocar lo que este test comprueba (que el mismo tono con
    // material distinto NO se marca).
    const v = revisarEjecucion([
      p("Camiseta blanca", "#FFFFFF", { material: "algodón" }),
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

describe("codigo-de-smoking: los dos huecos que Roberto marcó", () => {
  // De la corrida de verificación. Los dos motores sacaron esmoquin para la
  // boda formal y él marcó exactamente dos cosas: "Smoking no lleva cinturón"
  // y "falta moño de Smoking" — esta última incluso en el look que APROBÓ.
  const base = [
    p("Esmoquin negro", "#0A0A0A"),
    p("Camisa blanca", "#FFFFFF"),
    p("Zapato formal negro", "#111111"),
  ];
  const regla = (its: ReturnType<typeof p>[]) =>
    revisarEjecucion(its, {}).find((x) => x.regla === "codigo-de-smoking");

  it("el cinturón sobra — era la ÚNICA diferencia entre su 👍 y su 👎", () => {
    const r = regla([...base, p("Cinturón negro", "#111111")]);
    expect(r).toBeDefined();
    expect(r!.detalle).toContain("Cinturón negro");
    expect(r!.detalle).toContain("trabillas");
  });

  it("sin nada al cuello, falta el moño (antes solo veía la corbata equivocada)", () => {
    const r = regla(base);
    expect(r).toBeDefined();
    expect(r!.detalle).toContain("moño");
  });

  it("con moño y sin cinturón, el esmoquin pasa limpio", () => {
    expect(regla([...base, p("Moño negro de seda", "#0A0A0A")])).toBeUndefined();
  });

  it("sin smoking, ni el cinturón ni la falta de moño molestan", () => {
    expect(
      regla([
        p("Traje marino de lana", "#1F2A44"),
        p("Camisa blanca", "#FFFFFF"),
        p("Cinturón negro", "#111111"),
      ])
    ).toBeUndefined();
  });
});

describe("las cuatro reglas que salieron del veredicto", () => {
  const closet = [
    p("Camiseta blanca", "#FFFFFF"),
    p("Camisa oxford blanca", "#F5F5F0"),
    p("Botines Chelsea negros", "#111111", { material: "piel" }),
    p("Zapato derby café", "#5A3A22", { material: "piel" }),
  ];
  const r = (its: ReturnType<typeof p>[], ctx = {}) =>
    revisarEjecucion(its, { closet, ...ctx });

  describe("zona-duplicada", () => {
    // Los dos casos son de Gemini en el veredicto, marcados por Roberto:
    // "metió dos pares de zapatos" y "metió suéteres repetidos".
    it("dos pares de calzado en un look", () => {
      const v = r([
        p("Camisa blanca", "#FFFFFF"),
        p("Pantalón negro", "#111111"),
        p("Mocasines burdeos", "#5A1F2A", { material: "piel" }),
        p("Zapato formal negro", "#111111", { material: "piel" }),
      ]).find((x) => x.regla === "zona-duplicada");
      expect(v).toBeDefined();
      expect(v!.detalle).toContain("Mocasines burdeos");
      expect(v!.detalle).toContain("Zapato formal negro");
    });

    it("dos suéteres apilados", () => {
      expect(
        r([
          p("Suéter cuello V marino", "#1F2A44"),
          p("Suéter de lana negro", "#111111"),
          p("Pantalón de vestir gris", "#6B6B6B"),
          p("Botines Chelsea negros", "#111111"),
        ]).find((x) => x.regla === "zona-duplicada")
      ).toBeDefined();
    });

    it("PERO dos capas sí se apilan: suéter bajo abrigo es correcto", () => {
      // Si esto se rompiera, la regla estaría prohibiendo vestirse en invierno.
      expect(
        r([
          p("Camiseta blanca", "#FFFFFF"),
          p("Abrigo charcoal", "#3A3A3A"),
          p("Pantalón negro", "#111111"),
          p("Botines Chelsea negros", "#111111"),
        ]).find((x) => x.regla === "zona-duplicada")
      ).toBeUndefined();
    });
  });

  describe("sueter-sin-base", () => {
    const SUELTO = [
      p("Suéter de lana negro", "#111111"),
      p("Jeans azul oscuro", "#2A3B5C"),
      p("Botines Chelsea negros", "#111111"),
    ];

    // SIETE comentarios de Roberto en un solo veredicto, en los dos motores, y
    // otra vez calibrando el eval: "es muy raro que haya el suéter directo y no
    // haya una playera abajo".
    it("el suéter a piel se marca, y ofrece la base del clóset", () => {
      const v = r(SUELTO, { gender: "hombre" }).find((x) => x.regla === "sueter-sin-base");
      expect(v).toBeDefined();
      expect(v!.detalle).toContain("Suéter de lana negro");
    });

    // El research: en el guardarropa femenino llevar el punto a piel es una
    // elección normal y el camisol es opcional. Aplicar aquí la convención
    // masculina marcaba como error algo correcto en la mitad de los clósets.
    it("para MUJER no es error: el punto a piel es elección, no fallo", () => {
      expect(
        r(SUELTO, { gender: "mujer" }).find((x) => x.regla === "sueter-sin-base")
      ).toBeUndefined();
    });

    it("sin género declarado tampoco dispara: en la duda, no inventar el error", () => {
      expect(r(SUELTO).find((x) => x.regla === "sueter-sin-base")).toBeUndefined();
    });

    it("el cuello tortuga BAJO un suéter cuenta como base (del research)", () => {
      expect(
        r(
          [
            p("Cuello tortuga negro de merino", "#111111"),
            p("Suéter de pico gris", "#6E7075"),
            p("Pantalón de vestir carbón", "#3A3B3F"),
          ],
          { gender: "hombre" }
        ).find((x) => x.regla === "sueter-sin-base")
      ).toBeUndefined();
    });

    it("con camiseta debajo pasa limpio", () => {
      expect(
        r([
          p("Camiseta blanca", "#FFFFFF"),
          p("Suéter de lana negro", "#111111"),
          p("Jeans azul oscuro", "#2A3B5C"),
        ], { gender: "hombre" }).find((x) => x.regla === "sueter-sin-base")
      ).toBeUndefined();
    });

    it("el cuello tortuga NO pide base: es cerrado y va a piel por diseño", () => {
      expect(
        r([
          p("Cuello tortuga negro de lana merino", "#111111"),
          p("Chinos carbón", "#3A3A3A"),
        ]).find((x) => x.regla === "sueter-sin-base")
      ).toBeUndefined();
    });
  });

  describe("manga-corta-con-saco", () => {
    // Roberto, dos veces y con signos: "Manga corta con saco jamás!!"
    it("camisa de manga corta bajo un saco", () => {
      expect(
        r([
          p("Camisa de manga corta blanca", "#FFFFFF", { manga: "manga corta" }),
          p("Blazer marino", "#1F2A44"),
          p("Pantalón de vestir gris", "#6B6B6B"),
        ]).find((x) => x.regla === "manga-corta-con-saco")
      ).toBeDefined();
    });

    it("sin saco, la manga corta no molesta a nadie", () => {
      expect(
        r([
          p("Camisa de manga corta blanca", "#FFFFFF", { manga: "manga corta" }),
          p("Chinos beige", "#C8B89A"),
        ]).find((x) => x.regla === "manga-corta-con-saco")
      ).toBeUndefined();
    });
  });

  describe("mocasin-en-frio", () => {
    // Medido sobre 309 looks marcados: el mocasín va bien en general (16% de
    // 👎, la línea base) pero en frío salta a 44% contra 6% (p = 0.038).
    const look = [
      p("Cuello tortuga negro", "#111111"),
      p("Pantalón de vestir gris", "#6B6B6B"),
      p("Mocasines café", "#5A3A22", { material: "piel" }),
    ];

    it("en frío se marca y ofrece el recambio", () => {
      const v = r(look, { clima: "frio" }).find((x) => x.regla === "mocasin-en-frio");
      expect(v).toBeDefined();
      expect(v!.detalle).toContain("Mocasines café");
      expect(v!.detalle).toContain("Botines Chelsea negros");
    });

    it("en templado NO: el mocasín ahí va igual de bien que todo lo demás", () => {
      expect(
        r(look, { clima: "templado" }).find((x) => x.regla === "mocasin-en-frio")
      ).toBeUndefined();
    });

    it("sin recambio en el clóset se calla: es carencia, no fallo", () => {
      expect(
        revisarEjecucion(look, { clima: "frio", closet: look }).find(
          (x) => x.regla === "mocasin-en-frio"
        )
      ).toBeUndefined();
    });
  });
});

describe("separates-en-evento-formal", () => {
  // La única regla que salió de DOS fuentes independientes: Roberto la escribió
  // cuatro veces en el veredicto ("No mantuvo el traje completo") y el juez
  // automático la levantó solo, en looks distintos ("el blazer marino con
  // pantalón gris es un combo de separates, no el traje oscuro que pide una
  // boda formal").
  const separates = [
    p("Blazer marino", "#1F2A44"),
    p("Camisa blanca", "#FFFFFF"),
    p("Pantalón de vestir gris", "#6B6B6B"),
    p("Zapato formal negro", "#111111"),
  ];
  const closet = [...separates, p("Traje marino de lana", "#1F2A44")];

  it("en boda formal, el blazer con pantalón ajeno se marca", () => {
    const v = revisarEjecucion(separates, { formality: "formal", closet }).find(
      (x) => x.regla === "separates-en-evento-formal"
    );
    expect(v).toBeDefined();
    expect(v!.detalle).toContain("Traje marino de lana");
  });

  it("con el traje completo pasa limpio", () => {
    expect(
      revisarEjecucion(
        [p("Traje marino de lana", "#1F2A44"), p("Camisa blanca", "#FFFFFF")],
        { formality: "formal", closet }
      ).find((x) => x.regla === "separates-en-evento-formal")
    ).toBeUndefined();
  });

  it("los MISMOS separates en la oficina están bien — ahí no dice nada", () => {
    // Si esto se rompiera, la regla estaría prohibiendo el blazer de diario.
    expect(
      revisarEjecucion(separates, { closet }).find(
        (x) => x.regla === "separates-en-evento-formal"
      )
    ).toBeUndefined();
  });

  it("sin traje en el clóset se calla: es carencia, no fallo reparable", () => {
    expect(
      revisarEjecucion(separates, { formality: "formal", closet: separates }).find(
        (x) => x.regla === "separates-en-evento-formal"
      )
    ).toBeUndefined();
  });
});

describe("lluvia: el tenis de MALLA se veta, el de piel no", () => {
  // Roberto: "sí definitivamente yo vetaría lo de la lluvia, como unos ultra
  // boost, que son los tenis de tela; pero [el de piel] sí puede ser de
  // preferencia". La malla/knit sintético no estaba en la lista de materiales
  // que el agua arruina — solo lona y tela — así que un tenis de punto técnico
  // pasaba limpio.
  const calzado = (nombre: string, material: string) => ({
    id: nombre,
    attrs: { categoria: "calzado", nombre, tipo: nombre, material, color_hex: "#111111" },
  });

  // El clóset SIEMPRE con una alternativa: sin recambio la regla se calla a
  // propósito (es carencia, no fallo reparable), y el test estaría midiendo esa
  // otra rama en vez del material.
  const RECAMBIO = calzado("Botines Chelsea negros", "piel");
  const enLluvia = (its: { id: string; attrs: Record<string, unknown> }[]) =>
    revisarEjecucion(its as never, {
      clima: "templado",
      lluvia: true,
      paraguas: false,
      closet: [...its, RECAMBIO] as never,
    }).find((v) => v.regla === "lluvia-calzado");

  it("un tenis de malla técnica NO aguanta la lluvia", () => {
    // Los tres materiales del tenis deportivo moderno. Antes solo "lona" y
    // "tela" estaban en la lista, así que un Ultraboost pasaba limpio.
    for (const material of ["malla", "mesh", "knit"]) {
      expect(enLluvia([calzado("Tenis Ultraboost", material)])).toBeDefined();
    }
  });

  it("un tenis de PIEL sigue pasando: es preferencia, no veto", () => {
    // Vetarlo daría falsos rechazos — mucha gente sale con tenis bajo lluvia.
    expect(enLluvia([calzado("Tenis de piel negros", "piel")])).toBeUndefined();
  });
});

// Las dos reglas que salieron de la calibración de v47 por Roberto. Sus cuatro
// 👎 los cazó el juez de texto (3) y el visual (2) — el CÓDIGO cazó cero, y
// tres de los cuatro eran de clima, que es justo lo comprobable.
describe("blazer-no-es-abrigo", () => {
  const p_ = (nombre: string, extra: Record<string, unknown> = {}) =>
    ({ id: nombre, attrs: { nombre, tipo: nombre, color_hex: "#333333", ...extra } }) as never;

  const CAMISA = p_("Camisa blanca", { categoria: "top", color_hex: "#FFFFFF" });
  const PANT = p_("Pantalón de vestir gris", { categoria: "bottom" });
  const BLAZER = p_("Blazer marino", { categoria: "saco", material: "lana" });
  const ABRIGO = p_("Abrigo charcoal", { categoria: "abrigo", material: "lana" });
  const SUETER = p_("Suéter de lana negro", { categoria: "top" });

  const enFrio = (its: unknown[], closet: unknown[]) =>
    revisarEjecucion(its as never, { clima: "frio", closet: closet as never, gender: "hombre" }).find(
      (v) => v.regla === "blazer-no-es-abrigo"
    );

  it("el blazer SOLO a 8°C no abriga — el caso real que Roberto marcó", () => {
    const closet = [CAMISA, PANT, BLAZER, ABRIGO, SUETER];
    expect(enFrio([CAMISA, PANT, BLAZER], closet)).toBeDefined();
  });

  it("con un ABRIGO encima, pasa", () => {
    const closet = [CAMISA, PANT, BLAZER, ABRIGO];
    expect(enFrio([CAMISA, PANT, BLAZER, ABRIGO], closet)).toBeUndefined();
  });

  it("con una capa de PUNTO debajo, también pasa — la otra salida que él nombró", () => {
    const closet = [CAMISA, PANT, BLAZER, SUETER];
    expect(enFrio([CAMISA, PANT, BLAZER, SUETER], closet)).toBeUndefined();
  });

  it("sin abrigo NI punto en el clóset se calla: es carencia, no fallo", () => {
    const closet = [CAMISA, PANT, BLAZER];
    expect(enFrio([CAMISA, PANT, BLAZER], closet)).toBeUndefined();
  });
});

describe("lana-en-calor", () => {
  const p_ = (nombre: string, extra: Record<string, unknown> = {}) =>
    ({ id: nombre, attrs: { nombre, tipo: nombre, color_hex: "#888888", ...extra } }) as never;

  const LINO = p_("Camisa de lino blanca", { categoria: "top", material: "lino", color_hex: "#FAFAF7" });
  const LANA = p_("Pantalón de vestir gris", { categoria: "bottom", material: "lana" });
  const ALGODON = p_("Chinos beige", { categoria: "bottom", material: "algodón" });

  const enCalor = (its: unknown[], closet: unknown[]) =>
    revisarEjecucion(its as never, { clima: "calor", closet: closet as never }).find(
      (v) => v.regla === "lana-en-calor"
    );

  it("el pantalón de lana a 29°C se marca — el caso real de la corrida", () => {
    expect(enCalor([LINO, LANA], [LINO, LANA, ALGODON])).toBeDefined();
  });

  it("la LANA FRÍA no cuenta: existe justo para el verano", () => {
    // Sin esta excepción la regla marcaría el traje de verano correcto.
    const tropical = p_("Pantalón de lana fría", { categoria: "bottom", material: "lana fría" });
    expect(enCalor([LINO, tropical], [LINO, tropical, ALGODON])).toBeUndefined();
  });

  it("sin alternativa en el clóset se calla", () => {
    expect(enCalor([LINO, LANA], [LINO, LANA])).toBeUndefined();
  });
});

describe("blazer-no-es-abrigo: la CATEGORÍA manda sobre el nombre", () => {
  it("un 'Blazer de lana' con categoría abrigo SÍ abriga — el falso positivo real", () => {
    // El catálogo trae "Blazer marrón de lana" con categoría "abrigo": es una
    // pieza pesada que hace de capa exterior. La primera versión de la regla lo
    // juzgó por el nombre y marcó un look que Roberto había APROBADO.
    const p_ = (nombre: string, extra: Record<string, unknown> = {}) =>
      ({ id: nombre, attrs: { nombre, tipo: nombre, color_hex: "#5C4433", ...extra } }) as never;
    const items = [
      p_("Camisa oxford blanca", { categoria: "top", color_hex: "#FFFFFF" }),
      p_("Pantalón de vestir marino", { categoria: "bottom", material: "lana" }),
      p_("Blazer marrón de lana", { categoria: "abrigo", material: "lana" }),
    ];
    const v = revisarEjecucion(items as never, {
      clima: "frio",
      closet: [...items, p_("Abrigo charcoal", { categoria: "abrigo" })] as never,
      gender: "hombre",
    });
    expect(v.find((x) => x.regla === "blazer-no-es-abrigo")).toBeUndefined();
  });
});

describe("bota-de-montana-en-la-calle", () => {
  // Roberto, calibrando v47: "no deberían ir a menos que esté nevando — se ve
  // ruidosa, le rompe la madre al look".
  const p_ = (nombre: string, extra: Record<string, unknown> = {}) =>
    ({ id: nombre, attrs: { nombre, tipo: nombre, color_hex: "#111111", ...extra } }) as never;

  const COLUMBIA = p_("Botas de senderismo negras Columbia", {
    categoria: "calzado",
    material: "sintético",
  });
  const CHELSEA = p_("Botines Chelsea negros", { categoria: "calzado", material: "piel" });
  const MOCASIN = p_("Mocasines de gamuza café", { categoria: "calzado", material: "gamuza" });
  const TOP = p_("Camiseta blanca", { categoria: "top", color_hex: "#FFFFFF" });
  const PANT = p_("Jeans negros", { categoria: "bottom" });

  const r_ = (its: unknown[], closet: unknown[], ctx = {}) =>
    revisarEjecucion(its as never, { closet: closet as never, ...ctx }).find(
      (v) => v.regla === "bota-de-montana-en-la-calle"
    );

  it("en día seco se marca: es calzado funcional, no de calle", () => {
    expect(r_([TOP, PANT, COLUMBIA], [TOP, PANT, COLUMBIA, CHELSEA])).toBeDefined();
  });

  it("sin otro calzado en el clóset se calla: es carencia, no fallo", () => {
    expect(r_([TOP, PANT, COLUMBIA], [TOP, PANT, COLUMBIA])).toBeUndefined();
  });

  it("CON LLUVIA y sin recambio que aguante, la bota se queda", () => {
    // La excepción: funcional feo gana a bonito empapado. Cambiarla por el
    // mocasín de gamuza sería "arreglar" hacia atrás.
    expect(
      r_([TOP, PANT, COLUMBIA], [TOP, PANT, COLUMBIA, MOCASIN], { lluvia: true, clima: "templado" })
    ).toBeUndefined();
  });

  it("con lluvia PERO con un botín de piel disponible, sí se cambia", () => {
    expect(
      r_([TOP, PANT, COLUMBIA], [TOP, PANT, COLUMBIA, CHELSEA], { lluvia: true, clima: "templado" })
    ).toBeDefined();
  });
});

describe("saco de traje suelto — la regla que Roberto pidió cuatro veces", () => {
  // Del veredicto de Gemini 3.7 (2026-08-14): "no podemos poner los sacos de
  // traje así como por sí solos, o tienen que ir con su par. Eso es una regla."
  const reglas = (items: EngineItem[]) => revisarEjecucion(items).map((x) => x.regla);

  it("con el lazo del traje puesto, exige SU pantalón — no cualquiera", () => {
    const v = reglas([
      p("Saco de traje gris", "#6B6B6B", { conjunto: "traje-1" }),
      p("Pantalón de vestir marino", "#26334D"), // de vestir, pero de otro traje
      p("Camisa blanca", "#FFFFFF"),
    ]);
    expect(v).toContain("saco-de-traje-suelto");
  });

  it("con su par exacto, no se queja", () => {
    const v = reglas([
      p("Saco de traje gris", "#6B6B6B", { conjunto: "traje-1" }),
      p("Pantalón de traje gris", "#6B6B6B", { conjunto: "traje-1" }),
      p("Camisa blanca", "#FFFFFF"),
    ]);
    expect(v).not.toContain("saco-de-traje-suelto");
  });

  // Sin el lazo (la mayoría de los clósets hoy) sólo se puede exigir lo que el
  // dato permite afirmar: que haya algún pantalón de vestir.
  it("sin lazo, un saco de traje con jeans se marca", () => {
    const v = reglas([
      p("Saco de traje marino de lana", "#26334D"),
      p("Jeans azul oscuro", "#2C3E50"),
      p("Camisa blanca", "#FFFFFF"),
    ]);
    expect(v).toContain("saco-de-traje-suelto");
  });

  it("el esmoquin cuenta como saco de traje", () => {
    const v = reglas([p("Saco de esmoquin negro", "#111111"), p("Jeans negros", "#1A1A1A")]);
    expect(v).toContain("saco-de-traje-suelto");
  });

  // EL ERROR CONTRARIO, que sería más caro: prohibir lo que sí se lleva suelto.
  // Estos cuatro salen de nombres reales de la base.
  for (const suelto of [
    "Blazer marino",
    "Saco desestructurado café",
    "Saco sport gris carbón",
    "Saco de cuadros príncipe de Gales",
  ]) {
    it(`"${suelto}" se lleva solo y NO se marca`, () => {
      const v = reglas([p(suelto, "#26334D"), p("Jeans azul oscuro", "#2C3E50")]);
      expect(v).not.toContain("saco-de-traje-suelto");
    });
  }

  // La asimetría es de Roberto: "el pantalón de traje sí podría ir solo".
  it("el pantalón de traje SUELTO no se marca", () => {
    const v = reglas([
      p("Pantalón de traje gris", "#6B6B6B", { conjunto: "traje-1" }),
      p("Camiseta blanca", "#FFFFFF"),
      p("Tenis blancos", "#F5F5F5"),
    ]);
    expect(v).not.toContain("saco-de-traje-suelto");
  });
});

// La trampa del español: "chaqueta" contiene "chaque". Sin frontera de palabra,
// una chamarra con cierre entraba como si fuera un chaqué de etiqueta. Salió de
// verificar la regla contra los 107 looks reales de la corrida, no de un test
// imaginado.
it("una chaqueta NO es un chaqué", () => {
  const v = revisarEjecucion([
    p("Chaqueta negra con cierre", "#1A1A1A"),
    p("Chinos carbón", "#3B3B3B"),
    p("Tenis blancos urbanos", "#F5F5F5"),
  ]).map((x) => x.regla);
  expect(v).not.toContain("saco-de-traje-suelto");
});

describe("cuello alto de punto — la corrección que Roberto pidió tres veces", () => {
  const reglas = (items: EngineItem[], gender = "hombre") =>
    revisarEjecucion(items, { gender }).map((x) => x.regla);

  // Los tres comentarios salieron votando A CIEGAS en el veredicto de 3.7.
  it("un cuello tortuga de lana sin nada debajo se marca", () => {
    const v = reglas([
      p("Cuello tortuga negro de lana merino", "#1A1A1A", { material: "lana" }),
      p("Pantalón de vestir gris", "#6B6B6B"),
      p("Zapato formal negro", "#111111"),
    ]);
    expect(v).toContain("cuello-alto-sin-base");
  });

  it("con camiseta debajo, no se queja", () => {
    const v = reglas([
      p("Cuello tortuga negro de lana merino", "#1A1A1A", { material: "lana" }),
      p("Camiseta blanca", "#FFFFFF"),
      p("Pantalón de vestir gris", "#6B6B6B"),
    ]);
    expect(v).not.toContain("cuello-alto-sin-base");
  });

  // La opción B, que es la que eligió Roberto: sólo los de punto. Un cuello alto
  // fino de algodón sí está diseñado para ir a piel.
  it("un cuello alto FINO de algodón NO se marca", () => {
    const v = reglas([
      p("Playera de cuello alto negra", "#1A1A1A", { material: "algodón" }),
      p("Jeans azul oscuro", "#2C3E50"),
    ]);
    expect(v).not.toContain("cuello-alto-sin-base");
  });

  // Otro cuello alto NO cuenta como base: lo que se pide es lo que va debajo de
  // este. (En la regla 9 sí sirve de base bajo un suéter de pico — eso no cambia.)
  it("dos cuellos altos no se resuelven entre sí", () => {
    const v = reglas([
      p("Suéter de cuello alto", "#1A1A1A", { material: "lana" }),
      p("Cuello tortuga negro", "#333333", { material: "punto" }),
      p("Jeans azul oscuro", "#2C3E50"),
    ]);
    expect(v).toContain("cuello-alto-sin-base");
  });

  // Mismo motivo que la regla del suéter: la base bajo el punto es convención
  // del guardarropa masculino, no del femenino.
  it("no aplica sin género declarado ni en mujer", () => {
    const items = [
      p("Cuello tortuga negro de lana merino", "#1A1A1A", { material: "lana" }),
      p("Jeans azul oscuro", "#2C3E50"),
    ];
    expect(reglas(items, "mujer")).not.toContain("cuello-alto-sin-base");
    expect(revisarEjecucion(items).map((x) => x.regla)).not.toContain("cuello-alto-sin-base");
  });

  // El cuello alto sigue valiendo como base de un suéter de pico: la regla 9 no
  // cambió, y esta no la contradice.
  it("el cuello alto sigue siendo base válida bajo un suéter de pico", () => {
    const v = reglas([
      p("Suéter de pico marino", "#26334D", { material: "lana" }),
      p("Cuello tortuga negro", "#1A1A1A", { material: "punto" }),
      p("Camiseta blanca", "#FFFFFF"),
      p("Chinos carbón", "#3B3B3B"),
    ]);
    expect(v).not.toContain("sueter-sin-base");
    expect(v).not.toContain("cuello-alto-sin-base");
  });
});

describe("funeral — el esmoquin que Roberto llamó 'terrible'", () => {
  const enFuneral = (items: EngineItem[]) =>
    revisarEjecucion(items, { tipoEvento: "funeral", formality: "formal" }).map((x) => x.regla);

  // El caso real del veredicto de 3.7. La ironía: el catálogo ya gritaba "EL
  // COLOR ES NEGRO" y la prenda más negra del clóset era el esmoquin, así que
  // la regla del color empujó justo hacia el error.
  it("un esmoquin en un funeral se marca, por muy negro que sea", () => {
    const v = enFuneral([
      p("Saco de esmoquin negro", "#111111"),
      p("Pantalón negro", "#1A1A1A"),
      p("Camisa blanca", "#FFFFFF"),
    ]);
    expect(v).toContain("funeral-etiqueta");
  });

  it("un traje negro normal NO se marca", () => {
    const v = enFuneral([
      p("Saco de traje negro", "#141414", { conjunto: "t1" }),
      p("Pantalón de traje negro", "#141414", { conjunto: "t1" }),
      p("Camisa blanca", "#FFFFFF"),
      p("Corbata negra", "#111111"),
    ]);
    expect(v).not.toContain("funeral-etiqueta");
    expect(v).not.toContain("funeral-corbata-color");
  });

  it("la corbata de color se marca; la negra pasa", () => {
    const conVino = enFuneral([p("Corbata de seda vino", "#6B2233"), p("Camisa blanca", "#FFFFFF")]);
    expect(conVino).toContain("funeral-corbata-color");
    const conNegra = enFuneral([p("Corbata negra", "#121212"), p("Camisa blanca", "#FFFFFF")]);
    expect(conNegra).not.toContain("funeral-corbata-color");
  });

  // "la corbata gris no va" — Roberto, en el mismo par. Un gris medio tiene
  // poca saturación pero demasiada luz: no es negro.
  it("una corbata gris clara tampoco pasa", () => {
    expect(enFuneral([p("Corbata gris", "#9A9A9A")])).toContain("funeral-corbata-color");
  });

  // Sin hex no se inventa el error: es la regla de toda esta casa.
  it("sin color declarado no se marca la corbata", () => {
    const v = revisarEjecucion([{ id: "x", attrs: { nombre: "Corbata" } } as EngineItem], {
      tipoEvento: "funeral",
    }).map((x) => x.regla);
    expect(v).not.toContain("funeral-corbata-color");
  });

  // Y NADA de esto aplica fuera de un funeral: el esmoquin en una boda de gala
  // es exactamente lo correcto.
  it("en una boda el esmoquin y la corbata de color no se tocan", () => {
    const v = revisarEjecucion(
      [p("Saco de esmoquin negro", "#111111"), p("Corbata de seda vino", "#6B2233")],
      { tipoEvento: "boda", formality: "gala" }
    ).map((x) => x.regla);
    expect(v).not.toContain("funeral-etiqueta");
    expect(v).not.toContain("funeral-corbata-color");
  });
});

describe("lluvia: el escotado pierde contra el que cubre el tobillo", () => {
  const bota = (n: string, hex: string, extra = {}) =>
    p(n, hex, { cubre_tobillo: true, material: "piel", ...extra });
  const bajo = (n: string, hex: string, extra = {}) =>
    p(n, hex, { cubre_tobillo: false, material: "piel", ...extra });

  const conLluvia = (look: EngineItem[], closet: EngineItem[]) =>
    revisarEjecucion(look, { lluvia: true, closet, gender: "hombre" }).map((x) => x.regla);

  // El caso real: tres veces marcó "calzado no ideal para lluvia" sobre unos
  // tenis, teniendo botines Chelsea en el clóset.
  it("unos tenis pierden contra los botines Chelsea que ya tiene", () => {
    const tenis = bajo("Tenis de piel negros", "#1A1A1A", { formalidad: "casual" });
    const chelsea = bota("Botines Chelsea negros", "#1A1A1A", { formalidad: "formal-casual" });
    expect(conLluvia([tenis], [tenis, chelsea])).toContain("lluvia-mejor-calzado");
  });

  // EL GUARDIA QUE SALVÓ LA REGLA. Sin él, la primera versión hacía reprobar
  // todos los zapatos de vestir con lluvia — se cazó simulando contra el clóset
  // real antes de escribirla.
  it("un derby NO pierde contra una bota de menor formalidad", () => {
    const derby = bajo("Zapatos derby negros", "#141414", { formalidad: "formal" });
    const chelsea = bota("Botines Chelsea negros", "#1A1A1A", { formalidad: "formal-casual" });
    const botas = bota("Botas negras", "#141414", { formalidad: "casual" });
    expect(conLluvia([derby], [derby, chelsea, botas])).not.toContain("lluvia-mejor-calzado");
  });

  it("sin bota en el clóset no se marca nada: es carencia, no fallo", () => {
    const tenis = bajo("Tenis blancos", "#F5F5F5", { formalidad: "casual" });
    expect(conLluvia([tenis], [tenis])).not.toContain("lluvia-mejor-calzado");
  });

  // La alternativa también tiene que aguantar el agua: cambiar unos tenis por
  // unos botines de gamuza sería "reparar" hacia atrás.
  it("una bota de gamuza no cuenta como alternativa", () => {
    const tenis = bajo("Tenis de piel negros", "#1A1A1A", { formalidad: "casual" });
    const gamuza = bota("Botines Chelsea de gamuza", "#6B5844", {
      formalidad: "formal-casual",
      material: "gamuza",
    });
    expect(conLluvia([tenis], [tenis, gamuza])).not.toContain("lluvia-mejor-calzado");
  });

  it("si el look YA trae bota, no se queja", () => {
    const chelsea = bota("Botines Chelsea negros", "#1A1A1A", { formalidad: "formal-casual" });
    expect(conLluvia([chelsea], [chelsea])).not.toContain("lluvia-mejor-calzado");
  });

  // Sin el dato no se inventa el error: 900+ prendas se guardaron antes de que
  // existiera `cubre_tobillo`.
  it("sin el dato de tobillo no dispara", () => {
    const sinDato = p("Tenis viejos", "#333333", { material: "piel", formalidad: "casual" });
    const chelsea = bota("Botines Chelsea negros", "#1A1A1A", { formalidad: "formal-casual" });
    expect(conLluvia([sinDato], [sinDato, chelsea])).not.toContain("lluvia-mejor-calzado");
  });

  it("sin lluvia la regla no existe", () => {
    const tenis = bajo("Tenis de piel negros", "#1A1A1A", { formalidad: "casual" });
    const chelsea = bota("Botines Chelsea negros", "#1A1A1A", { formalidad: "formal-casual" });
    const v = revisarEjecucion([tenis], { closet: [tenis, chelsea], gender: "hombre" });
    expect(v.map((x) => x.regla)).not.toContain("lluvia-mejor-calzado");
  });
});

describe("full lino en oficina — dos veces con signos de admiración", () => {
  const enOficina = (items: EngineItem[]) =>
    revisarEjecucion(items, { objective: "oficina", gender: "hombre" }).map((x) => x.regla);

  // Los DOS looks reales que lo dispararon eran idénticos: camisa de lino +
  // pantalón de lino, objetivo oficina.
  it("camisa de lino + pantalón de lino en la oficina se marca", () => {
    const v = enOficina([
      p("Camisa de lino azul", "#8FA8C4", { material: "lino" }),
      p("Pantalón de lino beige", "#D9CDB8", { material: "lino" }),
      p("Mocasines café", "#6B4A2F", { material: "piel" }),
    ]);
    expect(v).toContain("full-lino-en-oficina");
  });

  // "El look está cool, pero te fuiste FULL lino" — el problema es el lino en
  // TODO, no el lino. Una sola pieza es correcta en una oficina de calor.
  it("UNA sola prenda de lino NO se marca", () => {
    const v = enOficina([
      p("Camisa de lino azul", "#8FA8C4", { material: "lino" }),
      p("Chinos azul marino", "#26334D", { material: "algodón" }),
    ]);
    expect(v).not.toContain("full-lino-en-oficina");
  });

  // Fuera de la oficina el lino completo es exactamente lo correcto: él mismo
  // dijo "full lino es más para eventos, playa".
  it("en un evento o en la playa no se toca", () => {
    const look = [
      p("Camisa de lino azul", "#8FA8C4", { material: "lino" }),
      p("Pantalón de lino beige", "#D9CDB8", { material: "lino" }),
    ];
    expect(revisarEjecucion(look, { objective: "evento" }).map((x) => x.regla)).not.toContain(
      "full-lino-en-oficina"
    );
    expect(revisarEjecucion(look, { objective: "diario" }).map((x) => x.regla)).not.toContain(
      "full-lino-en-oficina"
    );
  });

  // Los accesorios y el calzado no cuentan: son "estructural" torso/pierna/capa.
  it("un cinturón y unos zapatos no hacen 'full lino'", () => {
    const v = enOficina([
      p("Camisa de lino azul", "#8FA8C4", { material: "lino" }),
      p("Chinos carbón", "#3B3B3B", { material: "algodón" }),
      p("Cinturón de lino", "#D9CDB8", { material: "lino" }),
    ]);
    expect(v).not.toContain("full-lino-en-oficina");
  });

  it("sin objetivo declarado no dispara", () => {
    const v = revisarEjecucion(
      [
        p("Camisa de lino azul", "#8FA8C4", { material: "lino" }),
        p("Pantalón de lino beige", "#D9CDB8", { material: "lino" }),
      ],
      {}
    ).map((x) => x.regla);
    expect(v).not.toContain("full-lino-en-oficina");
  });
});

// El cableado de la regla de coherencia cromática. Lo que se blinda aquí NO es
// la medición —esa tiene su propio archivo, coherencia-cromatica.test.ts— sino
// que llegue a los DOS destinos: la lista de violaciones y el bloque de texto
// que lee el juez. Una regla que mide bien y no se cablea es una regla que no
// existe, y este repo ya perdió una así (la del tono repetido, borrada del
// prompt sin que nada tronara).
describe("colores-que-no-se-leen: retirada (2026-08-22)", () => {
  // "Carbón bajo cero" fue el look que la originó. Hoy NO dispara: la regla se
  // midió cinco rondas con su ablación y nunca se ganó el lugar. Si alguien la
  // vuelve a cablear, este test lo dice — y pide su ronda.
  it("el look que la originó ya no la dispara", () => {
    const v = revisarEjecucion([
      p("Camisa negra", "#1A1A1A"),
      p("Saco de traje gris carbón", "#3A3C42"),
      p("Pantalón de vestir gris carbón", "#3A3C42"),
      p("Suéter marino", "#1F2A44"),
      p("Botines Chelsea café", "#6B4A33"),
    ]);
    expect(v.map((x) => x.regla)).not.toContain("colores-que-no-se-leen");
  });
});

// La regla espejo de zona-duplicada: que no FALTE una zona.
//
// El motor validaba que el look trajera ≥2 prendas reales y nada más, así que
// "Suéter gris + Camisa blanca" —sin pantalón— pasaba entero. Sobre los 153
// looks reales de la base marca 14 (9.2%) con CERO falsos positivos.
describe("zona-sin-cubrir: el look tiene que vestir a alguien", () => {
  const closet = [
    p("Camisa blanca", "#F2F0EB"),
    p("Suéter gris", "#8A8A8A"),
    p("Pantalón de vestir gris", "#555555"),
    p("Mocasín negro", "#1A1A1A"),
    p("Traje de baño negro", "#1A1A1A"),
    p("Sandalias negras", "#1A1A1A"),
  ];
  const reglas = (look: EngineItem[], ctx = { closet }) =>
    revisarEjecucion(look, ctx).map((x) => x.regla);

  it("un look sin nada que cubra las piernas se marca", () => {
    // Los tres casos reales de la base tienen esta forma exacta.
    expect(reglas([p("Suéter gris", "#8A8A8A"), p("Camisa blanca", "#F2F0EB")])).toContain(
      "zona-sin-cubrir"
    );
  });

  it("un look sin nada de torso también", () => {
    expect(
      reglas([p("Chaqueta de piel", "#2A2A2A"), p("Botas negras", "#1A1A1A")])
    ).toContain("zona-sin-cubrir");
  });

  it("el vestido resuelve torso Y pierna: no se marca", () => {
    expect(
      reglas([p("Vestido negro", "#1A1A1A"), p("Tacón nude", "#D9BFA8")])
    ).not.toContain("zona-sin-cubrir");
  });

  it("el traje trae su pantalón: no se marca", () => {
    expect(
      reglas([p("Traje marino", "#1F2A44"), p("Camisa blanca", "#F2F0EB")])
    ).not.toContain("zona-sin-cubrir");
  });

  it("en la alberca el traje de baño ES la prenda de abajo", () => {
    // Los dos looks de viaje de la base están bien y no se pueden marcar.
    expect(
      reglas([
        p("Sandalias negras", "#1A1A1A"),
        p("Traje de baño negro", "#1A1A1A"),
        p("Camisa azul claro", "#A8C4E0"),
      ])
    ).not.toContain("zona-sin-cubrir");
  });

  it("CARENCIA, no fallo: sin la prenda en el clóset no acusa", () => {
    // Misma distinción que la regla del frío. Mandar al juez a reparar lo que
    // no se puede es peor que callar.
    const soloTorso = [p("Camisa blanca", "#F2F0EB"), p("Suéter gris", "#8A8A8A")];
    expect(reglas(soloTorso, { closet: soloTorso })).not.toContain("zona-sin-cubrir");
  });

  it("el CALZADO no se marca, y eso se midió", () => {
    // Fue la única zona con falso positivo: "Lino y campo" no lleva calzado en
    // la fila y tiene un evento `worn` — alguien SE LO PUSO. El calzado es la
    // zona que la gente rellena sola.
    expect(
      reglas([p("Camisa blanca", "#F2F0EB"), p("Pantalón de vestir gris", "#555555")])
    ).not.toContain("zona-sin-cubrir");
  });

  it("si una prenda no se reconoce, no juzga", () => {
    // Podría estar cubriendo la zona. Callar es lo que separa esta regla de una
    // que marque de más.
    expect(
      reglas([p("Camisa blanca", "#F2F0EB"), p("Chunchurria espacial", "#333333")])
    ).not.toContain("zona-sin-cubrir");
  });

  it('"Pantalón técnico" cuenta como pierna, no como abrigo', () => {
    // Caía en la regla de prendas técnicas (capa) y su look aparecía sin nada
    // que cubriera las piernas. "Técnico" es adjetivo; el sustantivo manda.
    expect(
      reglas([p("Camiseta blanca", "#F2F0EB"), p("Pantalón técnico", "#333333")])
    ).not.toContain("zona-sin-cubrir");
  });
});

describe("negro-con-beige — tres veces en la ronda 8559ec99", () => {
  const CHINOS = p("Chinos beige", "#C8B89A", { color: "beige" });
  it("mocasín y cinturón negros con chinos beige: dispara y nombra a los dos", () => {
    const v = revisarEjecucion([
      p("Camisa azul rey de manga corta", "#2A4D9B", { color: "azul" }),
      CHINOS,
      p("Mocasines negros", "#1A1A1A", { color: "negro" }),
      p("Cinturón negro", "#1A1A1A", { color: "negro" }),
    ]);
    const r = v.find((x) => x.regla === "negro-con-beige");
    expect(r).toBeDefined();
    expect(r!.detalle).toContain("Mocasines negros");
    expect(r!.detalle).toContain("Cinturón negro");
  });
  it("con mocasín burdeos y cinturón café NO dispara (los chinos beige que aprobó)", () => {
    const v = revisarEjecucion([
      p("Camisa de lino esmeralda", "#1F6B4A", { color: "esmeralda" }),
      CHINOS,
      p("Mocasines burdeos", "#5C2A2E", { color: "burdeos" }),
      p("Cinturón café", "#5C4433", { color: "café" }),
    ]);
    expect(v.find((x) => x.regla === "negro-con-beige")).toBeUndefined();
  });
  it("zapato negro con pantalón negro o marino no es asunto de esta regla", () => {
    const v = revisarEjecucion([
      p("Camisa blanca", "#FAFAF7", { color: "blanco" }),
      p("Chinos azul marino", "#27425F", { color: "azul marino" }),
      p("Mocasines negros", "#1A1A1A", { color: "negro" }),
    ]);
    expect(v.find((x) => x.regla === "negro-con-beige")).toBeUndefined();
  });
});

describe("mezclilla-con-saco — 'hazme el favor'", () => {
  const MEZCLILLA = p("Camisa de mezclilla", "#7D9BB5", { color: "azul mezclilla" });
  it("camisa de mezclilla bajo blazer: dispara", () => {
    const v = revisarEjecucion([
      MEZCLILLA,
      p("Blazer marino", "#27425F"),
      p("Pantalón negro", "#1A1A1A"),
      p("Mocasines negros", "#1A1A1A"),
    ]);
    expect(v.map((x) => x.regla)).toContain("mezclilla-con-saco");
  });
  it("y bajo saco de traje también", () => {
    const v = revisarEjecucion([
      MEZCLILLA,
      p("Saco de traje gris carbón", "#3A3A3A"),
      p("Pantalón de traje gris carbón", "#3A3A3A"),
      p("Botines Chelsea", "#6B4A33"),
    ]);
    expect(v.map((x) => x.regla)).toContain("mezclilla-con-saco");
  });
  it("bajo un suéter o una chaqueta la mezclilla es correcta (los que aprobó)", () => {
    const v = revisarEjecucion([
      MEZCLILLA,
      p("Suéter de lana negro", "#111111"),
      p("Jeans negros", "#1A1A1A"),
      p("Chaqueta negra con cierre", "#1a1a1a"),
      p("Botines de cuero marrón", "#5a3826"),
    ]);
    expect(v.find((x) => x.regla === "mezclilla-con-saco")).toBeUndefined();
  });
});


describe("cuello-alto-sin-base — el cuello tortuga sin apellido también es de punto", () => {
  // Cuarta vez de Roberto (2026-08-22): "Cuello tortuga negro" sin material y
  // sin "suéter" en el nombre pasaba sin base. Un cuello tortuga es de punto
  // por construcción, salvo que declare lo contrario.
  const ctx = { gender: "hombre" as const };
  it("'Cuello tortuga negro' a piel dispara", () => {
    const v = revisarEjecucion(
      [p("Cuello tortuga negro", "#111111"), p("Jeans negros", "#1A1A1A"), p("Botines Chelsea negros", "#111111")],
      ctx
    );
    expect(v.map((x) => x.regla)).toContain("cuello-alto-sin-base");
  });
  it("con una playera debajo, no", () => {
    const v = revisarEjecucion(
      [p("Cuello tortuga negro", "#111111"), p("Camiseta blanca", "#FFFFFF"), p("Jeans negros", "#1A1A1A")],
      ctx
    );
    expect(v.map((x) => x.regla)).not.toContain("cuello-alto-sin-base");
  });
  it("un cuello alto que declara algodón fino sigue fuera", () => {
    const v = revisarEjecucion(
      [p("Cuello alto fino de algodón", "#111111", { material: "algodón" }), p("Jeans negros", "#1A1A1A")],
      ctx
    );
    expect(v.map((x) => x.regla)).not.toContain("cuello-alto-sin-base");
  });
});
