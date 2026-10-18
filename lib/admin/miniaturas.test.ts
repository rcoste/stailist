import { describe, it, expect } from "vitest";
import { detalleDePrendas, planDe, MAX_MINIATURAS } from "./miniaturas";
import type { Momento } from "./actividad";

// LO QUE BLINDA: qué líneas llevan miniaturas y cuáles no, y que el detalle
// "con foto / del catálogo" cuente sobre TODA la tanda, no sobre las seis que
// se enseñan: es la señal de activación (10 fotos propias el día 0).

const m = (tipo: Momento["tipo"], refIds: string[], extra: Partial<Momento> = {}): Momento => ({
  key: `k:${tipo}`,
  userId: "u",
  at: "2026-10-17T15:00:00Z",
  tipo,
  n: Math.max(1, refIds.length),
  refId: refIds.length === 1 ? refIds[0] : null,
  refIds,
  data: null,
  ...extra,
});

const items = Array.from({ length: 23 }, (_, i) => ({
  id: `i${i}`,
  user_id: "u",
  source: i < 19 ? "photo" : "checklist",
  created_at: "2026-10-17T14:00:00Z",
  deleted_at: null,
}));

describe("planDe", () => {
  it("una tanda de prendas: seis cuadritos, el total y cuántas fueron foto propia", () => {
    const p = planDe(m("prenda_add", items.map((i) => i.id)), items);
    expect(p).toEqual({
      clase: "prendas",
      ids: items.slice(0, MAX_MINIATURAS).map((i) => i.id),
      total: 23,
      conFoto: 19,
      deCatalogo: 4,
    });
  });

  it("un look, votado o generado, enseña ese look; la ráfaga cuenta los demás", () => {
    expect(planDe(m("look", ["o1"]), items)).toEqual({ clase: "look", outfitId: "o1", masLooks: 0 });
    expect(planDe(m("ev:vote_up", ["o1"]), items)).toEqual({ clase: "look", outfitId: "o1", masLooks: 0 });
    expect(planDe(m("look", ["o1", "o2", "o3"]), items)).toEqual({ clase: "look", outfitId: "o1", masLooks: 2 });
  });

  it("una generación fallida enseña el clóset con el que llegó", () => {
    const p = planDe(m("ev:generation_failed", []), items);
    expect(p?.clase).toBe("closet");
    expect(p && p.clase === "closet" ? p.total : 0).toBe(23);
  });

  it("lo que no toca nada no lleva miniaturas", () => {
    expect(planDe(m("visita", []), items)).toBeNull();
    expect(planDe(m("alta", []), items)).toBeNull();
    expect(planDe(m("ev:onboarding_step", []), items)).toBeNull();
    // Un voto de look de viaje no guarda el look (lib/trip-actions.ts): nada que enseñar.
    expect(planDe(m("ev:trip_look_vote", []), items)).toBeNull();
  });
});

describe("detalleDePrendas", () => {
  it("cuenta sobre toda la tanda y habla en singular cuando fue una", () => {
    expect(detalleDePrendas({ total: 23, conFoto: 19, deCatalogo: 4 })).toBe("19 con foto, 4 del catálogo");
    expect(detalleDePrendas({ total: 5, conFoto: 5, deCatalogo: 0 })).toBe("5 con foto");
    expect(detalleDePrendas({ total: 1, conFoto: 1, deCatalogo: 0 })).toBe("con foto");
    expect(detalleDePrendas({ total: 1, conFoto: 0, deCatalogo: 1 })).toBe("del catálogo");
    expect(detalleDePrendas({ total: 0, conFoto: 0, deCatalogo: 0 })).toBeNull();
  });
});
