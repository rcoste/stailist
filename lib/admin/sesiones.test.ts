import { describe, it, expect } from "vitest";
import { construirFeed, etiqueta, type Momento } from "@/lib/admin/actividad";
import { duracion, resumir, sesiones } from "@/lib/admin/sesiones";

const m = (tipo: Momento["tipo"], at: string, n = 1, data: Record<string, unknown> | null = null): Momento => ({
  key: `${tipo}|${at}`,
  userId: "u",
  at,
  tipo,
  n,
  data,
});

describe("sesiones", () => {
  it("corta cuando pasan más de 30 minutos y devuelve de la más reciente a la más vieja", () => {
    const s = sesiones([
      m("look", "2026-10-13T16:25:00Z"),
      m("look", "2026-10-13T16:31:00Z"),
      m("prenda_add", "2026-10-13T19:30:00Z", 25),
      m("prenda_del", "2026-10-13T20:22:00Z", 6),
      m("prenda_del", "2026-10-13T19:58:00Z"),
    ]);
    expect(s).toHaveLength(2);
    expect(s[0].desde).toBe("2026-10-13T19:30:00Z");
    expect(s[0].minutos).toBe(52);
    expect(s[0].resumen.modulos).toEqual([{ modulo: "closet", nombre: "Clóset", partes: ["añadió 25", "borró 7"] }]);
    expect(s[1].resumen.modulos[0]).toMatchObject({ modulo: "looks", partes: ["generó 2"] });
  });

  it("entrar y no hacer nada es su propia señal", () => {
    const [s] = sesiones([m("visita", "2026-10-13T16:25:00Z", 3)]);
    expect(s.soloAbrio).toBe(true);
    expect(s.resumen.modulos).toEqual([]);
  });

  it("lo que hace la app sola va aparte y no cuenta como uso", () => {
    const [s] = sesiones([m("ev:render_auto", "2026-10-13T03:06:00Z", 52)]);
    expect(s.soloSistema).toBe(true);
    expect(s.resumen).toEqual({ modulos: [], sistema: 52 });
  });
});

describe("resumir", () => {
  it("el viaje junta sus looks, votos y cambios; el espejo no se cuenta dos veces", () => {
    const r = resumir([
      m("look_viaje", "2026-10-13T20:00:00Z", 22),
      m("ev:trip_look_vote", "2026-10-13T20:10:00Z", 24),
      m("ev:trip_item_swap", "2026-10-13T20:12:00Z", 13),
      m("ev:trip_outfits_generated", "2026-10-13T20:13:00Z", 5),
      m("ev:espejo_subido", "2026-10-13T20:20:00Z"),
      m("ev:worn", "2026-10-13T20:20:00Z", 1, { via: "espejo" }),
    ]);
    expect(r.modulos).toEqual([
      { modulo: "viaje", nombre: "Viaje", partes: ["22 looks", "24 votos", "13 cambios de prenda"] },
      { modulo: "espejo", nombre: "Espejo", partes: ["subió 1"] },
    ]);
  });

  it("si llegó a su primer look, los pasos del onboarding sobran", () => {
    const r = resumir([m("ev:onboarding_step", "2026-10-12T21:00:00Z", 9), m("ev:first_outfit_ttv", "2026-10-12T21:10:00Z")]);
    expect(r.modulos).toEqual([{ modulo: "onboarding", nombre: "Onboarding", partes: ["llegó a su primer look"] }]);
  });

  it("un evento sin casilla sale con su nombre en Otros, no se esconde", () => {
    const r = resumir([m("ev:algo_nuevo", "2026-10-12T21:00:00Z", 2)]);
    expect(r.modulos).toEqual([{ modulo: "otros", nombre: "Otros", partes: ["algo_nuevo ×2"] }]);
  });
});

describe("construirFeed: lo que la persona hizo vs lo que hizo la app", () => {
  const base = { profiles: [], items: [], trips: [], wishlist: [] };
  it("sólo el dibujo forzado es suyo; los demás los hizo la app", () => {
    const feed = construirFeed({
      ...base,
      outfits: [],
      events: [
        { user_id: "u", outfit_id: null, type: "render_generated", data: { forzado: true }, created_at: "2026-10-12T10:00:00Z" },
        { user_id: "u", outfit_id: null, type: "render_generated", data: { forzado: false, pendiente: true }, created_at: "2026-10-12T12:00:00Z" },
        { user_id: "u", outfit_id: null, type: "render_generated", data: { forzado: false, pendiente: true }, created_at: "2026-10-12T12:01:00Z" },
      ],
    });
    expect(feed.map(etiqueta)).toEqual(["la app dibujó 2 prendas", "rehízo el dibujo de una prenda"]);
  });

  it("el espejo no sale como look generado y el viaje sale como look de viaje", () => {
    const feed = construirFeed({
      ...base,
      events: [],
      outfits: [
        { id: "a", user_id: "u", created_at: "2026-10-12T10:00:00Z", deleted_at: null, source: "espejo" },
        { id: "b", user_id: "u", created_at: "2026-10-12T11:00:00Z", deleted_at: null, source: "viaje" },
        { id: "c", user_id: "u", created_at: "2026-10-12T12:00:00Z", deleted_at: null, source: "daily" },
      ],
    });
    expect(feed.map(etiqueta)).toEqual(["generó un look", "generó un look de viaje"]);
  });
});

describe("duracion", () => {
  it("en palabras", () => {
    expect([0, 6, 60, 138].map(duracion)).toEqual(["menos de 1 min", "6 min", "1 h", "2 h 18 min"]);
  });
});

describe("resumir: orden estable", () => {
  it("primero lo que añade, luego lo que borra, sin importar cuál llegó antes", () => {
    const r = resumir([m("prenda_del", "2026-10-13T20:00:00Z", 16), m("prenda_add", "2026-10-13T19:00:00Z", 12)]);
    expect(r.modulos[0].partes).toEqual(["añadió 12", "borró 16"]);
  });

  it("el alta también sobra cuando llegó a su primer look", () => {
    const r = resumir([m("alta", "2026-10-12T21:00:00Z"), m("ev:first_outfit_ttv", "2026-10-12T21:10:00Z")]);
    expect(r.modulos[0].partes).toEqual(["llegó a su primer look"]);
  });
});
