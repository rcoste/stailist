import { describe, expect, it } from "vitest";
import { todasLasFilas } from "./todas-las-filas";

// Una "tabla" de n filas servida como PostgREST: nunca más de `tope` por página.
const tabla = (n: number, tope = 1000) => {
  const filas = Array.from({ length: n }, (_, i) => ({ id: i }));
  const pedidas: [number, number][] = [];
  const pedir = async (desde: number, hasta: number) => {
    pedidas.push([desde, hasta]);
    return { data: filas.slice(desde, Math.min(hasta + 1, desde + tope)), error: null };
  };
  return { pedir, pedidas };
};

describe("todasLasFilas", () => {
  it("trae las 2129 filas, no las primeras 1000", async () => {
    const t = tabla(2129);
    const r = await todasLasFilas(t.pedir);
    expect(r).toHaveLength(2129);
    expect(r.at(-1)).toEqual({ id: 2128 });
    expect(t.pedidas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("con exactamente una página llena pide una más para saber que se acabó", async () => {
    const t = tabla(1000);
    expect(await todasLasFilas(t.pedir)).toHaveLength(1000);
    expect(t.pedidas).toHaveLength(2);
  });

  it("si una página falla, truena en vez de devolver de menos", async () => {
    await expect(
      todasLasFilas(async () => ({ data: null, error: { message: "timeout" } }))
    ).rejects.toThrow(/timeout/);
  });
});
