import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pedirImagen } from "./gemini-imagen";

// El reintento de la puerta de imagen (try-on Y avatar), que existe porque
// el servicio falla
// solo: medido el 2026-08-06, 2 de 8 llamadas idénticas a gemini-3-pro-image
// volvieron `500 INTERNAL` en ~200ms con la llave y el prompt sanos, y otra
// corrida murió con ETIMEDOUT de red.
//
// Antes no había nada que probar: un `if (!ok)` devolvía "generacion" sin leer
// el cuerpo. Estos tests fijan las cuatro decisiones que sí hay que acertar —
// qué se reintenta, qué no, qué motivo se reporta, y que el reintento nunca se
// pase del presupuesto de la función (Vercel corta a los 60s).

const IMAGEN = {
  candidates: [{ content: { parts: [{ inlineData: { data: "AAAA" } }] } }],
};

const respuesta = (status: number, cuerpo: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
    text: async () => JSON.stringify(cuerpo),
  }) as unknown as Response;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("pedirImagen", () => {
  it("un 500 pasajero se reintenta y la segunda sí trae la imagen", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        respuesta(500, { error: { message: "Internal error encountered." } })
      )
      .mockResolvedValueOnce(respuesta(200, IMAGEN));

    const r = await pedirImagen([{ text: "x" }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(r).toEqual({ data: "AAAA" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("un timeout de red también se reintenta: no es culpa del prompt", async () => {
    const timeout = Object.assign(new Error("The operation was aborted"), {
      name: "TimeoutError",
    });
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(respuesta(200, IMAGEN));

    const r = await pedirImagen([{ text: "x" }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(r).toEqual({ data: "AAAA" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("un 400 NO se reintenta: repetirlo da lo mismo y cuesta tiempo", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(respuesta(400, { error: { message: "API key not valid" } }));

    const r = await pedirImagen([{ text: "x" }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Y el motivo llega ENTERO: "API key not valid" y "Internal error" piden
    // cosas distintas de quien lo lee. Confundirlos fue justo lo que pasó.
    expect("motivo" in r && r.motivo).toContain("API key not valid");
    expect("motivo" in r && r.motivo).toContain("400");
  });

  it("un 200 sin imagen no se reintenta, pero dice por qué", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      respuesta(200, { candidates: [{ finishReason: "IMAGE_SAFETY" }] })
    );

    const r = await pedirImagen([{ text: "x" }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect("motivo" in r && r.motivo).toContain("IMAGE_SAFETY");
  });

  it("si ya no queda presupuesto, no arranca un segundo intento", async () => {
    // Un intento colgado se comería los 60s de Vercel y la persona no vería
    // ni el error: el reintento solo sale si de verdad cabe.
    let t = 0;
    const ahora = () => t;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      t += 50_000; // el primer intento se llevó casi todo
      return respuesta(500, { error: { message: "Internal error encountered." } });
    });

    const r = await pedirImagen([{ text: "x" }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ahora,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect("motivo" in r && r.motivo).toContain("sin tiempo para reintentar");
  });

  it("dos 500 seguidos se rinden con el motivo real, no con 'falló'", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        respuesta(503, { error: { message: "The model is overloaded." } })
      );

    const r = await pedirImagen([{ text: "x" }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect("motivo" in r && r.motivo).toContain("The model is overloaded.");
  });
});
