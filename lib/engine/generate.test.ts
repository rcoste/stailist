import { describe, it, expect, vi, beforeEach } from "vitest";
import { MODELO_MOTOR } from "@/lib/models";
import type { EngineContext } from "./prompt";

// generarConRecibo con la puerta común stubbeada: se fijan los contratos que
// protegen a producción — truncado distinguible, filtro de ids inválidos, la
// red de seguridad del ancla — sin gastar una llamada real.

const llamar = vi.fn();
vi.mock("@/lib/proveedores", async (importOriginal) => ({
  // Mock PARCIAL: solo la llamada de red se stubbea; parsearJson es lógica
  // pura y corre de verdad (tiene sus propios tests en lib/proveedores).
  ...(await importOriginal<typeof import("@/lib/proveedores")>()),
  llamar: (...args: unknown[]) => llamar(...args),
}));

const { generarConRecibo } = await import("./generate");

const ctxCon = (ids: string[]): EngineContext =>
  ({
    items: ids.map((id) => ({ id, attrs: { nombre: id } })),
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
  }) as unknown as EngineContext;

const respuesta = (outfits: unknown, truncada = false) => ({
  texto: JSON.stringify({ outfits }),
  tokens: { entrada: 100, salida: 50 },
  costoUsd: 0.1,
  ms: 10,
  truncada,
});

/** La env var del proveedor del motor vigente: sigue a MODELO_MOTOR. */
const LLAVE_DEL_MOTOR: string = {
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
}[MODELO_MOTOR.proveedor];

const dosLooks = (ids: string[]) => [
  { nombre: "Uno", item_ids: ids.slice(0, 2), explicacion: "va" },
  { nombre: "Dos", item_ids: ids.slice(0, 2), explicacion: "va" },
];

beforeEach(() => {
  llamar.mockReset();
  // La llave del proveedor que el motor use HOY. Estaba clavada a Anthropic y
  // este test cazó el cambio a Gemini en el momento en que ocurrió.
  process.env[LLAVE_DEL_MOTOR] = "test-key";
});

describe("generarConRecibo", () => {
  it("sin API key truena con ENGINE_NOT_CONNECTED (la ruta lo traduce a sin_api_key)", async () => {
    delete process.env[LLAVE_DEL_MOTOR];
    await expect(generarConRecibo(ctxCon(["a", "b"]))).rejects.toThrow("ENGINE_NOT_CONNECTED");
    expect(llamar).not.toHaveBeenCalled();
  });

  it("respuesta truncada = error distinguible, no un JSON.parse opaco", async () => {
    llamar.mockResolvedValue({ ...respuesta([], true), texto: '{"outfits": [{"nom' });
    await expect(generarConRecibo(ctxCon(["a", "b"]))).rejects.toThrow("TRUNCATED_RESPONSE");
  });

  it("filtra looks con ids que no existen en el clóset", async () => {
    llamar.mockResolvedValue(
      respuesta([
        ...dosLooks(["a", "b"]),
        { nombre: "Fantasma", item_ids: ["a", "inventada"], explicacion: "no va" },
      ])
    );
    const { outfits } = await generarConRecibo(ctxCon(["a", "b"]));
    expect(outfits.map((o) => o.nombre)).toEqual(["Uno", "Dos"]);
  });

  it("menos de 2 looks válidos = TOO_FEW_OUTFITS", async () => {
    llamar.mockResolvedValue(respuesta([dosLooks(["a", "b"])[0]]));
    await expect(generarConRecibo(ctxCon(["a", "b"]))).rejects.toThrow("TOO_FEW_OUTFITS");
  });

  it("la red del ancla: si el modelo la omitió, se re-inyecta en cada look", async () => {
    llamar.mockResolvedValue(respuesta(dosLooks(["a", "b"])));
    const ctx = { ...ctxCon(["a", "b", "ancla"]), seedItemId: "ancla" };
    const { outfits } = await generarConRecibo(ctx);
    for (const o of outfits) expect(o.item_ids).toContain("ancla");
  });

  it("devuelve el recibo de la llamada junto con los looks", async () => {
    llamar.mockResolvedValue(respuesta(dosLooks(["a", "b"])));
    const { recibo } = await generarConRecibo(ctxCon(["a", "b"]));
    expect(recibo.costoUsd).toBe(0.1);
    expect(recibo.tokens.entrada).toBe(100);
  });

  it("sin modelo en opciones usa el de producción (MODELO_MOTOR)", async () => {
    // Contra MODELO_MOTOR, no contra un id escrito a mano: el motor cambia
    // cuando una corrida lo gana (pasó a Gemini el 2026-08-07) y lo que este
    // test protege es que producción use EL de lib/models, no cuál sea.
    llamar.mockResolvedValue(respuesta(dosLooks(["a", "b"])));
    await generarConRecibo(ctxCon(["a", "b"]));
    expect(llamar.mock.calls[0][0]).toMatchObject({ modelo: MODELO_MOTOR });
  });

  it("el modelo de la variante SÍ llega a la llamada — el contrato del comparador", async () => {
    // Sin esto, un A/B de modelos compararía producción contra sí misma en
    // silencio, con todos los tests en verde.
    llamar.mockResolvedValue(respuesta(dosLooks(["a", "b"])));
    const otro = { proveedor: "gemini" as const, id: "gemini-x", etiqueta: "X" };
    delete process.env.ANTHROPIC_API_KEY; // proveedor no-anthropic no exige esta key
    await generarConRecibo(ctxCon(["a", "b"]), { modelo: otro });
    expect(llamar.mock.calls[0][0]).toMatchObject({ modelo: otro });
  });
});
