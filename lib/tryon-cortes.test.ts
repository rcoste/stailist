import { describe, expect, it } from "vitest";
import { cortesParaPrompt } from "@/lib/tryon";

// "Tengo unos rectos pero holgados y me los da todos skinny" (usuario real,
// 2026-11-12). El corte estaba bien guardado; lo que faltaba era decírselo al
// modelo de imagen. Medido antes de publicar: 4 de 4 pantalones rectos salían
// afilados con la instrucción vieja y rectos con la nueva.
describe("cortesParaPrompt", () => {
  it("al pantalón recto le dice que no lo afile", () => {
    const [linea] = cortesParaPrompt([{ nombre: "Jeans rectos azules", corte: "recto", categoria: "bottom" }]);
    expect(linea).toMatch(/^Jeans rectos azules: straight-leg fit/);
    expect(linea).toMatch(/NOT skinny/);
  });

  it("al holgado, que caiga suelto", () => {
    const [linea] = cortesParaPrompt([{ nombre: "Jeans holgados", corte: "holgado", categoria: "bottom" }]);
    expect(linea).toMatch(/relaxed loose fit/);
  });

  it("una prenda de arriba recibe su versión, no la de pantalón", () => {
    const [linea] = cortesParaPrompt([{ nombre: "Camisa oversize", corte: "holgado", categoria: "top" }]);
    expect(linea).not.toMatch(/leg|thigh/);
  });

  it("entallado, sin corte o corte desconocido no agregan nada", () => {
    expect(
      cortesParaPrompt([
        { nombre: "Pantalón slim", corte: "entallado", categoria: "bottom" },
        { nombre: "Chinos", corte: null, categoria: "bottom" },
        { nombre: "Short", corte: "raro", categoria: "bottom" },
      ])
    ).toEqual([]);
  });
});
