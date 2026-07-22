import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { isConsentToken } from "./consentimiento";

// El token del link de permiso se valida ANTES de tocar la DB: la columna es
// uuid y un string no-UUID revienta el cast con un 500 en el endpoint público.
// Estos tests pinnean que solo pasan UUIDs de verdad.
describe("isConsentToken", () => {
  it("acepta UUIDs reales", () => {
    expect(isConsentToken(randomUUID())).toBe(true);
    expect(isConsentToken("5C907F6E-FFAF-4F43-B079-9FCD07EC26DD")).toBe(true); // case-insensitive
  });

  it("rechaza lo que el regex laxo de 36 chars dejaba pasar", () => {
    expect(isConsentToken("------------------------------------")).toBe(false); // 36 guiones
    expect(isConsentToken("abcdefabcdefabcdefabcdefabcdefabcdef")).toBe(false); // 36 hex sin guiones
    expect(isConsentToken("5c907f6ef-faf-4f43-b079-9fcd07ec26dd")).toBe(false); // guiones corridos
  });

  it("rechaza null, vacío y largos incorrectos", () => {
    expect(isConsentToken(null)).toBe(false);
    expect(isConsentToken("")).toBe(false);
    expect(isConsentToken("5c907f6e-ffaf-4f43-b079-9fcd07ec26d")).toBe(false); // 35
    expect(isConsentToken("5c907f6e-ffaf-4f43-b079-9fcd07ec26dd0")).toBe(false); // 37
  });
});
