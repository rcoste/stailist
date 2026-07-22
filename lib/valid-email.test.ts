import { describe, expect, it } from "vitest";
import { isEmailValido } from "./valid-email";

// El validador compartido de correo (login + correo del tutor). Cliente y
// server usan LA MISMA función; estos tests pinnean el contrato.
describe("isEmailValido", () => {
  it("acepta correos normales", () => {
    expect(isEmailValido("mama@gmail.com")).toBe(true);
    expect(isEmailValido("tutor.test@stailist.app")).toBe(true);
    expect(isEmailValido("  con.espacios@dominio.mx  ")).toBe(true); // trimea
  });

  it("rechaza formatos rotos", () => {
    for (const v of ["", "mama", "mama@", "mama@x", "ma ma@x.co", "a@b@c.co", "@x.co"]) {
      expect(isEmailValido(v)).toBe(false);
    }
  });
});
