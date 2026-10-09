import { describe, expect, it } from "vitest";
import { MXN_POR_USD, type ResumenCampana } from "./campana";
import { costoPorPrimerLookTotal, diasParaLaLectura, estadoDelExperimento, nombreDelDia, resumenDelDia } from "./hoy";
import type { FilaPerfilAdquisicion } from "./adquisicion";

// LO QUE BLINDAN: que la pantalla Hoy diga lo mismo que el correo de las 8 y
// que el costo por primer look no mezcle campañas sin gasto.

const campana = (over: Partial<ResumenCampana>): ResumenCampana => ({
  fuente: "google",
  campana: "app-neutra",
  impresiones: null,
  clics: 10,
  costoMxn: 100,
  registrosGoogle: null,
  pidieronCodigo: 0,
  landing: 0,
  boton: 0,
  correoVisto: 0,
  correoOk: 0,
  entraron: 0,
  registro: 0,
  pasos: [],
  primerLook: 1,
  ttvMedianaS: null,
  ventanaCerrada: 0,
  volvieron: 0,
  seLoPusieron: 0,
  iaUsd: 0,
  ...over,
});

describe("costoPorPrimerLookTotal", () => {
  it("suma anuncio + IA de todas las campañas y lo divide entre sus primeros looks", () => {
    const r = [
      campana({ campana: "mx", costoMxn: 300, primerLook: 1, iaUsd: 1 }),
      campana({ campana: "co", costoMxn: 300, primerLook: 5, iaUsd: 0 }),
    ];
    expect(costoPorPrimerLookTotal(r)).toBeCloseTo((600 + MXN_POR_USD) / 6, 5);
  });
  it("lo orgánico (sin campaña ni gasto) no entra; sin primeros looks no hay costo", () => {
    expect(costoPorPrimerLookTotal([campana({ campana: "—", costoMxn: null, primerLook: 9 })])).toBeNull();
    expect(costoPorPrimerLookTotal([campana({ primerLook: 0 })])).toBeNull();
  });
});

describe("estadoDelExperimento", () => {
  it("dice el veredicto en una frase", () => {
    expect(estadoDelExperimento({ estado: "pasa", conPrimerLook: 30, cerradas: 20, volvieron: 6 }).tono).toBe("bien");
    expect(estadoDelExperimento({ estado: "no-pasa", conPrimerLook: 30, cerradas: 26, volvieron: 1 }).tono).toBe("mal");
    const e = estadoDelExperimento({ estado: "faltan-datos", conPrimerLook: 26, cerradas: 18, volvieron: 2 });
    expect(e.tono).toBe("neutro");
    expect(e.frase).toContain("26 de 30");
    expect(e.frase).toContain("ya volvieron 2");
    expect(e.frase).toContain("18 cerraron");
  });
});

describe("resumenDelDia", () => {
  const fila = (over: Partial<FilaPerfilAdquisicion>): FilaPerfilAdquisicion => ({
    id: "u",
    email: "u@example.com",
    gender: "mujer",
    onboarding_step: 5,
    inicio: "2026-10-09T15:00:00Z",
    dia_inicio: "2026-10-09",
    dias: [],
    origen: { utm_campaign: "app-neutra-co", utm_source: "google", landing: "/", at: "x" },
    como_nos_conocio: null,
    ...over,
  });
  it("cuenta sólo el día pedido, distingue anuncios y pone primero a quien llegó más lejos", () => {
    const filas = [
      fila({ id: "a", onboarding_step: 2 }),
      fila({ id: "b", origen: null }),
      fila({ id: "c", dia_inicio: "2026-10-08" }),
    ];
    const extras = new Map([["b", { fotos: 12, prendas: 20, pais: "MX", region: "JAL" } as never]]);
    const r = resumenDelDia(filas, extras, "2026-10-09");
    expect(r.nuevas).toBe(2);
    expect(r.nuevasDeAnuncio).toBe(1);
    expect(r.primerLook).toBe(1);
    expect(r.subieronFotos).toBe(1);
    expect(r.llegaron.map((l) => l.id)).toEqual(["b", "a"]);
    expect(r.llegaron[0].lugar).toBe("México · Jalisco");
    expect(r.llegaron[1].paso).toBe("se quedó en el clóset");
  });
});

describe("fechas", () => {
  it("días para la lectura del plan y el nombre del día", () => {
    expect(diasParaLaLectura("2026-10-09")).toBe(9);
    expect(diasParaLaLectura("2026-10-20")).toBe(0);
    expect(nombreDelDia("2026-10-09", "2026-10-09")).toBe("hoy");
    expect(nombreDelDia("2026-10-08", "2026-10-09")).toBe("ayer");
    expect(nombreDelDia("2026-10-05", "2026-10-09")).toMatch(/lunes/);
  });
});
