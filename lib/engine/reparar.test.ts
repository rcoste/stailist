import { describe, it, expect } from "vitest";
import { repararEnCodigo } from "./reparar";
import type { EngineItem } from "./prompt";

// La idea es de Roberto: "muchas de las cosas que fallaban era nada más 'ay, te
// faltó esto'. Es como decir 'te faltó ponerte calzones' — no es que tengas que
// cambiarte toda la ropa porque no traes calzones."
//
// Lo que estos tests protegen es justo eso: que el arreglo sea QUIRÚRGICO (una
// prenda) y que NUNCA empeore.

const it_ = (
  id: string,
  categoria: string,
  nombre: string,
  extra: Record<string, unknown> = {}
): EngineItem =>
  ({ id, attrs: { categoria, nombre, tipo: nombre, ...extra } }) as unknown as EngineItem;

const HOMBRE = { gender: "hombre" as const };

describe("añadir lo que faltaba, sin tocar el resto", () => {
  const SUETER = it_("s", "top", "Suéter de lana negro", { color_hex: "#111111" });
  const JEANS = it_("j", "bottom", "Jeans azul oscuro", { color_hex: "#2A3B5C" });
  const BOTINES = it_("b", "calzado", "Botines Chelsea negros", {
    color_hex: "#111111",
    material: "piel",
  });
  const CAMISETA = it_("c", "top", "Camiseta blanca", { color: "blanco", color_hex: "#FFFFFF" });

  it("el suéter a piel se arregla AÑADIENDO la camiseta, sin cambiar nada más", () => {
    const closet = [SUETER, JEANS, BOTINES, CAMISETA];
    const r = repararEnCodigo(["s", "j", "b"], closet, { closet, ...HOMBRE });

    expect(r.hechas).toHaveLength(1);
    expect(r.hechas[0]).toMatchObject({ regla: "sueter-sin-base", como: "anadida" });
    // Lo que ya estaba sigue estando: eso es lo que separa "corregir" de
    // "rehacer", que es toda la diferencia que pidió Roberto.
    for (const id of ["s", "j", "b"]) expect(r.itemIds).toContain(id);
    expect(r.itemIds).toContain("c");
    expect(r.itemIds).toHaveLength(4);
  });

  it("elige la base NEUTRA, no la de color", () => {
    // Meter una camisa de color a un look ya armado sería arreglar una regla
    // rompiendo el criterio de otra.
    const roja = it_("r", "top", "Camisa roja", { color: "rojo", color_hex: "#B22222" });
    const closet = [SUETER, JEANS, BOTINES, roja, CAMISETA];
    const r = repararEnCodigo(["s", "j", "b"], closet, { closet, ...HOMBRE });
    expect(r.itemIds).toContain("c");
    expect(r.itemIds).not.toContain("r");
  });

  it("si el clóset NO tiene base, no inventa nada y lo deja para el juez", () => {
    const closet = [SUETER, JEANS, BOTINES];
    const r = repararEnCodigo(["s", "j", "b"], closet, { closet, ...HOMBRE });
    expect(r.hechas).toHaveLength(0);
    expect(r.itemIds).toEqual(["s", "j", "b"]);
  });
});

describe("sustituir el calzado: mismo rol, otra pieza", () => {
  it("en lluvia cambia el mocasín por el botín, y solo esa prenda", () => {
    const mocasin = it_("m", "calzado", "Mocasines de piel café", {
      color_hex: "#5C4433",
      material: "ante",
    });
    const botin = it_("b", "calzado", "Botines Chelsea negros", {
      color_hex: "#111111",
      material: "piel",
    });
    const camiseta = it_("c", "top", "Camiseta blanca", { color: "blanco", color_hex: "#FFFFFF" });
    const jeans = it_("j", "bottom", "Jeans azul oscuro", { color_hex: "#2A3B5C" });
    const closet = [mocasin, botin, camiseta, jeans];

    const r = repararEnCodigo(["c", "j", "m"], closet, {
      closet,
      lluvia: true,
      paraguas: false,
      clima: "templado",
      ...HOMBRE,
    });
    expect(r.hechas[0]).toMatchObject({ como: "sustituida" });
    expect(r.itemIds).toContain("b");
    expect(r.itemIds).not.toContain("m");
    // El resto intacto.
    expect(r.itemIds).toContain("c");
    expect(r.itemIds).toContain("j");
  });
});

describe("lo que NO toca, a propósito", () => {
  it("el traje desparejado se deja al juez: elegir CUÁL pantalón es criterio", () => {
    const saco = it_("s", "saco", "Blazer marino", { color_hex: "#27425F" });
    const pant = it_("p", "bottom", "Pantalón de vestir marino", { color_hex: "#27425F" });
    const camisa = it_("c", "top", "Camisa blanca", { color: "blanco", color_hex: "#FFFFFF" });
    const closet = [saco, pant, camisa];
    const r = repararEnCodigo(["s", "p", "c"], closet, { closet, ...HOMBRE });
    expect(r.hechas).toHaveLength(0);
    expect(r.itemIds).toEqual(["s", "p", "c"]);
  });

  it("un look limpio no se toca", () => {
    const closet = [
      it_("c", "top", "Camiseta blanca", { color: "blanco", color_hex: "#FFFFFF" }),
      it_("j", "bottom", "Jeans azul oscuro", { color_hex: "#2A3B5C" }),
      it_("b", "calzado", "Botines Chelsea negros", { color_hex: "#111111", material: "piel" }),
    ];
    const r = repararEnCodigo(["c", "j", "b"], closet, { closet, ...HOMBRE });
    expect(r.hechas).toHaveLength(0);
  });

  it("para MUJER el suéter a piel no es violación, así que no añade nada", () => {
    const closet = [
      it_("s", "top", "Suéter de lana negro", { color_hex: "#111111" }),
      it_("j", "bottom", "Jeans azul oscuro", { color_hex: "#2A3B5C" }),
      it_("c", "top", "Camiseta blanca", { color: "blanco", color_hex: "#FFFFFF" }),
    ];
    const r = repararEnCodigo(["s", "j"], closet, { closet, gender: "mujer" });
    expect(r.hechas).toHaveLength(0);
  });
});

describe("cueros-que-no-se-hablan — el accesorio se alinea con el calzado, o se va", () => {
  // El caso que Roberto confirmó CINCO veces calificando al juez ("Agree, no
  // va café con negro"): cinturón negro con mocasines burdeos. El juez de
  // producción lo reparaba 3 de 7 veces; ahora lo arregla el código.
  const CAMISA = it_("ca", "top", "Camisa de lino blanca", { color_hex: "#FAFAF7" });
  const CHINOS = it_("ch", "bottom", "Chinos azul marino", { color_hex: "#27425F" });
  const MOCASINES = it_("mo", "calzado", "Mocasines burdeos", {
    color_hex: "#5C2A2E",
    material: "piel",
  });
  const CINT_NEGRO = it_("cn", "accesorio", "Cinturón negro", {
    color_hex: "#1A1A1A",
    material: "piel",
  });
  const CINT_CAFE = it_("cc", "accesorio", "Cinturón café", {
    color_hex: "#5A3826",
    material: "piel",
  });

  it("cambia el cinturón por el del color del calzado si el clóset lo tiene", () => {
    // Mocasines negros con cinturón café: el clóset tiene el cinturón negro,
    // así que "negro con negro" — la receta que la regla cita.
    const MOCASINES_NEGROS = it_("mn", "calzado", "Mocasines negros", {
      color_hex: "#1A1A1E",
      material: "piel",
    });
    const look = [CAMISA.id, CHINOS.id, MOCASINES_NEGROS.id, CINT_CAFE.id];
    const closet = [CAMISA, CHINOS, MOCASINES_NEGROS, CINT_CAFE, CINT_NEGRO];
    const r = repararEnCodigo(look, closet, HOMBRE);
    expect(r.hechas).toEqual([
      {
        regla: "cueros-que-no-se-hablan",
        como: "sustituida",
        entro: "Cinturón negro",
        salio: "Cinturón café",
      },
    ]);
    expect(r.itemIds).toContain(CINT_NEGRO.id);
    expect(r.itemIds).not.toContain(CINT_CAFE.id);
  });

  it("sin otro cinturón, lo retira: un look sin cinturón está bien", () => {
    const look = [CAMISA.id, CHINOS.id, MOCASINES.id, CINT_NEGRO.id];
    const closet = [CAMISA, CHINOS, MOCASINES, CINT_NEGRO];
    const r = repararEnCodigo(look, closet, HOMBRE);
    expect(r.hechas).toEqual([
      { regla: "cueros-que-no-se-hablan", como: "quitada", salio: "Cinturón negro" },
    ]);
    expect(r.itemIds).toEqual([CAMISA.id, CHINOS.id, MOCASINES.id]);
  });

  it("el calzado NUNCA es lo que se toca", () => {
    const look = [CAMISA.id, CHINOS.id, MOCASINES.id, CINT_NEGRO.id];
    const r = repararEnCodigo(look, [CAMISA, CHINOS, MOCASINES, CINT_NEGRO, CINT_CAFE], HOMBRE);
    expect(r.itemIds).toContain(MOCASINES.id);
  });

  // Dos calzados chocando entre sí (raro, pero posible) sí es criterio: no hay
  // accesorio que mover. Sigue su camino al juez.
  it("un choque entre dos calzados no se toca en código", () => {
    const BOTAS = it_("bo", "calzado", "Botines de cuero marrón", {
      color_hex: "#5A3826",
      material: "piel",
    });
    const NEGROS = it_("zn", "calzado", "Zapato formal negro", {
      color_hex: "#1A1A1E",
      material: "piel",
    });
    const r = repararEnCodigo([CAMISA.id, CHINOS.id, BOTAS.id, NEGROS.id], [CAMISA, CHINOS, BOTAS, NEGROS], HOMBRE);
    expect(r.hechas).toEqual([]);
  });

  it("cinturón que SÍ va con el calzado no se toca", () => {
    // Dos cafés reales del catálogo: derby chocolate con cinturón café.
    const DERBY = it_("de", "calzado", "Zapato derby de piel chocolate", {
      color_hex: "#4B3526",
      material: "piel",
    });
    const look = [CAMISA.id, CHINOS.id, DERBY.id, CINT_CAFE.id];
    const r = repararEnCodigo(look, [CAMISA, CHINOS, DERBY, CINT_CAFE, CINT_NEGRO], HOMBRE);
    expect(r.hechas).toEqual([]);
  });
});

describe("reloj deportivo y corbata de punto — nacen con reparación", () => {
  const CAMISA = it_("cb", "top", "Camisa blanca", { color_hex: "#FFFFFF" });
  const SACO = it_("st", "saco", "Saco de traje negro", { color_hex: "#1A1A1E" });
  const PANT = it_("pt", "bottom", "Pantalón de traje negro", { color_hex: "#1A1A1E" });
  const ZAPATO = it_("zf", "calzado", "Zapato formal negro", { color_hex: "#1A1A1E", material: "piel" });
  const RELOJ_DEP = it_("rd", "accesorio", "Reloj negro", { formalidad: "casual", color_hex: "#1A1A1A" });
  // Plateado y no "de piel café": con zapatos negros, un reloj de correa café
  // metería una violación de cueros — y el guard del reparador lo rechaza
  // (comprobado: la primera versión de este fixture usaba el café y el
  // reparador, correctamente, prefería quitar el deportivo a ese cambio).
  const RELOJ_VESTIR = it_("rv", "accesorio", "Reloj plateado", {
    formalidad: "formal-casual",
    color_hex: "#B9BDC1",
  });
  const C_PUNTO = it_("cp", "accesorio", "Corbata de punto marino", { color_hex: "#26344F" });
  const C_SEDA = it_("cs", "accesorio", "Corbata de seda marino", { color_hex: "#26344F" });
  const FORMAL = { gender: "hombre" as const, formality: "formal" };

  it("cambia el reloj deportivo por el de vestir si existe", () => {
    const look = [CAMISA.id, SACO.id, PANT.id, ZAPATO.id, RELOJ_DEP.id];
    const closet = [CAMISA, SACO, PANT, ZAPATO, RELOJ_DEP, RELOJ_VESTIR];
    const r = repararEnCodigo(look, closet, FORMAL);
    expect(r.hechas).toContainEqual({
      regla: "reloj-deportivo-con-sastre",
      como: "sustituida",
      entro: "Reloj plateado",
      salio: "Reloj negro",
    });
  });

  it("sin reloj de vestir, lo quita: muñeca desnuda antes que equivocada", () => {
    const look = [CAMISA.id, SACO.id, PANT.id, ZAPATO.id, RELOJ_DEP.id];
    const r = repararEnCodigo(look, [CAMISA, SACO, PANT, ZAPATO, RELOJ_DEP], FORMAL);
    expect(r.hechas).toContainEqual({
      regla: "reloj-deportivo-con-sastre",
      como: "quitada",
      salio: "Reloj negro",
    });
  });

  // LA EXCEPCIÓN DE ROBERTO: "podría hacer una excepción para smart watch en
  // un día normal". Sin sastre y sin formalidad formal, el reloj se queda.
  it("en un look casual el reloj deportivo NO se toca", () => {
    const CHINOS = it_("chb", "bottom", "Chinos beige", { color_hex: "#C4B393" });
    const TENIS = it_("tb", "calzado", "Tenis blancos", { color_hex: "#F5F5F5" });
    const r = repararEnCodigo(
      [CAMISA.id, CHINOS.id, TENIS.id, RELOJ_DEP.id],
      [CAMISA, CHINOS, TENIS, RELOJ_DEP, RELOJ_VESTIR],
      { gender: "hombre" }
    );
    expect(r.hechas).toEqual([]);
  });

  it("cambia la corbata de punto por la de seda en ceremonia", () => {
    const look = [CAMISA.id, SACO.id, PANT.id, ZAPATO.id, C_PUNTO.id];
    const closet = [CAMISA, SACO, PANT, ZAPATO, C_PUNTO, C_SEDA];
    const r = repararEnCodigo(look, closet, FORMAL);
    expect(r.hechas).toContainEqual({
      regla: "corbata-de-punto-en-ceremonia",
      como: "sustituida",
      entro: "Corbata de seda marino",
      salio: "Corbata de punto marino",
    });
  });

  // La ceremonia PIDE corbata: sin otra en el clóset, quitarla arreglaría la
  // regla rompiendo el pedido. Se queda y el hallazgo sigue su camino al juez.
  it("sin otra corbata NO la quita", () => {
    const look = [CAMISA.id, SACO.id, PANT.id, ZAPATO.id, C_PUNTO.id];
    const r = repararEnCodigo(look, [CAMISA, SACO, PANT, ZAPATO, C_PUNTO], FORMAL);
    const deCorbata = r.hechas.filter((h) => h.regla === "corbata-de-punto-en-ceremonia");
    expect(deCorbata).toEqual([]);
    expect(r.itemIds).toContain(C_PUNTO.id);
  });
});
