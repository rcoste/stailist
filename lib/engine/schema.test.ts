import { describe, it, expect } from "vitest";
import { buildOutfitSchema } from "./schema";

describe("buildOutfitSchema — campo analisis (borrador de razonamiento v21)", () => {
  const schema = buildOutfitSchema(["id-1", "id-2"]);

  it('"analisis" va PRIMERO en properties (el orden es el truco: el modelo lo genera antes que los outfits)', () => {
    expect(Object.keys(schema.properties)[0]).toBe("analisis");
  });

  it('"analisis" es requerido junto con "outfits"', () => {
    expect(schema.required).toEqual(["analisis", "outfits"]);
  });

  it("los item_ids siguen amarrados al enum del clóset (la falla #1 del alfa)", () => {
    expect(schema.properties.outfits.items.properties.item_ids.items.enum).toEqual([
      "id-1",
      "id-2",
    ]);
  });
});
