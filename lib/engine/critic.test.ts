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
    expect(r).toMatchObject({ outfit: original, verdict: "ok", razon: null, recibo: null });
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
    expect(r).toMatchObject({ outfit: original, verdict: "ok", razon: null, recibo: null });
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

describe("colores-que-no-se-leen — retirada tras cinco rondas sin ganarse el lugar", () => {
  // Nació en v53 con su ablación pre-registrada ("si apagarla gana, se
  // revierte"). Cinco rondas: empate, empate, empate, 3-1 en contra y, con el
  // clóset de referencia, 79% de aprobación sin ella contra 64% con ella.
  it("la variante ya no está en el catálogo", async () => {
    const { VARIANTES_MOTOR } = await import("@/lib/comparador/motor");
    expect(VARIANTES_MOTOR.find((x) => x.clave === "sin-coherencia-cromatica")).toBeUndefined();
  });

  it("el look que la originó ya no dispara nada de color", async () => {
    const { revisarEjecucion } = await import("./reglas-ejecucion");
    const carbonBajoCero = [
      { id: "1", attrs: { nombre: "Camisa negra", color_hex: "#1A1A1A" } },
      { id: "2", attrs: { nombre: "Saco carbón", color_hex: "#3A3C42" } },
      { id: "3", attrs: { nombre: "Pantalón carbón", color_hex: "#3A3C42" } },
      { id: "4", attrs: { nombre: "Suéter marino", color_hex: "#1F2A44" } },
      { id: "5", attrs: { nombre: "Botines café", color_hex: "#6B4A33" } },
    ];
    expect(revisarEjecucion(carbonBajoCero).map((x) => x.regla)).not.toContain("colores-que-no-se-leen");
  });
});

describe("conversación B — código antes que juez, y el juez sólo repara", () => {
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

  // Medido el 2026-08-22 (docs/improvement-loop-del-motor.md §9): el juez
  // reescribía el 75% de los looks y 3 de cada 4 reescrituras respondían a una
  // violación que el código ya detectaba — porque corría ANTES del reparador.
  it("las dos variantes existen, cada una con UN solo flag", async () => {
    const { VARIANTES_MOTOR } = await import("@/lib/comparador/motor");
    const a = VARIANTES_MOTOR.find((x) => x.clave === "reparar-primero")!;
    const b = VARIANTES_MOTOR.find((x) => x.clave === "juez-solo-repara")!;
    expect(Object.keys(a.opciones ?? {})).toEqual(["repararPrimero"]);
    expect(Object.keys(b.opciones ?? {})).toEqual(["juezSoloRepara"]);
    expect(a.modeloId ?? b.modeloId).toBeUndefined();
  });

  const items = [
    item("a", "Camiseta blanca", { categoria: "top", color_hex: "#FFFFFF" }),
    item("b", "Suéter marino", { categoria: "top", color_hex: "#27425F" }),
    item("c", "Jeans negros", { categoria: "bottom", color_hex: "#111111" }),
    item("d", "Botines Chelsea negros", { categoria: "calzado", color_hex: "#111111", material: "piel" }),
  ];
  const sinBase = { nombre: "x", item_ids: ["b", "c", "d"], explicacion: "x" };

  it("sin flag, el juez recibe el look tal cual y la violación sigue ahí para él", async () => {
    const { prepararParaElJuez } = await import("./critic");
    const r = prepararParaElJuez(ctxCon(items), sinBase, {});
    expect(r.hechas).toEqual([]);
    expect(r.outfit.item_ids).toEqual(["b", "c", "d"]);
    expect(r.violaciones.map((v) => v.regla)).toContain("sueter-sin-base");
  });

  it("con repararPrimero, el código añade la camiseta ANTES y al juez ya no le queda nada que reparar", async () => {
    const { prepararParaElJuez } = await import("./critic");
    const r = prepararParaElJuez(ctxCon(items), sinBase, { repararPrimero: true });
    expect(r.hechas.map((h) => h.regla)).toEqual(["sueter-sin-base"]);
    expect(r.outfit.item_ids).toContain("a");
    expect(r.violaciones).toEqual([]);
  });

  it("juezSoloRepara implica reparar primero, y sinRepararEnCodigo lo apaga", async () => {
    const { prepararParaElJuez } = await import("./critic");
    expect(prepararParaElJuez(ctxCon(items), sinBase, { juezSoloRepara: true }).hechas.length).toBe(1);
    expect(
      prepararParaElJuez(ctxCon(items), sinBase, { juezSoloRepara: true, sinRepararEnCodigo: true }).hechas
    ).toEqual([]);
  });

  it("el candado se lo dice al juez con todas sus letras", async () => {
    const { instruccionSoloRepara } = await import("./critic");
    expect(instruccionSoloRepara(false).join(" ")).toMatch(/TAL CUAL/);
    expect(instruccionSoloRepara(true).join(" ")).toMatch(/sólo puedes cambiar/);
  });
});
