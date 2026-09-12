import { describe, expect, it } from "vitest";
import { diaLocal, esVisitaNueva, inicioDelDiaLocal } from "./visitas";

// LO QUE BLINDAN ESTOS TESTS: que "volvió el jueves" signifique el jueves DE LA
// PERSONA. Con días en UTC, todo lo que pasa de las 18:00 de CDMX en adelante
// contaría como el día siguiente, y el feed diría que alguien entró un día que
// para él era de noche del anterior.

describe("diaLocal", () => {
  it("la noche de CDMX todavía es el mismo día, aunque en UTC ya cambió", () => {
    // 03:02 UTC del 10 = 21:02 del 9 en CDMX. Es el caso real de ricardomc888.
    expect(diaLocal(new Date("2026-09-10T03:02:00Z"))).toBe("2026-09-09");
    expect(diaLocal(new Date("2026-09-10T19:56:00Z"))).toBe("2026-09-10");
  });

  it("el día cambia a las 06:00 UTC (medianoche en CDMX)", () => {
    expect(diaLocal(new Date("2026-09-10T05:59:59Z"))).toBe("2026-09-09");
    expect(diaLocal(new Date("2026-09-10T06:00:00Z"))).toBe("2026-09-10");
  });
});

describe("esVisitaNueva", () => {
  it("sin visita previa, siempre es nueva", () => {
    expect(esVisitaNueva(null, new Date("2026-09-12T18:00:00Z"))).toBe(true);
    expect(esVisitaNueva(undefined, new Date("2026-09-12T18:00:00Z"))).toBe(true);
  });

  it("dos cargas del mismo día son UNA visita", () => {
    // 14:00 y 23:00 UTC del 12 = mañana y tarde del 12 en CDMX.
    expect(
      esVisitaNueva("2026-09-12T14:00:00Z", new Date("2026-09-12T23:00:00Z"))
    ).toBe(false);
  });

  it("volver al día siguiente sí cuenta, aunque pasen pocas horas", () => {
    // 03:00 UTC del 13 = 21:00 del 12 en CDMX… sigue siendo el mismo día.
    expect(
      esVisitaNueva("2026-09-12T14:00:00Z", new Date("2026-09-13T03:00:00Z"))
    ).toBe(false);
    // 07:00 UTC del 13 = 01:00 del 13 en CDMX: ya es otro día.
    expect(
      esVisitaNueva("2026-09-12T14:00:00Z", new Date("2026-09-13T07:00:00Z"))
    ).toBe(true);
  });
});

describe("inicioDelDiaLocal", () => {
  it("es la medianoche de CDMX del día en curso", () => {
    expect(inicioDelDiaLocal(new Date("2026-09-12T23:00:00Z"))).toBe(
      "2026-09-12T00:00:00-06:00"
    );
    // Y en horas de la madrugada UTC, la del día anterior.
    expect(inicioDelDiaLocal(new Date("2026-09-13T03:00:00Z"))).toBe(
      "2026-09-12T00:00:00-06:00"
    );
  });

  it("cae antes que cualquier instante del día y después del anterior", () => {
    const inicio = new Date(inicioDelDiaLocal(new Date("2026-09-12T23:00:00Z"))).getTime();
    expect(inicio).toBeLessThanOrEqual(new Date("2026-09-12T23:00:00Z").getTime());
    expect(inicio).toBeGreaterThan(new Date("2026-09-12T05:00:00Z").getTime());
  });
});
