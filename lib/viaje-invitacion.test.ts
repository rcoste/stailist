import { describe, expect, it } from "vitest";
import { leerInvitacion, textoUnidos, tokenNuevo, tokenValido, yaPaso } from "./viaje-invitacion";

// LO QUE BLINDAN: que el link no se pueda inventar, que la ruta llegue completa
// aunque el viaje sea viejo, y que un viaje pasado no se ofrezca.

describe("tokenNuevo / tokenValido", () => {
  it("el token nuevo tiene la forma que se valida", () => {
    const t = tokenNuevo();
    expect(tokenValido(t)).toBe(true);
    expect(tokenNuevo()).not.toBe(t);
  });
  it("rechaza lo que no tiene la forma", () => {
    expect(tokenValido("corto")).toBe(false);
    expect(tokenValido("../../etc/xx")).toBe(false);
    expect(tokenValido(undefined)).toBe(false);
  });
});

describe("leerInvitacion", () => {
  const base = { lugar: "París · Londres", fecha_inicio: "2026-10-15", fecha_fin: "2026-10-24", ocasiones: ["ciudad", 3] };
  it("respeta las noches de cada parada", () => {
    const v = leerInvitacion({ ...base, paradas: [{ lugar: "París", noches: 5, weather: { temp_c: 12, condition: "lluvia" } }, { lugar: "Londres", noches: 4 }] })!;
    expect(v.paradas.map((p) => [p.lugar, p.noches])).toEqual([["París", 5], ["Londres", 4]]);
    expect(v.paradas[0].weather?.temp_c).toBe(12);
    expect(v.ocasiones).toEqual(["ciudad"]);
  });
  it("un viaje viejo sin noches reparte el rango (sobrante a la primera)", () => {
    const v = leerInvitacion({ ...base, paradas: [{ lugar: "París" }, { lugar: "Londres" }] })!;
    // 9 noches entre dos paradas: 5 + 4.
    expect(v.paradas.map((p) => p.noches)).toEqual([5, 4]);
  });
  it("sin paradas, la ruta es el lugar con todas las noches", () => {
    const v = leerInvitacion({ ...base, paradas: [] })!;
    expect(v.paradas).toEqual([{ lugar: "París · Londres", noches: 9, weather: null }]);
  });
  it("lo que no es un viaje no se lee", () => {
    expect(leerInvitacion(null)).toBeNull();
    expect(leerInvitacion({ lugar: "x" })).toBeNull();
  });
});

describe("yaPaso", () => {
  it("el último día todavía cuenta; el siguiente ya no", () => {
    expect(yaPaso({ fechaFin: "2026-10-24" }, "2026-10-24")).toBe(false);
    expect(yaPaso({ fechaFin: "2026-10-24" }, "2026-10-25")).toBe(true);
  });
});

describe("textoUnidos", () => {
  it("singular, plural y nada", () => {
    expect(textoUnidos(0)).toBeNull();
    expect(textoUnidos(1)).toBe("1 persona ya armó su maleta con tu viaje");
    expect(textoUnidos(3)).toBe("3 personas ya armaron su maleta con tu viaje");
  });
});
