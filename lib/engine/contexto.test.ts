import { describe, it, expect } from "vitest";
import { construirContexto, type BaseDelMotor } from "./contexto";
import { EMPTY_TASTE_SIGNAL } from "./taste-signal";
import type { EngineItem } from "./prompt";

// construirContexto es LA función que mantiene idénticos a /api/generate, el
// look de hoy y el comparador. Estos tests fijan los contratos que ya
// derivaron una vez entre las dos copias (fitPref, momento) y la lógica del
// ancla que antes vivía suelta en look-of-day.

const item = (id: string, extra: Partial<EngineItem["attrs"]> = {}): EngineItem => ({
  id,
  attrs: { nombre: `Prenda ${id}`, categoria: "top", ...extra },
});

function base(over: Partial<BaseDelMotor> = {}): BaseDelMotor {
  return {
    profile: {
      gender: "hombre",
      taste_tags: ["pulido"],
      fit_pref: "recta",
      style_words: "limpio y sin estampados",
    },
    items: [item("a"), item("b"), item("c")],
    allItems: [item("a"), item("b"), item("c"), item("vetada")],
    recentCombos: [["a", "b"]],
    tasteSignal: EMPTY_TASTE_SIGNAL,
    ...over,
  };
}

const peticion = { objective: "diario", weather: null };

describe("construirContexto", () => {
  it("pasa fitPref del perfil — la deriva que look-of-day tuvo meses", () => {
    const ctx = construirContexto(base(), peticion);
    expect(ctx.fitPref).toBe("recta");
  });

  it("normaliza momento: cualquier cosa que no sea dia/noche cae a null", () => {
    expect(construirContexto(base(), { ...peticion, momento: "noche" }).timeOfDay).toBe("noche");
    expect(construirContexto(base(), { ...peticion, momento: "dia" }).timeOfDay).toBe("dia");
    expect(construirContexto(base(), { ...peticion, momento: "tarde" }).timeOfDay).toBeNull();
    expect(construirContexto(base(), peticion).timeOfDay).toBeNull();
  });

  it("recorta el plan a 200 caracteres — el tope vive aquí, no en la DB", () => {
    const ctx = construirContexto(base(), { ...peticion, plan: "x".repeat(500) });
    expect(ctx.plan).toHaveLength(200);
  });

  it("re-inyecta el ancla desde allItems si el veto la había sacado", () => {
    const ctx = construirContexto(base(), { ...peticion, seedItemId: "vetada" });
    expect(ctx.seedItemId).toBe("vetada");
    expect(ctx.items.some((i) => i.id === "vetada")).toBe(true);
  });

  it("un ancla que ya no existe cae a sin-ancla, no truena", () => {
    const ctx = construirContexto(base(), { ...peticion, seedItemId: "borrada" });
    expect(ctx.seedItemId).toBeNull();
    expect(ctx.items).toHaveLength(3);
  });

  it("no muta la base: re-inyectar el ancla no ensucia items para la siguiente llamada", () => {
    const b = base();
    construirContexto(b, { ...peticion, seedItemId: "vetada" });
    expect(b.items).toHaveLength(3);
  });

  it("baraja el clóset en cada llamada pero con las MISMAS prendas", () => {
    const ctx = construirContexto(base(), peticion);
    expect(ctx.items.map((i) => i.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("sus palabras y el historial llegan tal cual", () => {
    const ctx = construirContexto(base(), peticion);
    expect(ctx.styleWords).toBe("limpio y sin estampados");
    expect(ctx.recentCombos).toEqual([["a", "b"]]);
  });
});
