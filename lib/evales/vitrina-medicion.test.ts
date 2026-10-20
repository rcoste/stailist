// LA MEDICIÓN EN SECO DE LA VITRINA — lo que se blinda es que la medición mida
// LO MISMO que produce la vitrina: los huecos son los de la página del viaje,
// las "elegidas" son las de `elegirPrendas` (no una copia), y los motivos de
// descarte siguen el orden real de los filtros. Si alguien cambia la vitrina
// y la medición no lo refleja, los números de la pantalla mienten en silencio.
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/uniqlo-us-sweater.json";
import type { CapsuleMatch, CapsuleTarget } from "@/lib/capsule";
import { elegirPrendas, type UniqloItem } from "@/lib/vitrina-uniqlo";
import { armarCandidatos, huecosDeViaje, motivoDescarte, muestraDeHuecos, pct, resumenMedicion, type VotoFila } from "./vitrina-medicion";
import { textoJuezVitrina } from "./juez-vitrina";

const items = fixture.result.items as unknown as UniqloItem[];

const item = (nombre: string, tipo: string, colorFamilia: string): CapsuleTarget["items"][number] =>
  ({
    nombre,
    tipo,
    colorFamilia,
    category: "top",
    formalidad: "casual",
    temporada: "frio",
    prioridad: 1,
    porque: "porque sí",
    visual: "de lana, cuello redondo",
  }) as unknown as CapsuleTarget["items"][number];

describe("huecosDeViaje: los mismos huecos que pinta la maleta", () => {
  const target = {
    items: [
      item("Suéter gris carbón", "sueter", "gris carbón"),
      item("Camisa blanca", "camisa", "blanco"),
      item("Jeans negros", "jeans", "negro"),
      item("Cinturón de piel", "cinturon", "café"),
      item("Mocasines", "mocasin", "café"),
    ],
  } as unknown as CapsuleTarget;
  const match = {
    entries: [
      { status: "falta", by: null },
      { status: "tienes", by: "Camisa de lino" },
      { status: "falta", by: null },
      { status: "falta", by: null },
      { status: "falta", by: null },
    ],
  } as unknown as CapsuleMatch;

  it("sólo lo que falta, y lo que ya se sacó del viaje o se sustituyó no cuenta", () => {
    const huecos = huecosDeViaje(target, match, { "fuera:3": "no lo necesito", "sub:2": "Jeans viejos" } as never, "hombre");
    expect(huecos.map((h) => h.itemIndex)).toEqual([0, 4]);
    expect(huecos[0]).toMatchObject({ nombre: "Suéter gris carbón", segmento: "hombre", colorFamilia: "gris carbón", termino: "sweater" });
  });

  it("un tipo que la vitrina no sabe buscar lleva termino null (se cuenta, no se consulta)", () => {
    const huecos = huecosDeViaje(target, match, null, "hombre");
    expect(huecos.find((h) => h.tipo === "mocasin")?.termino).toBeNull();
  });
});

describe("armarCandidatos: los 20 tal cual, con las dos de producción marcadas", () => {
  it("las elegidas son exactamente las de elegirPrendas y el resto trae su motivo", () => {
    const hueco = { segmento: "mujer" as const, colorFamilia: "gris carbón" };
    const out = armarCandidatos(items, hueco, "us");
    const prod = elegirPrendas(items, hueco, "us").map((p) => p.id);
    expect(out).toHaveLength(items.length);
    expect(out.filter((c) => c.elegida).map((c) => `us:${c.productId}:${c.displayCode}`)).toEqual(prod);
    const porId = Object.fromEntries(out.map((c) => [c.productId, c]));
    // El de hombre y el de niños caen por género; los de mujer en DARK GRAY que
    // no quedaron entre las dos, por calificación.
    expect(porId["E450543-000"].motivo).toBe("genero");
    expect(porId["E486665-000"].motivo).toBe("genero");
    expect(porId["E465734-000"].motivo).toBe("rating");
    expect(porId["E487939-000"].motivo).toBe("rating");
    for (const c of out.filter((x) => x.elegida)) expect(c.motivo).toBeNull();
  });

  it("sin el color de la familia enseña el primer color del producto y lo dice", () => {
    const out = armarCandidatos(items, { segmento: "mujer", colorFamilia: "rojo" }, "us");
    const souffle = out.find((c) => c.productId === "E485310-000")!;
    expect(souffle.motivo).toBe("sin-color");
    expect(souffle.color).toBe("PINK");
    expect(souffle.foto?.startsWith("https://image.uniqlo.com/UQ/")).toBe(true);
    expect(souffle.url).toContain("colorDisplayCode=");
  });

  it("conserva el orden de la API y el precio formateado del mercado", () => {
    const out = armarCandidatos(items, { segmento: "hombre", colorFamilia: "negro" }, "us");
    expect(out.map((c) => c.orden)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(out[0].precioTexto).toBe("US$99.90");
  });
});

describe("motivoDescarte sigue el orden de los filtros de producción", () => {
  it("género antes que color: un suéter de hombre en el color correcto cae por género para una mujer", () => {
    const men = items.find((i) => i.genderCategory === "MEN")!;
    expect(motivoDescarte(men, { segmento: "mujer", colorFamilia: "gris carbón" })).toBe("genero");
    expect(motivoDescarte(men, { segmento: "hombre", colorFamilia: "gris carbón" })).toBeNull();
    expect(motivoDescarte(men, { segmento: "hombre", colorFamilia: "rosa" })).toBe("sin-color");
  });
});

describe("con término (v0.2.402.2): ropa interior y nombre que no dice la prenda, en ese orden", () => {
  const prenda = (productId: string, name: string, genderCategory = "MEN"): UniqloItem => ({
    productId,
    name,
    genderCategory,
    colors: [{ name: "BLACK", displayCode: "09" }],
    prices: { base: { value: 29.9 } },
    rating: { average: 4.5 },
    images: { main: { "09": { image: "https://image.uniqlo.com/UQ/x.jpg" } } },
  });
  const items = [
    prenda("A", "Striped Boxer Briefs"),
    prenda("B", "Short Sleeve T-Shirt"),
    prenda("C", "Linen Blend Shorts"),
    prenda("D", "Sweat Shorts", "WOMEN"),
  ];
  const hueco = { segmento: "hombre" as const, colorFamilia: "negro", termino: "linen shorts" };

  it("los motivos siguen el orden real de los filtros y las elegidas son las de producción", () => {
    const out = armarCandidatos(items, hueco, "us");
    const porId = Object.fromEntries(out.map((c) => [c.productId, c]));
    expect(porId.A.motivo).toBe("ropa-interior");
    expect(porId.B.motivo).toBe("nombre-no-coincide");
    expect(porId.D.motivo).toBe("genero");
    expect(porId.C.elegida).toBe(true);
    expect(out.filter((c) => c.elegida).map((c) => c.productId)).toEqual(elegirPrendas(items, hueco, "us").map((p) => p.id.split(":")[1]));
  });

  it("v0.2.402.3: temporada, manga y piel, con el nombre de la pieza", () => {
    const vestido = prenda("V", "Linen Blend Dress", "WOMEN");
    expect(motivoDescarte(vestido, { segmento: "mujer", colorFamilia: "negro", termino: "midi dress", nombre: "Vestido midi rubí", temporada: "frio" })).toBe("temporada");
    const camisa = prenda("S", "Oxford Shirt");
    expect(motivoDescarte(camisa, { segmento: "hombre", colorFamilia: "negro", termino: "short sleeve shirt", nombre: "Camisa de manga corta negra" })).toBe("manga");
    const bolsa = prenda("G", "Nylon Shoulder Bag", "WOMEN");
    expect(motivoDescarte(bolsa, { segmento: "mujer", colorFamilia: "negro", termino: "crossbody bag", nombre: "Bolsa cruzada de piel negra" })).toBe("material");
  });

  it("sin término (corridas anteriores a v0.2.402.2) no se aplica el filtro de nombre", () => {
    expect(motivoDescarte(items[1], { segmento: "hombre", colorFamilia: "negro" })).toBeNull();
  });
});

describe("muestraDeHuecos: cuatro huecos distintos, no cuatro suéteres", () => {
  const h = (tipo: string, segmento: "hombre" | "mujer", termino: string | null = "x") => ({ tipo, segmento, termino });
  it("alterna segmento, no repite la cabeza del tipo y salta lo que no se puede buscar", () => {
    const huecos = [h("sueter", "mujer"), h("sueter-grueso", "mujer"), h("mocasin", "hombre", null), h("jeans", "hombre"), h("camisa", "hombre"), h("vestido", "mujer")];
    const m = muestraDeHuecos(huecos, 4);
    expect(m.map((x) => x.tipo)).toEqual(["sueter", "jeans", "vestido", "camisa"]);
  });
  it("si no alcanzan los tipos distintos, completa con lo que haya; nunca más de n", () => {
    expect(muestraDeHuecos([h("sueter", "mujer"), h("sueter", "mujer")], 4)).toHaveLength(2);
    expect(muestraDeHuecos([h("a", "mujer"), h("b", "mujer"), h("c", "mujer")], 2)).toHaveLength(2);
  });
});

describe("resumenMedicion: los tres números", () => {
  const filas: VotoFila[] = [
    // hueco 1: la vitrina eligió dos; Roberto aprobó una; el juez coincide en 3 de 4
    { huecoN: 1, elegida: true, juez: true, roberto: true },
    { huecoN: 1, elegida: true, juez: false, roberto: false },
    { huecoN: 1, elegida: false, juez: true, roberto: false },
    { huecoN: 1, elegida: false, juez: false, roberto: false },
    // hueco 2: nada elegido correcto, pero un descartado sí era la pieza → cuenta en el techo
    { huecoN: 2, elegida: true, juez: false, roberto: false },
    { huecoN: 2, elegida: false, juez: false, roberto: true },
    // hueco 3: sin votos de Roberto todavía
    { huecoN: 3, elegida: true, juez: true, roberto: null },
  ];

  it("cuenta elecciones aprobadas, acuerdo y techo sin mezclar lo no votado", () => {
    const r = resumenMedicion(filas, 3);
    expect(r.elegidas).toEqual({ total: 4, votadas: 3, aprobadas: 1 });
    expect(r.acuerdo).toEqual({ comparables: 6, coinciden: 4 });
    expect(r.techo).toEqual({ roberto: 2, juez: 2, huecos: 3, huecosSinVoto: 1 });
    expect(r.calificados).toEqual({ votados: 6, total: 7 });
  });

  it("pct no divide entre cero", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(0, 0)).toBeNull();
  });
});

describe("textoJuezVitrina: la pregunta lleva lo que el criterio necesita", () => {
  it("nombre, color, precio del candidato y temporada/formalidad del hueco", () => {
    const t = textoJuezVitrina(
      { nombre: "Vestido midi rubí", segmento: "mujer", colorFamilia: "rubí", temporada: "frio", formalidad: "arreglado", visual: "de punto", porque: "cena" },
      { nombre: "Linen Blend Dress", color: "WINE", precioTexto: "US$49.90", genero: "WOMEN" }
    );
    for (const s of ["Vestido midi rubí", "Temporada: frio", "Formalidad: arreglado", "Linen Blend Dress", "Color: WINE", "Precio: US$49.90"]) {
      expect(t).toContain(s);
    }
  });
});
