import { describe, it, expect } from "vitest";
import {
  MENSAJE_RITMO,
  TOPE_POR_CORREO_HORA,
  TOPE_POR_IP_HORA,
  ipDe,
  permitirCodigo,
} from "./ritmo-login";

describe("permitirCodigo", () => {
  it("deja pasar el primer, segundo y tercer intento por correo", () => {
    expect(permitirCodigo({ porCorreo: 0, porIp: 0 })).toBe(true);
    expect(permitirCodigo({ porCorreo: TOPE_POR_CORREO_HORA - 1, porIp: 0 })).toBe(true);
  });

  it("corta al llegar al tope por correo aunque la IP esté limpia", () => {
    expect(permitirCodigo({ porCorreo: TOPE_POR_CORREO_HORA, porIp: 0 })).toBe(false);
  });

  it("corta por IP aunque el correo sea nuevo: es como se ve un bucle", () => {
    expect(permitirCodigo({ porCorreo: 0, porIp: TOPE_POR_IP_HORA })).toBe(false);
  });

  it("el tope por IP es mayor que el de correo: una familia detrás de un router no es un bucle", () => {
    expect(TOPE_POR_IP_HORA).toBeGreaterThan(TOPE_POR_CORREO_HORA * 2);
  });
});

describe("ipDe", () => {
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null });

  it("toma la primera de x-forwarded-for (la del cliente, no la del proxy)", () => {
    expect(ipDe(h({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("cae a x-real-ip y luego a null (local)", () => {
    expect(ipDe(h({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(ipDe(h({}))).toBeNull();
  });
});

describe("el mensaje", () => {
  it("dice dónde buscar el código, no 'bloqueado'", () => {
    expect(MENSAJE_RITMO).toMatch(/spam/);
    expect(MENSAJE_RITMO.toLowerCase()).not.toMatch(/bloque|denegad|error/);
  });
});
