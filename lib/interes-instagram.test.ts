import { describe, expect, it } from "vitest";
import { datosDeInteres, mostrarTarjetaIg, normalizarUsuarioIg } from "./interes-instagram";

// LO QUE BLINDAN: que la tarjeta sólo vea a quien le sirve y no se repita, y
// que el usuario de Instagram nunca se guarde sin permiso.

const base = { prendasPropias: 3, vistas: 0, dijoSi: false, dijoNo: false, fotosBloqueadas: false };

describe("mostrarTarjetaIg", () => {
  it("a quien tiene menos de 10 prendas propias, hasta 3 veces", () => {
    expect(mostrarTarjetaIg(base)).toBe(true);
    expect(mostrarTarjetaIg({ ...base, vistas: 3 })).toBe(false);
    expect(mostrarTarjetaIg({ ...base, prendasPropias: 10 })).toBe(false);
  });
  it("después de contestar, o sin permiso de fotos, nunca", () => {
    expect(mostrarTarjetaIg({ ...base, dijoSi: true })).toBe(false);
    expect(mostrarTarjetaIg({ ...base, dijoNo: true })).toBe(false);
    expect(mostrarTarjetaIg({ ...base, fotosBloqueadas: true })).toBe(false);
  });
});

describe("usuario de Instagram", () => {
  it("se normaliza y lo que no parece usuario se descarta", () => {
    expect(normalizarUsuarioIg(" @Rob.Coste_1 ")).toBe("rob.coste_1");
    expect(normalizarUsuarioIg("https://instagram.com/x")).toBeNull();
    expect(normalizarUsuarioIg("")).toBeNull();
  });
  it("sin permiso no se guarda, aunque lo haya escrito", () => {
    expect(datosDeInteres("rob", false)).toEqual({ consiente: false });
    expect(datosDeInteres("rob", true)).toEqual({ usuario: "rob", consiente: true });
    expect(datosDeInteres("no es usuario!", true)).toEqual({ consiente: true });
  });
});
