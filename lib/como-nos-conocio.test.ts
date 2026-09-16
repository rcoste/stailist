import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPCIONES_CONOCIO, esComoNosConocio, etiquetaConocio } from "./como-nos-conocio";

describe("¿cómo nos conociste?", () => {
  it("sólo acepta las opciones de la lista y 'omitido'", () => {
    expect(esComoNosConocio("tiktok")).toBe(true);
    expect(esComoNosConocio("omitido")).toBe(true);
    expect(esComoNosConocio("twitter")).toBe(false);
    expect(esComoNosConocio("")).toBe(false);
    expect(esComoNosConocio(null)).toBe(false);
  });

  // La lista vive dos veces (aquí y en el CHECK de la base). Si una opción
  // nueva se agrega sólo aquí, el update falla en silencio y la respuesta se
  // pierde: la trampa del CHECK de events que el repo ya pagó.
  it("la lista coincide con el CHECK de la migración 0161", () => {
    const sql = readFileSync("supabase/migrations/0161_como_nos_conocio.sql", "utf8");
    const enSql = [...sql.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).filter((v) => v !== "own");
    const enCodigo = [...OPCIONES_CONOCIO.map((o) => o.id), "omitido"];
    expect(new Set(enSql)).toEqual(new Set(enCodigo));
  });

  it("en el panel se distingue quien la saltó de quien nunca la vio", () => {
    expect(etiquetaConocio("recomendacion")).toBe("me lo recomendó alguien");
    expect(etiquetaConocio("omitido")).toBe("saltó la pregunta");
    expect(etiquetaConocio(null)).toBe("—");
  });
});
