import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EngineContext } from "./prompt";
import type { GeneratedOutfit } from "./generate";

// reviewOutfit con la puerta común stubbeada. Lo que se fija es el
// FAIL-FORWARD: el juez jamás rompe la generación — todo fallo devuelve el
// look original con veredicto "ok", con o sin recibo según lo que alcanzó a
// costar. Un juez que tira la generación sería peor que no tener juez.

const llamar = vi.fn();
vi.mock("@/lib/proveedores", () => ({
  llamar: (...args: unknown[]) => llamar(...args),
}));

const { reviewOutfit } = await import("./critic");

const ctx = {
  items: [
    { id: "a", attrs: { nombre: "Camisa", categoria: "top" } },
    { id: "b", attrs: { nombre: "Pantalón", categoria: "bottom" } },
    { id: "c", attrs: { nombre: "Tenis", categoria: "calzado" } },
  ],
  tasteTags: [],
  recentCombos: [],
  vetoes: [],
  tasteSignal: { worn: [], liked: [], disliked: [], skipped: [] },
  gender: null,
  objective: null,
  plan: null,
  lifestyle: null,
  archetype: null,
  season: null,
  flow: null,
  weather: null,
  timeOfDay: null,
  silueta: null,
} as unknown as EngineContext;

const original: GeneratedOutfit = {
  nombre: "Original",
  item_ids: ["a", "b"],
  explicacion: "tal cual",
};

const veredicto = (v: Record<string, unknown>, truncada = false) => ({
  texto: JSON.stringify(v),
  tokens: { entrada: 100, salida: 20 },
  costoUsd: 0.02,
  ms: 5,
  truncada,
});

beforeEach(() => {
  llamar.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("reviewOutfit", () => {
  it("sin API key: pasa el look tal cual, sin llamar ni recibo", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await reviewOutfit(ctx, original, []);
    expect(r).toEqual({ outfit: original, verdict: "ok", razon: null, recibo: null });
    expect(llamar).not.toHaveBeenCalled();
  });

  it("veredicto truncado: fail-forward a ok, pero CON recibo (la llamada costó)", async () => {
    llamar.mockResolvedValue(veredicto({}, true));
    const r = await reviewOutfit(ctx, original, []);
    expect(r.outfit).toEqual(original);
    expect(r.verdict).toBe("ok");
    expect(r.recibo?.costoUsd).toBe(0.02);
  });

  it("el proveedor truena: fail-forward a ok sin recibo", async () => {
    llamar.mockRejectedValue(new Error("500 del proveedor"));
    const r = await reviewOutfit(ctx, original, []);
    expect(r).toEqual({ outfit: original, verdict: "ok", razon: null, recibo: null });
  });

  it("respuesta no-truncada pero ilegible (JSON roto): fail-forward, hoy sin recibo", async () => {
    // Documenta el contrato actual: el parse roto cae al mismo catch que un
    // fallo del proveedor y el recibo se pierde aunque la llamada costó.
    llamar.mockResolvedValue({ ...veredicto({}), texto: "esto no es json" });
    const r = await reviewOutfit(ctx, original, []);
    expect(r.outfit).toEqual(original);
    expect(r.verdict).toBe("ok");
    expect(r.recibo).toBeNull();
  });

  it("rechazado: devuelve el look ORIGINAL (no la reparación fallida) con la razón", async () => {
    llamar.mockResolvedValue(
      veredicto({
        veredicto: "rechazado",
        razon: "no hay abrigo para este frío",
        nombre: "Reescrito",
        item_ids: ["a", "c"],
        explicacion: "x",
        tip: "",
      })
    );
    const r = await reviewOutfit(ctx, original, []);
    expect(r.verdict).toBe("rechazado");
    expect(r.outfit).toEqual(original);
    expect(r.razon).toBe("no hay abrigo para este frío");
  });

  it("reparado: usa el look del juez si sus ids son del clóset", async () => {
    llamar.mockResolvedValue(
      veredicto({
        veredicto: "reparado",
        razon: "cambié el bottom",
        nombre: "Mejor",
        item_ids: ["a", "c"],
        explicacion: "ahora sí",
        tip: "arremanga la camisa",
      })
    );
    const r = await reviewOutfit(ctx, original, []);
    expect(r.verdict).toBe("reparado");
    expect(r.outfit.item_ids).toEqual(["a", "c"]);
    expect(r.outfit.tip).toBe("arremanga la camisa");
  });

  it("una 'reparación' con ids inventados se descarta: gana el original", async () => {
    llamar.mockResolvedValue(
      veredicto({
        veredicto: "reparado",
        razon: "x",
        nombre: "Fantasma",
        item_ids: ["a", "inventada"],
        explicacion: "x",
        tip: "",
      })
    );
    const r = await reviewOutfit(ctx, original, []);
    expect(r.outfit).toEqual(original);
    expect(r.verdict).toBe("ok");
  });

  it("el juez nunca puede tirar el ancla: si su reescritura la perdió, se re-inyecta", async () => {
    llamar.mockResolvedValue(
      veredicto({
        veredicto: "reparado",
        razon: "x",
        nombre: "Sin ancla",
        item_ids: ["b", "c"],
        explicacion: "x",
        tip: "",
      })
    );
    const r = await reviewOutfit({ ...ctx, seedItemId: "a" } as EngineContext, original, []);
    expect(r.outfit.item_ids).toContain("a");
  });
});
