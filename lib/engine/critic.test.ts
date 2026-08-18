import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EngineContext, EngineItem } from "./prompt";
import type { GeneratedOutfit } from "./generate";

// reviewOutfit con la puerta común stubbeada. Lo que se fija es el
// FAIL-FORWARD: el juez jamás rompe la generación — todo fallo devuelve el
// look original con veredicto "ok", con o sin recibo según lo que alcanzó a
// costar. Un juez que tira la generación sería peor que no tener juez.

const llamar = vi.fn();
vi.mock("@/lib/proveedores", () => ({
  llamar: (...args: unknown[]) => llamar(...args),
}));

const { reviewOutfit, loQueSigueRoto } = await import("./critic");

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
    const r = await reviewOutfit({ ...ctx, seedItemIds: ["a"] } as EngineContext, original, []);
    expect(r.outfit.item_ids).toContain("a");
  });
});

describe("loQueSigueRoto — se comprueba la reparación del juez", () => {
  // POR QUÉ EXISTE, con su número: de 91 violaciones en las cuatro corridas del
  // eval, el juez reparó 87 (96%). Pero 9 quedaron rotas y él INTRODUJO 5
  // nuevas al arreglar otra cosa — y nadie estaba mirando su resultado.
  const item = (id: string, nombre: string, extra: Record<string, unknown> = {}) =>
    ({ id, attrs: { nombre, tipo: nombre, ...extra } }) as unknown as EngineItem;

  const ctxCon = (items: EngineItem[]) =>
    ({
      items,
      weather: { temp_c: 18, condition: "nublado" },
      gender: "hombre",
      paraguas: false,
      formality: null,
      seedItemIds: [],
    }) as unknown as EngineContext;

  it("un look limpio no reporta nada", () => {
    const items = [
      item("a", "Camiseta blanca", { categoria: "top", color_hex: "#FFFFFF" }),
      item("b", "Suéter de lana negro", { categoria: "top", color_hex: "#111111" }),
      item("c", "Jeans azul oscuro", { categoria: "bottom", color_hex: "#2A3B5C" }),
    ];
    const out = { nombre: "x", item_ids: ["a", "b", "c"], explicacion: "x" };
    expect(loQueSigueRoto(ctxCon(items), out)).toEqual([]);
  });

  it("caza el suéter a piel que el juez dejó pasar — el caso real de Roberto", () => {
    const items = [
      item("b", "Suéter marino", { categoria: "top", color_hex: "#27425F" }),
      item("c", "Jeans negros", { categoria: "bottom", color_hex: "#111111" }),
    ];
    const out = { nombre: "x", item_ids: ["b", "c"], explicacion: "x" };
    const roto = loQueSigueRoto(ctxCon(items), out);
    expect(roto.map((r) => r.regla)).toContain("sueter-sin-base");
  });

  it("solo mira las prendas DEL LOOK, no el clóset entero", () => {
    // Si mirara el clóset, la camiseta que existe pero no está puesta haría
    // creer que el look está limpio — que es exactamente el fallo a evitar.
    const items = [
      item("a", "Camiseta blanca", { categoria: "top", color_hex: "#FFFFFF" }),
      item("b", "Suéter marino", { categoria: "top", color_hex: "#27425F" }),
      item("c", "Jeans negros", { categoria: "bottom", color_hex: "#111111" }),
    ];
    const sinLaCamiseta = { nombre: "x", item_ids: ["b", "c"], explicacion: "x" };
    expect(loQueSigueRoto(ctxCon(items), sinLaCamiseta).map((r) => r.regla)).toContain(
      "sueter-sin-base"
    );
  });
});

describe("sinRepararEnCodigo — la variante que mide el cambio de v47", () => {
  // Es el único cambio del día que TOCA LOS LOOKS por su cuenta (añade una
  // camiseta, cambia un zapato). Sin poder apagarlo, no hay forma de medir si
  // ayuda o estorba — y un cambio invasivo sin medir daña en silencio.
  it("la variante existe en el catálogo con su flag", async () => {
    const { VARIANTES_MOTOR } = await import("@/lib/comparador/motor");
    const v = VARIANTES_MOTOR.find((x) => x.clave === "sin-reparar-codigo");
    expect(v).toBeDefined();
    expect(v!.opciones).toMatchObject({ sinRepararEnCodigo: true });
  });

  it("una variante cambia UNA sola cosa: no toca modelo ni otros flags", () => {
    // Regla del comparador: si una variante cambiara dos cosas a la vez, el
    // resultado no diría cuál causó la diferencia.
    return import("@/lib/comparador/motor").then(({ VARIANTES_MOTOR }) => {
      const v = VARIANTES_MOTOR.find((x) => x.clave === "sin-reparar-codigo")!;
      expect(v.modeloId).toBeUndefined();
      expect(Object.keys(v.opciones ?? {})).toEqual(["sinRepararEnCodigo"]);
    });
  });
});

describe("sinCoherenciaCromatica — la variante que mide la regla de color de v53", () => {
  // La regla nació de un look real ("Carbón bajo cero") y de una queja concreta:
  // "al usar tantos colores es cuando ya se rompe". Marca el 6.8% de los looks
  // históricos y CERO de los 25 que tienen 👍 — pero eso es evidencia de que no
  // hace daño, no de que ayude. Eso lo dice el comparador, no yo.
  //
  // OJO CON LA DIRECCIÓN: producción ya lleva la regla, así que el RETADOR es
  // apagarla. Si el retador gana, la regla estorba y se revierte — igual que la
  // regla dura de marino+negro (v5 → v6), que era mito.
  it("la variante existe en el catálogo con su flag", async () => {
    const { VARIANTES_MOTOR } = await import("@/lib/comparador/motor");
    const v = VARIANTES_MOTOR.find((x) => x.clave === "sin-coherencia-cromatica");
    expect(v).toBeDefined();
    expect(v!.opciones).toMatchObject({ sinCoherenciaCromatica: true });
  });

  it("cambia UNA sola cosa: no toca modelo ni otros flags", async () => {
    const { VARIANTES_MOTOR } = await import("@/lib/comparador/motor");
    const v = VARIANTES_MOTOR.find((x) => x.clave === "sin-coherencia-cromatica")!;
    expect(v.modeloId).toBeUndefined();
    expect(Object.keys(v.opciones ?? {})).toEqual(["sinCoherenciaCromatica"]);
  });

  it("el flag de verdad apaga la regla, no solo existe", async () => {
    // El candado que importa: una variante que declare el flag y no lo cablee
    // mediría dos veces lo mismo y el marcador saldría empatado por accidente.
    const { revisarEjecucion } = await import("./reglas-ejecucion");
    const carbonBajoCero = [
      { id: "1", attrs: { nombre: "Camisa negra", color_hex: "#1A1A1A" } },
      { id: "2", attrs: { nombre: "Saco carbón", color_hex: "#3A3C42" } },
      { id: "3", attrs: { nombre: "Pantalón carbón", color_hex: "#3A3C42" } },
      { id: "4", attrs: { nombre: "Suéter marino", color_hex: "#1F2A44" } },
      { id: "5", attrs: { nombre: "Botines café", color_hex: "#6B4A33" } },
    ];
    const con = revisarEjecucion(carbonBajoCero).map((x) => x.regla);
    const sin = revisarEjecucion(carbonBajoCero, {
      sinCoherenciaCromatica: true,
    }).map((x) => x.regla);
    expect(con).toContain("colores-que-no-se-leen");
    expect(sin).not.toContain("colores-que-no-se-leen");
  });
});
