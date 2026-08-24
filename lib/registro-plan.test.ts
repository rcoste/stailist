import { describe, expect, it } from "vitest";
import { lineaRegistro, registroDe } from "./registro-plan";
import { lineaTipoEvento } from "./eventos";

// La capa 2: el dial es de la persona y viaja DENTRO de la línea del evento,
// que comparten generador, rúbricas y jueces. Lo que se blinda: que el default
// sea el consenso (sin dial, el texto no cambia) y que la línea diga hacia
// dónde Y qué sí — decirle "no traje" sin alternativa fue lo que rompió v56.
describe("el dial de registro por plan", () => {
  it("sin dial, la línea del evento es la de siempre (default = consenso)", () => {
    expect(lineaTipoEvento("cita")).toBe(lineaTipoEvento("cita", null));
    expect(lineaTipoEvento("cita", { boda: "arreglado" })).toBe(lineaTipoEvento("cita"));
  });

  it("con dial, la línea lleva el registro de la persona y manda sobre la norma", () => {
    const linea = lineaTipoEvento("cita", { cita: "relajado" });
    expect(linea).toContain(lineaTipoEvento("cita"));
    expect(linea).toContain("MÁS RELAJADO");
    expect(linea).toContain("manda sobre la norma");
  });

  it("cada dirección dice qué SÍ, no sólo qué no — la lección de v56", () => {
    expect(lineaRegistro("relajado")).toMatch(/blazer|piezas sueltas/);
    expect(lineaRegistro("arreglado")).toMatch(/traje|sastre/);
    expect(lineaRegistro(null)).toBe("");
  });

  it("registroDe ignora valores corruptos y planes ajenos", () => {
    expect(registroDe({ cita: "arreglado" }, "cita")).toBe("arreglado");
    expect(registroDe({ cita: "x" as never }, "cita")).toBeNull();
    expect(registroDe({ cita: "arreglado" }, "boda")).toBeNull();
    expect(registroDe(null, "cita")).toBeNull();
  });
});
