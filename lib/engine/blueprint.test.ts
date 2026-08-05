import { describe, it, expect } from "vitest";
import {
  emparejarBlueprint,
  elegirBlueprint,
  bloqueBlueprint,
  revisarColorBlueprint,
  blueprintDelContexto,
  type Blueprint,
} from "./blueprint";
import { claridad, viveza, banda, esVivo } from "./color-medidas";
import type { EngineItem } from "./prompt";

const p = (nombre: string, color_hex = "#808080"): EngineItem => ({
  id: nombre.toLowerCase().replace(/\s+/g, "-"),
  attrs: { nombre, color_hex },
});

const BP = (over: Partial<Blueprint> = {}): Blueprint => ({
  id: "x",
  path: "hombre/casual-limpio/x.jpg",
  estilo: "casual-limpio",
  clima: "templado",
  registro: "cuidado",
  ocasiones: ["diario"],
  nucleo: [
    { zona: "capa", tipo: "overshirt", detalle: "abierta, corte recto" },
    { zona: "torso", tipo: "sueter", detalle: "punto fino de cuello redondo" },
    { zona: "pierna", tipo: "chino", detalle: "caída fluida" },
    { zona: "pie", tipo: "tenis", detalle: "minimalista de piel" },
  ],
  guarnicion: [{ zona: "accesorio", tipo: "reloj", detalle: "correa oscura" }],
  zonas_no_visibles: [],
  color_relacion: "un tono profundo arriba contra base clara, un solo saturado",
  color_libre: "la capa admite cualquier oscuro apagado",
  clave: "la capa abierta deja una columna clara al centro",
  rompe: "abotonar la capa",
  ...over,
});

describe("las medidas de color, calibradas contra el clóset real de Roberto", () => {
  it("separa profundo de medio donde de verdad está la frontera", () => {
    // Los hex son los de sus prendas. El overshirt marino y el bomber negro dan
    // el contraste que un blueprint de "capa profunda" pide; el overshirt oliva
    // y la mezclilla NO, y por eso el corte va en 35 y no más arriba.
    expect(banda("#1F2A44")).toBe("profundo"); // overshirt marino
    expect(banda("#1A1A1A")).toBe("profundo"); // bomber negro
    expect(banda("#6B7A4C")).toBe("medio"); // overshirt oliva
    expect(banda("#FFFFFF")).toBe("claro"); // camiseta blanca
  });

  it("la viveza ignora si es claro u oscuro", () => {
    // Crema y carbón son opuestos en claridad y los dos son neutros: para
    // contar "cuántos colores vivos conviven" tienen que dar lo mismo, cero.
    expect(esVivo("#F5F0E8")).toBe(false); // crema
    expect(esVivo("#36454F")).toBe(false); // carbón
    expect(esVivo("#1F6B4A")).toBe(true); // esmeralda
  });

  it("no truena con hex ausente o mal escrito", () => {
    expect(claridad(undefined)).toBeNull();
    expect(viveza("no-es-un-hex")).toBeNull();
    expect(banda(null)).toBeNull();
  });
});

describe("emparejar el núcleo contra el clóset", () => {
  const closet = [
    p("Camisa overshirt marino", "#1F2A44"),
    p("Suéter crewneck carbón", "#36454F"),
    p("Chinos beige", "#C8B99C"),
    p("Tenis blancos urbanos", "#FFFFFF"),
  ];

  it("marca armable cuando cada pieza del núcleo tiene candidata", () => {
    const e = emparejarBlueprint(BP(), closet);
    expect(e.armable).toBe(true);
    expect(e.exactas).toBe(4);
  });

  it("acepta un sustituto de la MISMA zona, y lo distingue del exacto", () => {
    // Sin chinos pero con pantalón de vestir: es lo que hace un stylist de
    // verdad —"no tienes chinos, te pongo el de tela"— y es distinto de
    // sustituir entre zonas, que sí rompe el look.
    const sinChino = [...closet.slice(0, 2), p("Pantalón de vestir gris", "#8A8A8A"), closet[3]];
    const e = emparejarBlueprint(BP(), sinChino);
    expect(e.armable).toBe(true);
    expect(e.exactas).toBe(3);
    const pierna = e.piezas.find((x) => x.zona === "pierna")!;
    expect(pierna.exactas).toHaveLength(0);
    expect(pierna.deZona).toHaveLength(1);
  });

  it("NO es armable si una zona del núcleo está vacía", () => {
    const sinCalzado = closet.slice(0, 3);
    expect(emparejarBlueprint(BP(), sinCalzado).armable).toBe(false);
  });

  it("una zona NO VISIBLE no se exige — la foto venía recortada", () => {
    // El 73% de las fotos (33 de 45) tiene alguna zona sin ver. Si "no se ve"
    // contara como "no lleva", el motor armaría looks descalzos en tres de cada
    // cuatro casos.
    const sinCalzado = closet.slice(0, 3);
    const e = emparejarBlueprint(BP({ zonas_no_visibles: ["pie"] }), sinCalzado);
    expect(e.armable).toBe(true);
    expect(e.piezas.map((x) => x.zona)).not.toContain("pie");
  });

  it("la guarnición NUNCA se exige", () => {
    // Pedir el reloj de la foto convertiría cualquier emparejamiento en un no.
    const e = emparejarBlueprint(BP(), closet);
    expect(e.armable).toBe(true);
    expect(e.piezas.map((x) => x.tipo)).not.toContain("reloj");
  });
});

describe("elegir el blueprint del día", () => {
  const closet = [
    p("Camisa overshirt marino", "#1F2A44"),
    p("Suéter crewneck carbón", "#36454F"),
    p("Chinos beige", "#C8B99C"),
    p("Tenis blancos urbanos", "#FFFFFF"),
    p("Camiseta blanca", "#FFFFFF"),
    p("Jeans azul oscuro", "#2C3E50"),
    p("Mocasines negros", "#1A1A1A"),
  ];

  it("devuelve algo armable para diario/templado", () => {
    const e = elegirBlueprint({
      ocasion: "diario",
      clima: "templado",
      items: closet,
      familias: ["casual-limpio"],
      rand: () => 0.5,
    });
    expect(e).not.toBeNull();
    expect(e!.armable).toBe(true);
  });

  it("devuelve null si no hay celda — y eso NO es un fallo", () => {
    // Cuando no hay referencia que ayude, el motor arma como siempre. Es la
    // misma decisión que tomó elegirInspiracion tras perder su A/B.
    expect(
      elegirBlueprint({ ocasion: "evento", clima: "frio", items: closet, rand: () => 0.5 })
    ).toBeNull();
  });

  it("devuelve null si el clóset no da para ninguno", () => {
    expect(
      elegirBlueprint({
        ocasion: "diario",
        clima: "templado",
        items: [p("Traje de baño negro", "#1A1A1A")],
        rand: () => 0.5,
      })
    ).toBeNull();
  });

  it("respeta la rotación: no repite lo que ya se usó", () => {
    const uno = elegirBlueprint({
      ocasion: "diario",
      clima: "templado",
      items: closet,
      rand: () => 0.5,
    })!;
    const dos = elegirBlueprint({
      ocasion: "diario",
      clima: "templado",
      items: closet,
      evitar: new Set([uno.bp.path]),
      rand: () => 0.5,
    })!;
    expect(dos.bp.path).not.toBe(uno.bp.path);
  });
});

describe("el bloque del prompt", () => {
  const closet = [
    p("Camisa overshirt marino", "#1F2A44"),
    p("Suéter crewneck carbón", "#36454F"),
    p("Chinos beige", "#C8B99C"),
    p("Tenis blancos urbanos", "#FFFFFF"),
  ];

  it("lleva los ids reales del clóset, no solo tipos", () => {
    // Ésa es la ventaja sobre la foto cruda: el emparejamiento va HECHO. Sin
    // ids, el modelo tendría que cruzar 45 prendas de memoria — el fallo que ya
    // se arregló para el recetario en v32 y nunca para las fotos.
    const b = bloqueBlueprint(emparejarBlueprint(BP(), closet));
    expect(b).toContain("camisa-overshirt-marino");
    expect(b).toContain("tenis-blancos-urbanos");
  });

  it("dice que la colorimetría manda sobre el color de la referencia", () => {
    const b = bloqueBlueprint(emparejarBlueprint(BP(), closet));
    expect(b).toContain("SU COLORIMETRÍA MANDA");
    expect(b).toContain(BP().color_relacion);
  });

  it("dice que la ocasión manda sobre la referencia", () => {
    // La lección que costó el A/B de las fotos: la referencia decide la
    // combinación, NUNCA el nivel de arreglo.
    const b = bloqueBlueprint(emparejarBlueprint(BP(), closet));
    expect(b).toContain("gana la ocasión");
  });

  it("avisa de las zonas que la referencia no define", () => {
    const b = bloqueBlueprint(emparejarBlueprint(BP({ zonas_no_visibles: ["pie"] }), closet));
    expect(b).toContain("NO es que el look no las lleve");
  });
});

describe("la cerca de color: se verifica con números, no con opinión", () => {
  it("caza dos tonos vivos donde la estructura pide uno", () => {
    const reparos = revisarColorBlueprint(BP(), [
      p("Suéter esmeralda", "#1F6B4A"),
      p("Chinos rojos", "#B03A2E"),
      p("Tenis blancos", "#FFFFFF"),
    ]);
    expect(reparos.join(" ")).toContain("un solo tono vivo");
  });

  it("deja pasar un solo vivo con neutros", () => {
    const reparos = revisarColorBlueprint(BP(), [
      p("Suéter esmeralda", "#1F6B4A"),
      p("Chinos beige", "#C8B99C"),
      p("Tenis blancos", "#FFFFFF"),
    ]);
    expect(reparos.join(" ")).not.toContain("un solo tono vivo");
  });

  it("caza el look que salió entero en la misma banda", () => {
    // "Contra base clara" se pierde si todo sale oscuro: la relación que
    // sostiene el look deja de leerse.
    const reparos = revisarColorBlueprint(BP(), [
      p("Camisa overshirt marino", "#1F2A44"),
      p("Suéter crewneck carbón", "#1A1A1A"),
      p("Pantalón negro", "#101010"),
    ]);
    expect(reparos.join(" ")).toContain("contraste de claros y oscuros");
  });

  it("no inventa reparos cuando la relación se cumple", () => {
    const reparos = revisarColorBlueprint(BP(), [
      p("Camisa overshirt marino", "#1F2A44"),
      p("Camiseta blanca", "#FFFFFF"),
      p("Chinos beige", "#C8B99C"),
    ]);
    expect(reparos).toEqual([]);
  });
});

describe("una estructura, no varias", () => {
  const closet = [
    p("Camisa overshirt marino", "#1F2A44"),
    p("Suéter crewneck carbón", "#36454F"),
    p("Chinos beige", "#C8B99C"),
    p("Tenis blancos urbanos", "#FFFFFF"),
  ];

  it("pide el PRIMER look sobre la estructura y deja los otros libres", () => {
    // Al probarlo de verdad con el clóset de Roberto, el primer look siguió la
    // estructura al pie y el segundo la ignoró: el prompt decía "arma UN look
    // sobre esta estructura" y luego "ármale 2-3 outfits", y esa ambigüedad la
    // resolvía el modelo a su gusto. Ahora se dice.
    const b = bloqueBlueprint(emparejarBlueprint(BP(), closet));
    expect(b).toContain("EL PRIMER look");
    expect(b).toContain("Los otros van libres");
  });

  it("explica POR QUÉ una sola, que es la lección que costó el recetario", () => {
    // El recetario perdió su A/B inyectando DOS familias enteras a la vez y
    // pidiendo un outfit. Roberto lo formuló antes de ver el resultado: "no
    // promedies; una de las tres, o las tres".
    const b = bloqueBlueprint(emparejarBlueprint(BP(), closet));
    expect(b).toContain("el promedio de todas");
  });
});

describe("el interruptor de producción", () => {
  it("blueprintDelContexto devuelve null mientras esté apagado", () => {
    // El blueprint se shippeó encendido sin un solo juicio de Roberto, en la
    // ruta que lleva el 70% del uso real, justo después de que el recetario y
    // las fotos perdieran sus A/B. Queda apagado hasta ganar el suyo: 15-5 o
    // mejor sobre 20 pares, regla escrita antes de ver ningún veredicto.
    const closet = [
      p("Camisa overshirt marino", "#1F2A44"),
      p("Suéter crewneck carbón", "#36454F"),
      p("Chinos beige", "#C8B99C"),
      p("Tenis blancos urbanos", "#FFFFFF"),
    ];
    expect(
      blueprintDelContexto(
        { objective: "diario", items: closet, weather: null },
        "templado",
        ["casual-limpio"]
      )
    ).toBeNull();
  });

  it("pero elegirBlueprint SIGUE funcionando: el arnés tiene que poder medir", () => {
    const closet = [
      p("Camisa overshirt marino", "#1F2A44"),
      p("Suéter crewneck carbón", "#36454F"),
      p("Chinos beige", "#C8B99C"),
      p("Tenis blancos urbanos", "#FFFFFF"),
      p("Camiseta blanca", "#FFFFFF"),
    ];
    expect(
      elegirBlueprint({ ocasion: "diario", clima: "templado", items: closet, rand: () => 0.5 })
    ).not.toBeNull();
  });
});
