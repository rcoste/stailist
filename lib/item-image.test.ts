import { describe, it, expect } from "vitest";
import { pickItemImage, itemImageUrlSync, type ItemImageRow } from "./item-image";

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
