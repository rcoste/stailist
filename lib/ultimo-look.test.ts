import { describe, expect, it } from "vitest";
import { elegirUltimoLook } from "./ultimo-look";

// EL ÚLTIMO LOOK ES EL QUE HICISTE TUYO, no el último que se generó (2026-09-08).
// El wow genera tres en 17 segundos y la persona elige uno. Roberto, probando
// desde cero con la cuenta de prueba, eligió "Sutileza en Burdeos" (el primero
// en crearse) y el home le enseñó "Negro con Actitud" (el último en crearse)
// como "último look · creado hoy". Las filas llegan ordenadas por created_at
// desc, tal cual las pide loadUltimoLook.

type Fila = {
  id: string;
  is_look_of_day: boolean;
  look_date: string | null;
  planned_for: string | null;
  favorited_at: string | null;
  tryon_path: string | null;
};
const fila = (id: string, extra: Partial<Fila> = {}): Fila => ({
  id, is_look_of_day: false, look_date: null, planned_for: null, favorited_at: null, tryon_path: null, ...extra,
});
// Tal cual salió: el elegido fue el primero en crearse; el wow lo marca con look_date.
const trio: Fila[] = [fila("negro"), fila("sobrecamisa"), fila("burdeos", { look_date: "2026-09-08" })];

describe("elegirUltimoLook — el que hiciste tuyo", () => {
  it("el trío del wow: gana el elegido (marcado con look_date), no el último generado", () => {
    expect(elegirUltimoLook(trio)?.id).toBe("burdeos");
  });

  it("el look del día de Hoy (is_look_of_day) también es tuyo", () => {
    expect(elegirUltimoLook([fila("alterno"), fila("hoy", { is_look_of_day: true })])?.id).toBe("hoy");
  });

  it("probártelo puesto también lo hace tuyo (así queda el de Roberto, elegido antes de esta marca)", () => {
    const antes = [fila("negro"), fila("sobrecamisa"), fila("burdeos", { tryon_path: "u/tryon.jpg" })];
    expect(elegirUltimoLook(antes)?.id).toBe("burdeos");
  });

  it("un look planeado para otro día es tuyo aunque no sea el del día", () => {
    expect(elegirUltimoLook([fila("alterno"), fila("sabado", { planned_for: "2026-09-12" })])?.id).toBe("sabado");
  });

  it("sin ninguna marca (looks viejos): el más reciente, como siempre", () => {
    expect(elegirUltimoLook([fila("negro"), fila("sobrecamisa"), fila("burdeos")])?.id).toBe("negro");
  });

  it("sin filas: null", () => {
    expect(elegirUltimoLook([])).toBeNull();
  });
});
