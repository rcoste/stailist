import { describe, expect, it } from "vitest";
import { dispositivoDesdeUA, esDispositivo } from "./dispositivo";

describe("dispositivoDesdeUA", () => {
  it("distingue teléfono, tablet y computadora", () => {
    expect(
      dispositivoDesdeUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")
    ).toBe("celular");
    expect(
      dispositivoDesdeUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36")
    ).toBe("celular");
    expect(
      dispositivoDesdeUA("Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/126.0 Safari/537.36")
    ).toBe("tablet");
    expect(
      dispositivoDesdeUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36")
    ).toBe("computadora");
    expect(
      dispositivoDesdeUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36")
    ).toBe("computadora");
  });

  it("el navegador de Instagram en un teléfono es teléfono", () => {
    expect(
      dispositivoDesdeUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/21F90 Instagram 340.0")
    ).toBe("celular");
  });

  it("sin user-agent no inventa", () => {
    expect(dispositivoDesdeUA(null)).toBeNull();
    expect(dispositivoDesdeUA("")).toBeNull();
  });

  it("sólo acepta las tres palabras", () => {
    expect(esDispositivo("computadora")).toBe(true);
    expect(esDispositivo("desktop")).toBe(false);
    expect(esDispositivo(null)).toBe(false);
  });
});
