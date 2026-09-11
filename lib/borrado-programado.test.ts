import { describe, expect, it } from "vitest";
import { DIAS_PARA_BORRAR, estaProgramada, fechaDeBorrado, fechaLegible, yaVencio } from "./borrado-programado";

describe("borrado programado", () => {
  it("son 30 días, como Instagram, TikTok y Google (cambiar esto cambia los textos legales)", () => {
    expect(DIAS_PARA_BORRAR).toBe(30);
  });

  it("la fecha de borrado es exactamente DIAS_PARA_BORRAR días después", () => {
    const pedido = new Date("2026-09-10T18:00:00.000Z");
    expect(fechaDeBorrado(pedido).toISOString()).toBe("2026-10-10T18:00:00.000Z");
  });

  it("la fecha se lee en español y en hora de CDMX (una fecha de madrugada UTC no se adelanta un día)", () => {
    expect(fechaLegible(new Date("2026-10-10T18:00:00.000Z"))).toBe("10 de octubre de 2026");
    // 03:00 UTC del 11 = 21:00 del 10 en CDMX.
    expect(fechaLegible(new Date("2026-10-11T03:00:00.000Z"))).toBe("10 de octubre de 2026");
  });

  it("vencida desde el instante exacto del plazo, igual que la limpieza (<= now())", () => {
    const para = new Date("2026-10-10T18:00:00.000Z");
    expect(yaVencio(para, new Date("2026-10-10T17:59:59.999Z"))).toBe(false);
    expect(yaVencio(para, para)).toBe(true);
  });

  it("programada sólo si hay fecha", () => {
    expect(estaProgramada({ borrado_programado_para: "2026-10-10T18:00:00.000Z" })).toBe(true);
    expect(estaProgramada({ borrado_programado_para: null })).toBe(false);
    expect(estaProgramada(null)).toBe(false);
  });
});
