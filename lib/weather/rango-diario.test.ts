import { describe, expect, it } from "vitest";
import { aggregateDaily } from "./index";

// 2026-10-17: el resumen diario lleva el rango (mínimas y máximas), no sólo el
// promedio día/noche. Con el promedio, Mineápolis en octubre era "6°C" y la
// maleta salía sin abrigo; las mañanas rondan 0°C.
describe("aggregateDaily", () => {
  it("promedia las mínimas y las máximas aparte del promedio", () => {
    const r = aggregateDaily({ temperature_2m_max: [10, 12], temperature_2m_min: [0, 2], weather_code: [2, 2] });
    expect(r).toEqual({ temp_c: 6, condition: expect.any(String), temp_min: 1, temp_max: 11 });
  });
  it("sin mínimas no inventa rango", () => {
    const r = aggregateDaily({ temperature_2m_max: [10, 12], weather_code: [2, 2] });
    expect(r?.temp_min).toBeUndefined();
    expect(r?.temp_c).toBe(11);
  });
});
