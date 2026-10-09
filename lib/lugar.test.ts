import { describe, expect, it } from "vitest";
import { banderaDe, esPais, lugarDesdeEncabezados, lugarEnPalabras } from "./lugar";

const encabezados = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });

describe("lugarDesdeEncabezados", () => {
  it("lee país y estado de Vercel", () => {
    expect(
      lugarDesdeEncabezados(encabezados({ "x-vercel-ip-country": "MX", "x-vercel-ip-country-region": "NLE" }))
    ).toEqual({ pais: "MX", region: "NLE" });
  });

  it("sin encabezados (local) no hay lugar", () => {
    expect(lugarDesdeEncabezados(encabezados({}))).toBeNull();
  });

  it("un estado raro no tumba el país", () => {
    expect(
      lugarDesdeEncabezados(encabezados({ "x-vercel-ip-country": "es", "x-vercel-ip-country-region": "M%20D" }))
    ).toEqual({ pais: "ES", region: null });
  });

  it("descarta lo que no es un país", () => {
    expect(lugarDesdeEncabezados(encabezados({ "x-vercel-ip-country": "México" }))).toBeNull();
    expect(esPais("XX")).toBe(false);
    expect(esPais("T1")).toBe(false);
  });
});

describe("lugarEnPalabras", () => {
  it("en México nombra el estado", () => {
    expect(lugarEnPalabras("MX", "CMX")).toBe("México · Ciudad de México");
    expect(lugarEnPalabras("MX", "DIF")).toBe("México · Ciudad de México");
    expect(lugarEnPalabras("MX", "NLE")).toBe("México · Nuevo León");
  });

  it("fuera de México sólo el país", () => {
    expect(lugarEnPalabras("ES", "MD")).toBe("España");
  });

  it("sin dato es null", () => {
    expect(lugarEnPalabras(null)).toBeNull();
    expect(lugarEnPalabras("")).toBeNull();
  });

  it("México sin estado conocido se queda en el país", () => {
    expect(lugarEnPalabras("MX", null)).toBe("México");
    expect(lugarEnPalabras("MX", "ZZZ")).toBe("México");
  });
});

describe("banderaDe", () => {
  it("convierte el código en la bandera", () => {
    expect(banderaDe("CO")).toBe("🇨🇴");
    expect(banderaDe("MX")).toBe("🇲🇽");
  });
  it("sin dato o con un código que no es país, nada", () => {
    expect(banderaDe(null)).toBeNull();
    expect(banderaDe("XX")).toBeNull();
    expect(banderaDe("mx")).toBeNull();
  });
});
