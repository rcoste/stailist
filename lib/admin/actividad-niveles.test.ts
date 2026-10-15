import { describe, it, expect } from "vitest";
import { construirFeed, dispositivoPorDia, esImportante, nivelDe, EVENTO_LABEL, type FuentesCrudas } from "./actividad";

// LO QUE BLINDAN: que lo que el experimento vino a medir (alguien se puso un
// look, lo votó, se topó con un error) no se vea igual que "abrió la app", y
// que el aparato salga del día correcto.

describe("nivelDe", () => {
  it("la señal de oro y los votos — los dos — son lo que buscamos", () => {
    for (const t of ["ev:worn", "ev:espejo_subido", "ev:vote_up", "ev:vote_down", "ev:outfit_favorited", "ev:pwa_installed"] as const)
      expect(nivelDe({ tipo: t })).toBe("oro");
  });

  it("usar lo que el producto promete es valor; abrir y catalogar, rutina", () => {
    expect(nivelDe({ tipo: "look" })).toBe("valor");
    expect(nivelDe({ tipo: "viaje" })).toBe("valor");
    expect(nivelDe({ tipo: "ev:first_outfit_ttv" })).toBe("valor");
    expect(nivelDe({ tipo: "visita" })).toBe("rutina");
    expect(nivelDe({ tipo: "prenda_add" })).toBe("rutina");
    expect(nivelDe({ tipo: "ev:onboarding_step" })).toBe("rutina");
  });

  it("un error no puede verse como rutina", () => {
    expect(nivelDe({ tipo: "ev:generation_failed" })).toBe("falla");
    expect(nivelDe({ tipo: "ev:avatar_fallo" })).toBe("falla");
    expect(esImportante({ tipo: "ev:generation_failed" })).toBe(true);
  });

  it("un tipo sin nivel sale en gris, no desaparece", () => {
    expect(nivelDe({ tipo: "ev:algo_nuevo" })).toBe("rutina");
    expect(esImportante({ tipo: "ev:algo_nuevo" })).toBe(false);
  });

  it("todo evento con nombre propio tiene un nivel pensado o es rutina a propósito", () => {
    // Si alguien bautiza un evento nuevo, este test le recuerda decidir su nivel.
    const rutinaAProposito = new Set([
      "trip_deleted", "item_deleted", "style_vetoes_edit", "colorimetria_edit", "perfil_estilo_view",
      "onboarding_step", "cuenta_borrado_programado", "cuenta_recuperada", "render_generated",
      "onboarding_started", "email_unsubscribed",
    ]);
    const sinDecidir = Object.keys(EVENTO_LABEL).filter(
      (t) => nivelDe({ tipo: `ev:${t}` }) === "rutina" && !rutinaAProposito.has(t)
    );
    expect(sinDecidir).toEqual([]);
  });
});

describe("dispositivoPorDia", () => {
  it("usa el día de CDMX: la noche del 13 en México sigue siendo el 13", () => {
    const mapa = dispositivoPorDia([
      { user_id: "u", type: "visita", data: { dia: "2026-10-13", dispositivo: "computadora" }, created_at: "2026-10-14T03:00:00Z" },
      { user_id: "u", type: "visita", data: { dia: "2026-10-14", dispositivo: "celular" }, created_at: "2026-10-14T15:00:00Z" },
      { user_id: "u", type: "vote_up", data: { dispositivo: "tablet" }, created_at: "2026-10-14T16:00:00Z" },
      { user_id: "v", type: "visita", data: { dia: "2026-10-14" }, created_at: "2026-10-14T16:00:00Z" },
    ]);
    expect(mapa.get("u|2026-10-13")).toBe("computadora");
    expect(mapa.get("u|2026-10-14")).toBe("celular");
    // Visitas de antes del cambio no traen aparato: no se inventa.
    expect(mapa.has("v|2026-10-14")).toBe(false);
  });
});

describe("construirFeed con espejos", () => {
  it("un espejo no sale también como look generado", () => {
    const f: FuentesCrudas = {
      profiles: [],
      items: [],
      outfits: [
        { id: "o1", user_id: "u", created_at: "2026-10-14T15:00:00Z", deleted_at: null, source: "espejo" },
        { id: "o2", user_id: "u", created_at: "2026-10-14T12:00:00Z", deleted_at: null, source: null },
      ],
      trips: [],
      wishlist: [],
      events: [],
    };
    expect(construirFeed(f).map((m) => m.tipo)).toEqual(["look"]);
  });
});
