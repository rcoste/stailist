import { describe, it, expect } from "vitest";
import { parsearJson } from "./index";

// parsearJson existe por UN defecto real: Kimi K2.6 emite saltos de línea
// crudos dentro de los strings de su JSON con schema (cazado por el smoke del
// motor antes de la primera corrida multi-modelo). Estos tests fijan que el
// fallback arregla exactamente eso y nada más.

describe("parsearJson", () => {
  it("el JSON válido pasa por el parse estricto tal cual", () => {
    expect(parsearJson<{ a: string }>('{"a":"hola\\nmundo"}')).toEqual({
      a: "hola\nmundo",
    });
  });

  it("un salto de línea CRUDO dentro de un string (el bug de Kimi) se rescata como espacio", () => {
    const conCrudo = '{"analisis":"línea una\nlínea dos","n":1}';
    expect(() => JSON.parse(conCrudo)).toThrow(); // el estricto sí truena
    expect(parsearJson<{ analisis: string; n: number }>(conCrudo)).toEqual({
      analisis: "línea una línea dos",
      n: 1,
    });
  });

  it("whitespace legal entre tokens no se corrompe en el fallback", () => {
    expect(parsearJson<{ a: number }>('{\n\t"a":\r1,\n"b":"x\ty"\n}')).toEqual({
      a: 1,
      b: "x y",
    });
  });

  it("JSON de verdad roto relanza el error ORIGINAL, no uno del fallback", () => {
    expect(() => parsearJson('{"a": trunca')).toThrow(SyntaxError);
  });
});
