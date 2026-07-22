import { describe, it, expect } from "vitest";
import {
  AGE_RANGES,
  isAgeRange,
  ageLabel,
  isMinor,
  fotosBloqueadas,
  ageStylingLine,
  type AgeRange,
} from "./edad";

describe("isAgeRange — validación del rango declarado", () => {
  it("acepta los 6 rangos definidos", () => {
    for (const r of AGE_RANGES) {
      expect(isAgeRange(r.id)).toBe(true);
    }
  });

  it("rechaza strings fuera del catálogo (el server action hace early return)", () => {
    for (const v of ["", "12-15", "18", "13-17 ", "adulto", "55"]) {
      expect(isAgeRange(v)).toBe(false);
    }
  });

  it("rechaza no-strings (null, undefined, número)", () => {
    expect(isAgeRange(null)).toBe(false);
    expect(isAgeRange(undefined)).toBe(false);
    expect(isAgeRange(17)).toBe(false);
  });
});

describe("ageLabel — label humano del rango", () => {
  it("mapea cada rango a su label", () => {
    expect(ageLabel("13-17")).toBe("13 a 17");
    expect(ageLabel("55+")).toBe("55 o más");
  });

  it("null → null (edad no declarada, sin línea)", () => {
    expect(ageLabel(null)).toBeNull();
  });
});

describe("isMinor — solo 13-17 es menor", () => {
  it("13-17 es menor", () => {
    expect(isMinor("13-17")).toBe(true);
  });

  it("los demás rangos y null NO son menores", () => {
    const adultos: (AgeRange | null)[] = ["18-24", "25-34", "35-44", "45-54", "55+", null];
    for (const r of adultos) expect(isMinor(r)).toBe(false);
  });
});

describe("fotosBloqueadas — gate de fotos del menor", () => {
  it("menor sin permiso verificado → bloqueadas", () => {
    expect(
      fotosBloqueadas({ age_range: "13-17", minor_consent_verified_at: null })
    ).toBe(true);
  });

  it("menor con permiso verificado → desbloqueadas", () => {
    expect(
      fotosBloqueadas({
        age_range: "13-17",
        minor_consent_verified_at: "2026-07-22T00:00:00Z",
      })
    ).toBe(false);
  });

  it("adulto → nunca bloqueadas (con o sin sello)", () => {
    expect(
      fotosBloqueadas({ age_range: "25-34", minor_consent_verified_at: null })
    ).toBe(false);
  });

  it("sin edad declarada → no bloqueadas (no hay señal de menor)", () => {
    expect(
      fotosBloqueadas({ age_range: null, minor_consent_verified_at: null })
    ).toBe(false);
  });
});

describe("ageStylingLine — solo los extremos aportan señal", () => {
  it("13-17: vibra fresca, señal SUAVE", () => {
    const line = ageStylingLine("13-17");
    expect(line).toContain("adolescente");
    expect(line).toContain("SUAVE");
  });

  it("55+: elegancia cómoda, señal SUAVE", () => {
    const line = ageStylingLine("55+");
    expect(line).toContain("55 o más");
    expect(line).toContain("SUAVE");
  });

  it("rangos intermedios (18-54) → null (no meter ruido al prompt)", () => {
    const medios: AgeRange[] = ["18-24", "25-34", "35-44", "45-54"];
    for (const r of medios) expect(ageStylingLine(r)).toBeNull();
  });

  it("null → null (edad no declarada)", () => {
    expect(ageStylingLine(null)).toBeNull();
  });
});
