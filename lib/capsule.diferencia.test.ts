import { describe, it, expect } from "vitest";
import { textoDeDiferencia } from "@/lib/capsule";

// "¿Te sirve la tuya? · cambia: confirma si es la misma" no se entendía: el
// rescate del cruce no sabe en qué difiere, sólo que puede ser la misma.
describe("textoDeDiferencia", () => {
  it("una diferencia real se dice como cambio", () => {
    expect(textoDeDiferencia("sintético en vez de piel")).toBe("cambia: sintético en vez de piel");
  });
  it("el rescate (texto viejo o nuevo) se dice como pregunta", () => {
    expect(textoDeDiferencia("confirma si es la misma")).toBe("¿es la misma?");
    expect(textoDeDiferencia("¿es la misma?")).toBe("¿es la misma?");
  });
  it("sin diferencia, nada", () => {
    expect(textoDeDiferencia(null)).toBeNull();
    expect(textoDeDiferencia("  ")).toBeNull();
  });
});
