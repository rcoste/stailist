import { describe, expect, it } from "vitest";
import { catalogLookupKeys, catalogStorageKey, tipoCanonico } from "./capsule-images";

// EL TIPO ES LA CLAVE DE UNA BIBLIOTECA COMPARTIDA, y lo escribe un LLM en texto
// libre. Medido en `catalog_renders` el 2026-09-09: calcetin/calcetines,
// chino/chinos, botin/botines, bolsa/bolso y bailarina/balerina conviven como
// entradas distintas. Cada variante es una imagen que se paga de nuevo y una ya
// pagada que no se encuentra — Roberto lo vio como "no se auto generan las
// imágenes": su calcetín esmeralda tenía render desde agosto bajo
// `calcetines__…` y esa corrida de la cápsula dijo `calcetin__…`.

describe("tipoCanonico — plurales y sinónimos a una sola forma", () => {
  it("los pares que de verdad conviven en la biblioteca", () => {
    expect(tipoCanonico("calcetines")).toBe(tipoCanonico("calcetin"));
    expect(tipoCanonico("chinos")).toBe(tipoCanonico("chino"));
    expect(tipoCanonico("botines")).toBe(tipoCanonico("botin"));
    expect(tipoCanonico("bolso")).toBe(tipoCanonico("bolsa"));
    expect(tipoCanonico("balerina")).toBe(tipoCanonico("bailarina"));
    expect(tipoCanonico("gafas")).toBe(tipoCanonico("lentes"));
  });

  it("los MODIFICADORES se respetan: no son ruido, son otra prenda", () => {
    // Ésta es la otra mitad del día: un suéter grueso no es un suéter liso, y
    // la clave más específica es lo que evita que compartan imagen.
    expect(tipoCanonico("sueter-grueso")).not.toBe(tipoCanonico("sueter"));
    expect(tipoCanonico("camisa-lino")).not.toBe(tipoCanonico("camisa"));
    expect(tipoCanonico("chamarra-piel")).not.toBe(tipoCanonico("chamarra"));
  });

  it("canoniza la cabeza y conserva el modificador", () => {
    expect(tipoCanonico("Calcetines de lana")).toBe("calcetin-de-lana");
  });

  it("acentos y mayúsculas no hacen claves nuevas", () => {
    expect(tipoCanonico("Calcetín")).toBe(tipoCanonico("calcetin"));
  });
});

describe("catalogLookupKeys — no volver a pagar lo ya generado", () => {
  it("busca con la canónica Y con la cruda cuando difieren", () => {
    const ks = catalogLookupKeys("calcetines", "esmeralda", "hombre");
    expect(ks).toContain("calcetin__esmeralda__hombre"); // la que se guardará
    expect(ks).toContain("calcetines__esmeralda__hombre"); // la que YA existe
  });

  it("cuando no hay diferencia, una sola clave (no se duplica la consulta)", () => {
    expect(catalogLookupKeys("blazer", "marino", "hombre")).toEqual([
      "blazer__marino__hombre",
    ]);
  });

  it("lo que se GUARDA es siempre la canónica", () => {
    expect(catalogStorageKey("calcetines", "esmeralda", "hombre")).toBe(
      "calcetin__esmeralda__hombre"
    );
  });

  it("el género separa: un blazer de hombre no es uno de mujer", () => {
    expect(catalogStorageKey("blazer", "marino", "hombre")).not.toBe(
      catalogStorageKey("blazer", "marino", "mujer")
    );
  });
});
