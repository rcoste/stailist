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
