import { describe, it, expect } from "vitest";
import { marcador, estimado, type FotoComparada, type Veredicto } from "./tipos";
import { costoUsd, formatoUsd } from "@/lib/proveedores/precios";

const foto = (
  id: string,
  lecturas: { modeloId: string; veredicto: Veredicto | null; costoUsd?: number; ms?: number; error?: string }[]
): FotoComparada => ({
  fotoId: id,
  n: 1,
  url: null,
  lecturas: lecturas.map((l) => ({
    modeloId: l.modeloId,
    salida: [],
    error: l.error ?? null,
    costoUsd: l.costoUsd ?? 0.01,
    ms: l.ms ?? 1000,
    veredicto: l.veredicto,
  })),
});

const multi = (
  inventadas: number[] = [],
  faltaron = 0,
  camposMal: Record<string, string[]> = {}
): Veredicto => ({ inventadas, faltaron, camposMal });

describe("marcador", () => {
  it("inventar pesa más que acertar", () => {
    // Es la regla de orden del comparador entero. Un modelo que inventa una
    // prenda pierde contra uno que lee mal un material, aunque el segundo tenga
    // peor porcentaje: leer mal se corrige en un tap cuando la persona lo ve;
    // una prenda que no existe se queda en el clóset con su render limpio y
    // sólo aparece semanas después dentro de un outfit.
    const r = marcador([
      foto("a", [
        { modeloId: "inventor", veredicto: multi([1]) },
        { modeloId: "despistado", veredicto: multi([], 0, { "0": ["material"] }) },
      ]),
    ]);
    expect(r[0].modeloId).toBe("despistado");
    expect(r[1].inventadas).toBe(1);
  });

  it("una foto impecable no tiene inventadas, ni faltantes, ni campos mal", () => {
    const r = marcador([
      foto("a", [
        { modeloId: "limpio", veredicto: multi() },
        { modeloId: "omitio", veredicto: multi([], 1) },
        { modeloId: "leyoMal", veredicto: multi([], 0, { "0": ["color"] }) },
      ]),
    ]);
    const de = (id: string) => r.find((x) => x.modeloId === id)!;
    expect(de("limpio").impecables).toBe(1);
    expect(de("omitio").impecables).toBe(0);
    expect(de("omitio").omitidas).toBe(1);
    expect(de("leyoMal").impecables).toBe(0);
  });

  it("no cuenta lo que todavía no se califica", () => {
    // Mezclar las pendientes inflaría a quien aún no se revisa: se vería
    // ganando por el simple hecho de no haberlo mirado.
    const r = marcador([
      foto("a", [
        { modeloId: "visto", veredicto: multi() },
        { modeloId: "pendiente", veredicto: null },
      ]),
    ]);
    expect(r.find((x) => x.modeloId === "pendiente")!.fotosJuzgadas).toBe(0);
  });

  it("suma los campos mal de TODAS las prendas de una foto", () => {
    // En modo varias, una sola foto trae hasta 8 prendas: contar sólo la
    // primera escondería la mayor parte de los errores.
    const r = marcador([
      foto("a", [
        { modeloId: "m", veredicto: multi([], 0, { "0": ["color"], "2": ["color", "material"] }) },
      ]),
    ]);
    expect(r[0].fallosPorCampo).toEqual({ color: 2, material: 1 });
  });

  it("el modo de una prenda usa su propia forma de veredicto", () => {
    const r = marcador([
      foto("a", [
        { modeloId: "bueno", veredicto: { camposMal: [] } },
        { modeloId: "malo", veredicto: { camposMal: ["material"] } },
      ]),
    ]);
    expect(r.find((x) => x.modeloId === "bueno")!.impecables).toBe(1);
    expect(r.find((x) => x.modeloId === "malo")!.fallosPorCampo).toEqual({ material: 1 });
  });

  it("una lectura que falló cuenta como error, no como acierto", () => {
    const r = marcador([foto("a", [{ modeloId: "m", veredicto: null, error: "429" }])]);
    expect(r[0].errores).toBe(1);
    expect(r[0].impecables).toBe(0);
  });

  it("proyecta el costo a 30 fotos, que es un onboarding real", () => {
    const r = marcador([
      foto("a", [{ modeloId: "m", veredicto: multi(), costoUsd: 0.02 }]),
      foto("b", [{ modeloId: "m", veredicto: multi(), costoUsd: 0.02 }]),
    ]);
    expect(r[0].costoPor30).toBeCloseTo(0.6, 5);
  });
});

describe("estimado antes de lanzar", () => {
  it("leer varias prendas cuesta más que leer una", () => {
    // Cada prenda detectada trae su descripción larga para el generador de
    // imágenes: la salida es diez veces más grande.
    const varias = estimado(["claude-opus-5"], 5, "varias")!;
    const una = estimado(["claude-opus-5"], 5, "una")!;
    expect(varias).toBeGreaterThan(una);
  });

  it("no inventa un número si algún modelo no tiene precio", () => {
    // Mostrar "$0.00" para un modelo sin precio conocido haría que una corrida
    // cara pareciera gratis.
    expect(estimado(["moonshotai/kimi-k2"], 10, "varias")).toBeNull();
  });
});

describe("precios", () => {
  it("Opus 5 y Opus 4.8 cuestan lo mismo", () => {
    // El cambio de modelo del 4 de agosto no movió la factura ni un centavo:
    // el pico de agosto fue volumen de laboratorio, no el modelo.
    const t = { entrada: 8200, salida: 1500 };
    expect(costoUsd("claude-opus-5", t)).toBe(costoUsd("claude-opus-4-8", t));
  });

  it("Sonnet 5 sube de precio el 1 de septiembre de 2026", () => {
    // Está en precio de lanzamiento. Cualquier ahorro calculado hoy con Sonnet
    // vale la mitad en septiembre, y eso hay que verlo ANTES de decidir.
    const t = { entrada: 8200, salida: 1500 };
    const agosto = costoUsd("claude-sonnet-5", t, new Date("2026-08-15"))!;
    const septiembre = costoUsd("claude-sonnet-5", t, new Date("2026-09-15"))!;
    expect(septiembre).toBeCloseTo(agosto * 1.5, 6);
  });

  it("un modelo desconocido no reporta costo cero", () => {
    expect(costoUsd("modelo-que-no-existe", { entrada: 1000, salida: 100 })).toBeNull();
    expect(formatoUsd(null)).toBe("—");
  });

  it("muestra centésimas de centavo sin redondear a cero", () => {
    // Leer una prenda con Gemini Flash-Lite cuesta $0.0007: con dos decimales
    // se vería "$0.00" y la comparación perdería justo lo que la hace útil.
    expect(formatoUsd(0.0007)).toBe("$0.0007");
  });
});
