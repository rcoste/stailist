import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { isInviteToken, inviteUrl } from "./invitacion";

// El token del deep-link de invitación se valida ANTES de tocar la DB (la
// columna allowlist.invite_token es uuid; un string no-UUID revienta el cast).
// Mismo contrato que isConsentToken.
describe("isInviteToken", () => {
  it("acepta UUIDs reales", () => {
    expect(isInviteToken(randomUUID())).toBe(true);
    expect(isInviteToken("5C907F6E-FFAF-4F43-B079-9FCD07EC26DD")).toBe(true); // case-insensitive
  });

  it("rechaza lo que un regex laxo de 36 chars dejaría pasar", () => {
    expect(isInviteToken("------------------------------------")).toBe(false); // 36 guiones
    expect(isInviteToken("abcdefabcdefabcdefabcdefabcdefabcdef")).toBe(false); // 36 hex sin guiones
    expect(isInviteToken("5c907f6ef-faf-4f43-b079-9fcd07ec26dd")).toBe(false); // guiones corridos
  });

  it("rechaza null, undefined, vacío y largos incorrectos", () => {
    expect(isInviteToken(null)).toBe(false);
    expect(isInviteToken(undefined)).toBe(false);
    expect(isInviteToken("")).toBe(false);
    expect(isInviteToken("5c907f6e-ffaf-4f43-b079-9fcd07ec26d")).toBe(false); // 35
    expect(isInviteToken("5c907f6e-ffaf-4f43-b079-9fcd07ec26dd0")).toBe(false); // 37
  });
});

describe("inviteUrl", () => {
  it("arma el deep-link de login con el token", () => {
    const token = "11111111-1111-4111-8111-111111111111";
    const url = inviteUrl(token);
    expect(url).toContain("/login?invite=");
    expect(url.endsWith(token)).toBe(true);
  });
});
