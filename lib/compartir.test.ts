import { describe, expect, it } from "vitest";
import { datosDeCompartido } from "./compartir";

// LO QUE BLINDAN: que el evento sólo lleve valores que el admin sabe contar.

describe("datosDeCompartido", () => {
  it("acepta lo que existe", () => {
    expect(datosDeCompartido("tryon", "share")).toEqual({ que: "tryon", como: "share" });
    expect(datosDeCompartido("pasaporte", "link")).toEqual({ que: "pasaporte", como: "link" });
    expect(datosDeCompartido("viaje", "share")).toEqual({ que: "viaje", como: "share" });
  });
  it("rechaza lo desconocido en vez de guardarlo", () => {
    expect(datosDeCompartido("look", "share")).toBeNull();
    expect(datosDeCompartido("tryon", "instagram")).toBeNull();
    expect(datosDeCompartido(undefined, undefined)).toBeNull();
  });
});
