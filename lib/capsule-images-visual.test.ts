import { describe, it, expect } from "vitest";
import { catalogKeyDePieza, catalogKeysParaBuscar, catalogStorageKey } from "@/lib/capsule-images";

describe("la imagen de una pieza con descripción propia", () => {
  it("un básico sin descripción sigue usando la imagen compartida de su tipo y color", () => {
    expect(catalogKeyDePieza("playera", "blanco", "mujer", null)).toBe(catalogStorageKey("playera", "blanco", "mujer"));
    expect(catalogKeyDePieza("playera", "blanco", "mujer", "  ")).toBe(catalogStorageKey("playera", "blanco", "mujer"));
  });
  it("con descripción, la llave es otra: no recibe la blusa genérica de julio", () => {
    const generica = catalogStorageKey("blusa", "rubi", "mujer");
    const propia = catalogKeyDePieza("blusa", "rubi", "mujer", "blusa de satén con cuello caído, manga recta y caída fluida");
    expect(propia).not.toBe(generica);
    expect(propia.startsWith(`${generica}__v`)).toBe(true);
    expect(catalogKeysParaBuscar("blusa", "rubi", "mujer", "blusa de satén con cuello caído")).not.toContain(generica);
  });
  it("es estable y no distingue mayúsculas ni espacios de los bordes", () => {
    const a = catalogKeyDePieza("blusa", "rubi", "mujer", "Blusa de satén con cuello caído");
    const b = catalogKeyDePieza("blusa", "rubi", "mujer", "  blusa de satén con cuello caído ");
    expect(a).toBe(b);
    expect(catalogKeyDePieza("blusa", "rubi", "mujer", "otra cosa")).not.toBe(a);
  });
});
