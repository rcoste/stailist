import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TOPE_USD_DIA_GLOBAL, gastoGlobal } from "./cuotas";

// EL FRENO GLOBAL SUMA TODO EL DÍA, NO LAS PRIMERAS MIL LLAMADAS (2026-10-09).
// PostgREST devuelve como mucho 1000 filas sin avisar. Un día de pico con más
// llamadas que eso dejaba el gasto corto y el freno sin saltar.

/** ai_calls de mentira que, como PostgREST, nunca devuelve más de 1000 por consulta. */
function aiCalls(n: number, costo: number): SupabaseClient {
  const filas = Array.from({ length: n }, () => ({ costo_usd: costo }));
  const consulta = {
    select: () => consulta,
    gte: () => consulta,
    order: () => consulta,
    range: async (desde: number, hasta: number) => ({
      data: filas.slice(desde, Math.min(hasta + 1, desde + 1000)),
      error: null,
    }),
  };
  return { from: () => consulta } as unknown as SupabaseClient;
}

describe("gastoGlobal", () => {
  it("un día de 2500 llamadas suma las 2500 y pasa el freno", async () => {
    const total = await gastoGlobal(aiCalls(2500, 0.02));
    expect(total).toBeCloseTo(50, 5);
    // Con el tope de 1000 habrían sido $20: por debajo del freno de $40.
    expect(total).toBeGreaterThan(TOPE_USD_DIA_GLOBAL);
  });
});
