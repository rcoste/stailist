import { describe, it, expect } from "vitest";
import { TITULO_FALLBACK, TITULO_MAX, tituloLimpio } from "./titulo";

describe("tituloLimpio", () => {
  it("el caso real: ideogramas al frente del título", () => {
    expect(tituloLimpio("商务 Fluida y moderna")).toBe("Fluida y moderna");
  });

  it("deja intactos los títulos normales, con acentos y puntuación", () => {
    for (const t of [
      "Sastre negro bajo la lluvia",
      "Cita clínica con actitud",
      "Blanco y azul, sin drama",
      "¿Y si hoy sí? Denim & lino",
      "Off-duty en capas",
    ]) {
      expect(tituloLimpio(t)).toBe(t);
    }
  });

  it("quita emojis y símbolos sueltos sin comerse las palabras", () => {
    expect(tituloLimpio("Look de viernes ✨")).toBe("Look de viernes");
    expect(tituloLimpio("Café → oficina")).toBe("Café oficina");
  });

  it("cuando no queda nada legible, cae al fallback", () => {
    expect(tituloLimpio("商务")).toBe(TITULO_FALLBACK);
    expect(tituloLimpio("   ")).toBe(TITULO_FALLBACK);
    expect(tituloLimpio(null)).toBe(TITULO_FALLBACK);
    expect(tituloLimpio("123 ---")).toBe(TITULO_FALLBACK);
  });

  it("recorta títulos desmedidos", () => {
    const largo = "a".repeat(120);
    expect(tituloLimpio(largo).length).toBe(TITULO_MAX);
  });

  it("colapsa espacios y guiones colgantes que deja la limpieza", () => {
    expect(tituloLimpio("— Sastre   nocturno —")).toBe("Sastre nocturno");
  });
});
