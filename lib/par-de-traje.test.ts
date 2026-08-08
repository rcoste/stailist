import { describe, it, expect } from "vitest";
import { parDeTraje, paresDeTraje, type PiezaConFoto, type PiezaLeida } from "./par-de-traje";

const p = (o: Partial<PiezaLeida> & { id: string }): PiezaLeida => ({ ...o });

describe("cuándo SÍ vale la pena preguntar si es traje", () => {
  it("un saco y un pantalón formal — el caso de la foto de Roberto", () => {
    expect(
      parDeTraje([
        p({ id: "s", categoria: "saco", nombre: "Saco de traje gris oscuro" }),
        p({ id: "c", categoria: "top", nombre: "Camisa blanca" }),
        p({ id: "b", categoria: "bottom", nombre: "Pantalón de vestir gris oscuro" }),
      ])
    ).toEqual({ saco: "s", pantalon: "b" });
  });

  it("el pantalón califica por formalidad aunque el nombre no lo diga", () => {
    expect(
      parDeTraje([
        p({ id: "s", categoria: "saco" }),
        p({ id: "b", categoria: "bottom", nombre: "Pantalón gris", formalidad: "formal" }),
      ])
    ).toEqual({ saco: "s", pantalon: "b" });
  });
});

describe("cuándo NO se pregunta — aquí está el valor", () => {
  it("un traje no lleva jeans", () => {
    // Sin este filtro la pregunta saldría cada vez que alguien suba un blazer
    // y unos jeans en la misma tanda, que es de lo más normal.
    expect(
      parDeTraje([
        p({ id: "s", categoria: "saco", nombre: "Blazer marino" }),
        p({ id: "b", categoria: "bottom", nombre: "Jeans azul oscuro", formalidad: "casual" }),
      ])
    ).toBeNull();
  });

  it("con dos sacos la pregunta ya no tiene UNA respuesta", () => {
    // "¿Son traje?" con dos sacos y un pantalón tiene cuatro respuestas
    // posibles. Una pregunta ambigua en un flujo de carga se contesta al azar,
    // y un lazo puesto al azar no se puede quitar: mejor no preguntar y dejar
    // que lo ate después desde la ficha.
    expect(
      parDeTraje([
        p({ id: "s1", categoria: "saco" }),
        p({ id: "s2", categoria: "saco" }),
        p({ id: "b", categoria: "bottom", formalidad: "formal" }),
      ])
    ).toBeNull();
  });

  it("un saco solo, sin pantalón, no es un par", () => {
    expect(parDeTraje([p({ id: "s", categoria: "saco" })])).toBeNull();
  });

  it("sin saco no hay traje que atar", () => {
    expect(
      parDeTraje([p({ id: "b", categoria: "bottom", formalidad: "formal" })])
    ).toBeNull();
  });
});

describe("paresDeTraje — la tanda no es el grupo, la FOTO lo es", () => {
  const q = (o: Partial<PiezaLeida> & { id: string; foto: string }) => o as PiezaConFoto;

  it("el caso de Roberto: chamarra + esmoquin + traje gris en una tanda", () => {
    // Reportado en vivo: subió las tres fotos juntas y no le preguntó NADA.
    // Antes esto devolvía null (dos sacos en la tanda ⇒ "ambiguo"), o sea que
    // entre más trajes subes, menos te pregunta.
    const pares = paresDeTraje([
      q({ id: "cuero", foto: "f1", categoria: "abrigo", nombre: "Chaqueta de cuero marrón" }),
      q({ id: "s-smk", foto: "f2", categoria: "saco", nombre: "Saco de smoking" }),
      q({ id: "b-smk", foto: "f2", categoria: "bottom", nombre: "Pantalón de smoking", formalidad: "formal" }),
      q({ id: "fajin", foto: "f2", categoria: "accesorio", nombre: "Fajín" }),
      q({ id: "s-gris", foto: "f3", categoria: "saco", nombre: "Saco cruzado gris" }),
      q({ id: "b-gris", foto: "f3", categoria: "bottom", nombre: "Pantalón de vestir gris", formalidad: "formal" }),
    ]);
    expect(pares).toEqual([
      { foto: "f2", saco: "s-smk", pantalon: "b-smk" },
      { foto: "f3", saco: "s-gris", pantalon: "b-gris" },
    ]);
  });

  it("el pantalón de OTRA foto no se puede aparear con este saco", () => {
    // Lo que la agrupación protege: un saco solo en su foto no forma par con un
    // pantalón formal que salió en otra. No son un traje, salieron de outfits
    // distintos.
    expect(
      paresDeTraje([
        q({ id: "s", foto: "f1", categoria: "saco", nombre: "Blazer marino" }),
        q({ id: "b", foto: "f2", categoria: "bottom", nombre: "Pantalón de vestir gris", formalidad: "formal" }),
      ])
    ).toEqual([]);
  });

  it("dos sacos en la MISMA foto siguen sin preguntarse", () => {
    // La guarda no se relajó: se movió a donde significa algo. Dos sacos en una
    // sola foto sí es genuinamente ambiguo.
    expect(
      paresDeTraje([
        q({ id: "s1", foto: "f1", categoria: "saco" }),
        q({ id: "s2", foto: "f1", categoria: "saco" }),
        q({ id: "b", foto: "f1", categoria: "bottom", formalidad: "formal" }),
      ])
    ).toEqual([]);
  });

  it("una foto con un traje y jeans sueltos: sigue sin ser traje", () => {
    expect(
      paresDeTraje([
        q({ id: "s", foto: "f1", categoria: "saco", nombre: "Blazer marino" }),
        q({ id: "b", foto: "f1", categoria: "bottom", nombre: "Jeans azul oscuro", formalidad: "casual" }),
      ])
    ).toEqual([]);
  });
});
