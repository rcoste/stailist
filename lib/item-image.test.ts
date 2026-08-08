import { describe, it, expect } from "vitest";
import {
  pickItemImage,
  itemImageUrlSync,
  itemPrivatePaths,
  conCategoria,
  subtipoDeItem,
  type ItemImageRow,
} from "./item-image";

// El orden canónico es arquetipo → render limpio → foto → prestada. Estos casos
// blindan justo lo que rompió el try-on y el pasaporte: olvidar render/prestada.
describe("pickItemImage — orden canónico", () => {
  it("arquetipo gana sobre todo", () => {
    const item: ItemImageRow = {
      archetypes: { image_path: "/archetypes/x.png" },
      render_status: "done",
      render_path: "u/r.jpg",
      photo_path: "u/p.jpg",
      attrs: { image_path: "/archetypes/borrowed.png" },
    };
    expect(pickItemImage(item)).toEqual({ kind: "public", path: "/archetypes/x.png" });
  });

  it("render limpio (done) gana sobre foto y prestada", () => {
    const item: ItemImageRow = {
      render_status: "done",
      render_path: "u/r.jpg",
      photo_path: "u/p.jpg",
      attrs: { image_path: "/archetypes/borrowed.png" },
    };
    expect(pickItemImage(item)).toEqual({ kind: "private", path: "u/r.jpg" });
  });

  it("render NO done se ignora; cae a foto", () => {
    const item: ItemImageRow = {
      render_status: "pending",
      render_path: "u/r.jpg",
      photo_path: "u/p.jpg",
    };
    expect(pickItemImage(item)).toEqual({ kind: "private", path: "u/p.jpg" });
  });

  it("prenda de 'ya lo tengo' con render: usa el render (el bug del try-on)", () => {
    const item: ItemImageRow = { render_status: "done", render_path: "u/r.jpg" };
    expect(pickItemImage(item)).toEqual({ kind: "private", path: "u/r.jpg" });
  });

  it("prenda de 'ya lo tengo' prestada: usa la prestada (no se omite)", () => {
    const item: ItemImageRow = { attrs: { image_path: "/archetypes/sueter-esmeralda.png" } };
    expect(pickItemImage(item)).toEqual({
      kind: "public",
      path: "/archetypes/sueter-esmeralda.png",
    });
  });

  it("sin ninguna fuente → null", () => {
    expect(pickItemImage({})).toBeNull();
  });
});

describe("itemImageUrlSync — construcción de URL", () => {
  const signed = (p: string) => (p === "u/r.jpg" ? "https://signed/r" : null);

  it("pública sin prefijo: ruta tal cual", () => {
    const item: ItemImageRow = { attrs: { image_path: "/archetypes/x.png" } };
    expect(itemImageUrlSync(item, signed)).toBe("/archetypes/x.png");
  });

  it("pública con prefijo origin (server fetch)", () => {
    const item: ItemImageRow = { archetypes: { image_path: "/archetypes/x.png" } };
    expect(itemImageUrlSync(item, signed, "https://stailist.co")).toBe(
      "https://stailist.co/archetypes/x.png"
    );
  });

  it("privada: la firma del map", () => {
    const item: ItemImageRow = { render_status: "done", render_path: "u/r.jpg" };
    expect(itemImageUrlSync(item, signed)).toBe("https://signed/r");
  });

  it("privada sin firma disponible → null", () => {
    const item: ItemImageRow = { photo_path: "u/missing.jpg" };
    expect(itemImageUrlSync(item, signed)).toBeNull();
  });
});

describe("subtipo — el tipo fino que hereda del catálogo (v38)", () => {
  const delCatalogo = (subArq: string | null, subPropio?: string): ItemImageRow => ({
    attrs: subPropio ? ({ subtipo: subPropio } as never) : ({} as never),
    archetypes: { name: "Tenis", category: "calzado", attrs: { subtipo: subArq } },
  });

  it("lo hereda del arquetipo cuando la prenda no lo trae", () => {
    // 645 de las 953 prendas de la base vienen del catálogo y NO copian el
    // subtipo. Sin herencia, el motor no vería "derby" ni "cruzado" en dos
    // tercios del clóset — que es justo el hueco que el subtipo vino a tapar.
    expect(subtipoDeItem(delCatalogo("chelsea"))).toBe("chelsea");
  });

  it("lo que la prenda declara le gana al arquetipo", () => {
    // Si la persona corrigió el subtipo de SU prenda, ese es el bueno.
    expect(subtipoDeItem(delCatalogo("chelsea", "chukka"))).toBe("chukka");
  });

  it("sin subtipo en ningún lado, null", () => {
    expect(subtipoDeItem(delCatalogo(null))).toBeNull();
  });

  it("conCategoria lo deja puesto en attrs, junto con la categoría", () => {
    // ESTE es el test que faltaba: subtipoDeItem funcionaba y conCategoria no
    // lo llamaba, así que el motor veía 24 de 113 en vez de 69 — y nada
    // truena cuando eso pasa, sólo empeora en silencio.
    const [r] = conCategoria([delCatalogo("chelsea")]);
    expect((r.attrs as { subtipo?: string }).subtipo).toBe("chelsea");
    expect((r.attrs as { categoria?: string }).categoria).toBe("calzado");
  });

  it("una prenda sin nada que heredar se devuelve intacta", () => {
    const item: ItemImageRow = { attrs: { image_path: "/x.png" } };
    expect(conCategoria([item])[0]).toBe(item);
  });
});

// LO QUE SE FIRMA Y LO QUE SE MUESTRA TIENEN QUE SER LA MISMA COSA.
//
// Estos casos existen porque el desbalance no se ve: firmar una URL de más no
// rompe nada, sólo le pide a Storage el doble de trabajo en cada clóset que se
// abre. Y firmar una de MENOS deja la prenda sin imagen, que sí se ve — pero
// sólo en la pantalla, nunca en un test, si nadie ata las dos funciones.
describe("itemPrivatePaths — exactamente lo que pickItemImage va a usar", () => {
  const casos: { nombre: string; item: ItemImageRow }[] = [
    {
      nombre: "render y foto (toda prenda nueva del carrete)",
      item: { render_status: "done", render_path: "u/r.jpg", photo_path: "u/p.jpg", attrs: {} },
    },
    {
      nombre: "sólo foto (el flujo de una prenda)",
      item: { render_status: null, render_path: null, photo_path: "u/p.jpg", attrs: {} },
    },
    {
      nombre: "render fallido pero con foto",
      item: { render_status: "failed", render_path: null, photo_path: "u/p.jpg", attrs: {} },
    },
    {
      nombre: "arquetipo, aunque arrastre foto y render",
      item: {
        archetypes: { image_path: "/archetypes/x.png" },
        render_status: "done",
        render_path: "u/r.jpg",
        photo_path: "u/p.jpg",
        attrs: {},
      },
    },
    {
      nombre: "prestada",
      item: {
        render_status: null,
        render_path: null,
        photo_path: null,
        attrs: { image_path: "/archetypes/borrowed.png" },
      },
    },
    { nombre: "sin nada", item: { render_status: null, render_path: null, attrs: {} } },
  ];

  for (const { nombre, item } of casos) {
    it(`${nombre}: firma ni una ruta de más ni una de menos`, () => {
      const pick = pickItemImage(item);
      const esperado = pick?.kind === "private" ? [pick.path] : [];
      expect(itemPrivatePaths(item)).toEqual(esperado);
    });
  }

  it("una prenda del carrete firma UNA ruta, no dos", () => {
    // El caso concreto que se corrigió: con render y foto se firmaban las dos y
    // la de la foto no se muestra nunca.
    expect(
      itemPrivatePaths({
        render_status: "done",
        render_path: "u/r.jpg",
        photo_path: "u/p.jpg",
        attrs: {},
      })
    ).toEqual(["u/r.jpg"]);
  });
});
