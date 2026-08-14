import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeneratedOutfit } from "./generate";
import type { EngineContext } from "./prompt";

// armarLooks es el camino por el que HOY corre producción (/api/generate y el
// comparador; el look de hoy comparte la CARGA del contexto pero genera un
// solo look, sin este loop). Se prueba con el generador y el juez stubbeados:
// lo que se fija aquí es la ORQUESTACIÓN — rechazados retenidos, piso de 2,
// hooks, recibos — no el criterio de los modelos.

const generarConRecibo = vi.fn();
const reviewOutfit = vi.fn();

vi.mock("./generate", () => ({
  generarConRecibo: (...args: unknown[]) => generarConRecibo(...args),
}));
vi.mock("./critic", () => ({
  reviewOutfit: (...args: unknown[]) => reviewOutfit(...args),
}));

const { armarLooks } = await import("./pipeline");

const look = (n: string): GeneratedOutfit => ({
  nombre: n,
  item_ids: [n + "-1", n + "-2"],
  explicacion: "porque sí",
});

const recibo = (costo: number) => ({
  texto: "",
  tokens: { entrada: 100, salida: 10 },
  costoUsd: costo,
  ms: 5,
  truncada: false,
});

const ctx = {} as EngineContext;

const okResult = (o: GeneratedOutfit, extra: Partial<{ verdict: string; recibo: unknown }> = {}) => ({
  outfit: o,
  verdict: "ok",
  razon: null,
  recibo: recibo(0.01),
  ...extra,
});

beforeEach(() => {
  generarConRecibo.mockReset();
  reviewOutfit.mockReset();
});

describe("armarLooks", () => {
  it("aprueba en orden y junta los recibos: [generación, juez, juez, …]", async () => {
    generarConRecibo.mockResolvedValue({ outfits: [look("a"), look("b")], recibo: recibo(0.1) });
    reviewOutfit.mockImplementation(async (_c, o) => okResult(o));

    const r = await armarLooks(ctx);
    expect(r.finalized.map((o) => o.nombre)).toEqual(["a", "b"]);
    expect(r.recibos).toHaveLength(3);
    expect(r.recibos[0].costoUsd).toBe(0.1);
    expect(r.reviews.every((x) => x.shown)).toBe(true);
  });

  it("un rechazado se RETIENE y no se muestra si ya hay 2 buenos", async () => {
    generarConRecibo.mockResolvedValue({
      outfits: [look("a"), look("malo"), look("b")],
      recibo: recibo(0.1),
    });
    reviewOutfit.mockImplementation(async (_c, o) =>
      o.nombre === "malo" ? okResult(o, { verdict: "rechazado" }) : okResult(o)
    );

    const r = await armarLooks(ctx);
    expect(r.finalized.map((o) => o.nombre)).toEqual(["a", "b"]);
    const rechazado = r.reviews.find((x) => x.verdict === "rechazado")!;
    expect(rechazado.shown).toBe(false);
  });

  it("piso de 2: si los rechazos dejan menos de 2, rescata retenidos y los marca shown", async () => {
    generarConRecibo.mockResolvedValue({
      outfits: [look("a"), look("b"), look("c")],
      recibo: recibo(0.1),
    });
    // Solo "a" pasa; b y c rechazados → hay que rescatar UNO para llegar a 2.
    reviewOutfit.mockImplementation(async (_c, o) =>
      o.nombre === "a" ? okResult(o) : okResult(o, { verdict: "rechazado" })
    );

    const r = await armarLooks(ctx);
    expect(r.finalized).toHaveLength(2);
    expect(r.finalized[1].nombre).toBe("b"); // el primer retenido, en orden
    expect(r.reviews.filter((x) => x.verdict === "rechazado" && x.shown)).toHaveLength(1);
  });

  it("si alAprobar devuelve false (no se pudo guardar), el look NO cuenta ni se marca shown", async () => {
    generarConRecibo.mockResolvedValue({ outfits: [look("a"), look("b")], recibo: recibo(0.1) });
    reviewOutfit.mockImplementation(async (_c, o) => okResult(o));

    const r = await armarLooks(ctx, {}, { alAprobar: async (o) => o.nombre !== "a" });
    expect(r.finalized.map((o) => o.nombre)).toEqual(["b"]);
    expect(r.reviews.find((x) => x.before[0] === "a-1")!.shown).toBe(false);
  });

  it("el juez ve los looks YA aprobados como priorOutfits (para mantenerlos distintos)", async () => {
    generarConRecibo.mockResolvedValue({ outfits: [look("a"), look("b")], recibo: recibo(0.1) });
    const priors: number[] = [];
    reviewOutfit.mockImplementation(async (_c, o, prior: GeneratedOutfit[]) => {
      priors.push(prior.length);
      return okResult(o);
    });

    await armarLooks(ctx);
    expect(priors).toEqual([0, 1]);
  });

  it("un juez sin recibo (fail-forward) no rompe la suma de recibos", async () => {
    generarConRecibo.mockResolvedValue({ outfits: [look("a"), look("b")], recibo: recibo(0.1) });
    reviewOutfit.mockImplementation(async (_c, o) => okResult(o, { recibo: null }));

    const r = await armarLooks(ctx);
    expect(r.recibos).toHaveLength(1); // solo la generación
    expect(r.finalized).toHaveLength(2);
  });

  it("las opciones de la variante llegan ENTERAS al generador", async () => {
    // Sin esto, las variantes sin-* del comparador correrían el motor completo
    // por los dos lados sin que ningún test lo delatara.
    generarConRecibo.mockResolvedValue({ outfits: [look("a"), look("b")], recibo: recibo(0.1) });
    reviewOutfit.mockImplementation(async (_c, o) => okResult(o));

    await armarLooks(ctx, { sinBlueprint: true, sinRotacion: true });
    // El tercer argumento es el contexto del recibo (lib/recibos): `null`
    // porque quien corre variantes es el comparador, que no mide.
    expect(generarConRecibo).toHaveBeenCalledWith(
      ctx,
      { sinBlueprint: true, sinRotacion: true },
      null
    );
  });

  it("los hooks reciben lo que la ruta streamea: total de candidatos y fase por índice", async () => {
    generarConRecibo.mockResolvedValue({ outfits: [look("a"), look("b")], recibo: recibo(0.1) });
    reviewOutfit.mockImplementation(async (_c, o) => okResult(o));
    const eventos: string[] = [];

    await armarLooks(ctx, {}, {
      alCandidatos: (n) => eventos.push(`total:${n}`),
      alRevisar: (i) => eventos.push(`revisa:${i}`),
    });
    expect(eventos).toEqual(["total:2", "revisa:0", "revisa:1"]);
  });
});
