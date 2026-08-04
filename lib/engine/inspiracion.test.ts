import { describe, it, expect } from "vitest";
import { INSTRUCCION_INSPIRACION } from "./inspiracion";

// elegirInspiracion pide un cliente de Supabase, así que aquí se prueba la
// instrucción — que es donde vive la decisión de diseño que Roberto peleó.
describe("la instrucción de inspiración", () => {
  it("pide UN look por foto, no un promedio de las tres", () => {
    // Roberto: "si me gustan minimalista, coreano e hipster, ahí no vas a
    // promediar y hacer una quimera de estilo; la respuesta es una de las tres,
    // o las tres". Un promedio de tres estilos no es un estilo — es un look que
    // no es de ninguno. En el piloto original generaban tres a la vez y eso era
    // parte de por qué funcionaba.
    expect(INSTRUCCION_INSPIRACION).toContain("UNA FOTO POR LOOK");
    expect(INSTRUCCION_INSPIRACION).toContain("NO mezcles las tres");
    expect(INSTRUCCION_INSPIRACION.toLowerCase()).toContain("promediarlos");
  });

  it("dice que el color de la foto no se copia", () => {
    // "Aunque esa foto traiga polo azul, para ese polo podría ser perfectamente
    // verde": de la referencia se toma la estructura, no el color, y la
    // colorimetría de la persona manda.
    expect(INSTRUCCION_INSPIRACION).toContain("NO ES LITERAL");
    expect(INSTRUCCION_INSPIRACION).toContain("colorimetría manda");
  });

  it("permite ignorar una foto que no se puede acercar", () => {
    // Sin esta salida, un modelo con tres fotos enfrente fuerza prendas para
    // parecerse a ellas — que es de donde salen los Frankenstein.
    expect(INSTRUCCION_INSPIRACION).toContain("IGNORA esa foto");
  });

  it("las prendas SIEMPRE son del clóset real", () => {
    expect(INSTRUCCION_INSPIRACION).toContain("REGLA DURA");
    expect(INSTRUCCION_INSPIRACION).toContain("jamás uses ni menciones una prenda");
  });
});
