import { describe, it, expect } from "vitest";
import type { LookInput } from "@/components/weather-picker";
import { buildGenFrases } from "./gen-frases";

// LookInput con clima ya resuelto (rama `weather`) para probar la frase del clima.
const liClima = (temp_c: number, condition: string): LookInput => ({
  objective: "diario",
  momento: "dia",
  weather: { temp_c, condition },
});

// Rama lat/lon (el clima aún no se resolvió): NO debe salir frase de clima.
const liGeo: LookInput = { objective: "diario", momento: "dia", lat: 19.4, lon: -99.1 };

describe("buildGenFrases — frases reales del generando", () => {
  it("clóset con prendas: abre con 'revisando tus N prendas…'", () => {
    const f = buildGenFrases(null, 23, null);
    expect(f[0]).toBe("revisando tus 23 prendas…");
  });

  it("clóset vacío (0): la frase de prendas se omite (no mentir)", () => {
    const f = buildGenFrases(null, 0, null);
    expect(f.some((x) => x.includes("prendas"))).toBe(false);
  });

  it("con clima resuelto: temperatura redondeada", () => {
    const f = buildGenFrases(liClima(22.6, "despejado"), 0, null);
    expect(f).toContain("checando el clima de hoy: 23°…");
  });

  it("clima con lluvia: agrega ', con lluvia'", () => {
    const f = buildGenFrases(liClima(18, "lluvia"), 0, null);
    expect(f).toContain("checando el clima de hoy: 18°, con lluvia…");
  });

  it("input por lat/lon (sin weather): sin frase de clima", () => {
    const f = buildGenFrases(liGeo, 5, null);
    expect(f.some((x) => x.includes("clima"))).toBe(false);
  });

  it("input null: sin frase de clima", () => {
    const f = buildGenFrases(null, 5, null);
    expect(f.some((x) => x.includes("clima"))).toBe(false);
  });

  it("la frase de ocasión entra tal cual cuando existe", () => {
    const f = buildGenFrases(null, 0, 'algo a tu medida para "boda"…');
    expect(f).toContain('algo a tu medida para "boda"…');
  });

  it("cierre fijo siempre presente y al final (descartar + afinar)", () => {
    const f = buildGenFrases(liClima(20, "despejado"), 12, "frase de ocasión…");
    expect(f.slice(-2)).toEqual([
      "descartando lo que no combina contigo…",
      "afinando los últimos detalles…",
    ]);
  });

  it("orden completo: prendas → clima → ocasión → cierre", () => {
    const f = buildGenFrases(liClima(20, "despejado"), 12, "frase de ocasión…");
    expect(f).toEqual([
      "revisando tus 12 prendas…",
      "checando el clima de hoy: 20°…",
      "frase de ocasión…",
      "descartando lo que no combina contigo…",
      "afinando los últimos detalles…",
    ]);
  });

  it("todo apagado: nunca devuelve lista vacía (quedan las 2 de cierre)", () => {
    expect(buildGenFrases(null, 0, null)).toHaveLength(2);
  });
});
