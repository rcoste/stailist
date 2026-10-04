import { describe, expect, it } from "vitest";
import { MAX_FILAS, filasValidas, secretoValido } from "@/lib/admin/gasto-ads";

// LO QUE SE BLINDA: que lo que mande el script (o cualquiera que adivine la
// dirección) no meta basura al panel, y que sin el secreto exacto no pase nada.

describe("gasto de Google Ads", () => {
  it("convierte lo del script y descarta fila por fila lo que no cuadra", () => {
    const filas = filasValidas({
      filas: [
        { dia: "2026-10-03", campana: "app-neutra", impresiones: 7, clics: 1, costo_mxn: 10.384, registros: 1 },
        { dia: "3 oct", campana: "app-neutra", impresiones: 1, clics: 0, costo_mxn: 0, registros: 0 },
        { dia: "2026-10-03", campana: "<script>", impresiones: 1, clics: 0, costo_mxn: 0, registros: 0 },
        { dia: "2026-10-03", campana: "hombres-diario", impresiones: -1, clics: 0, costo_mxn: 0, registros: 0 },
        null,
      ],
    });
    expect(filas).toEqual([
      { dia: "2026-10-03", campana: "app-neutra", impresiones: 7, clics: 1, costo_mxn: 10.38, registros: 1 },
    ]);
    expect(filasValidas({})).toEqual([]);
    expect(filasValidas(null)).toEqual([]);
  });

  it("no acepta más de MAX_FILAS de un jalón", () => {
    const una = { dia: "2026-10-03", campana: "x", impresiones: 0, clics: 0, costo_mxn: 0, registros: 0 };
    expect(filasValidas({ filas: Array(MAX_FILAS + 50).fill(una) })).toHaveLength(MAX_FILAS);
  });

  it("el secreto tiene que ser exacto y existir", () => {
    expect(secretoValido("abc", "abc")).toBe(true);
    expect(secretoValido("abd", "abc")).toBe(false);
    expect(secretoValido("ab", "abc")).toBe(false);
    expect(secretoValido(null, "abc")).toBe(false);
    expect(secretoValido("abc", undefined)).toBe(false);
  });
});
