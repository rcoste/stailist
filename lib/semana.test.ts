import { describe, expect, it } from "vitest";
import {
  EN_FILA,
  MIN_PRENDAS_SEMANA,
  diasOfrecidos,
  estadoDelDia,
  ocupaLaFecha,
  validarPeticion,
} from "./semana";

// Miércoles 16 de septiembre de 2026 (hora local de quien pide).
const HOY = "2026-09-16";

describe("los días que se ofrecen", () => {
  it("son los 7 siguientes, empezando MAÑANA (hoy ya tiene su look)", () => {
    const dias = diasOfrecidos(HOY);
    expect(dias.map((d) => d.fecha)).toEqual([
      "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20",
      "2026-09-21", "2026-09-22", "2026-09-23",
    ]);
    expect(dias.map((d) => d.dia)).toEqual(["jue", "vie", "sáb", "dom", "lun", "mar", "mié"]);
  });

  it("marca el fin de semana para que arranque apagado", () => {
    expect(diasOfrecidos(HOY).filter((d) => d.finDeSemana).map((d) => d.dia)).toEqual(["sáb", "dom"]);
  });

  it("cruza bien el fin de mes", () => {
    expect(diasOfrecidos("2026-09-29")[2].fecha).toBe("2026-10-02");
  });
});

describe("validarPeticion", () => {
  it("acepta días de la ventana y los ordena por calendario", () => {
    const v = validarPeticion(
      [
        { fecha: "2026-09-21", ocasion: "oficina" },
        { fecha: "2026-09-17", ocasion: "diario" },
      ],
      HOY
    );
    expect(v).toEqual({
      ok: true,
      dias: [
        { fecha: "2026-09-17", ocasion: "diario" },
        { fecha: "2026-09-21", ocasion: "oficina" },
      ],
    });
  });

  it("rechaza hoy, días fuera de la ventana, repetidos u ocasiones inventadas", () => {
    expect(validarPeticion([{ fecha: HOY, ocasion: "diario" }], HOY).ok).toBe(false);
    expect(validarPeticion([{ fecha: "2026-09-30", ocasion: "diario" }], HOY).ok).toBe(false);
    expect(
      validarPeticion(
        [
          { fecha: "2026-09-17", ocasion: "diario" },
          { fecha: "2026-09-17", ocasion: "oficina" },
        ],
        HOY
      ).ok
    ).toBe(false);
    expect(validarPeticion([{ fecha: "2026-09-17", ocasion: "boda" }], HOY).ok).toBe(false);
    // Evento no se ofrece en la semana (necesita tipo y formalidad).
    expect(validarPeticion([{ fecha: "2026-09-17", ocasion: "evento" }], HOY).ok).toBe(false);
  });

  it("sin días no es una semana", () => {
    expect(validarPeticion([], HOY)).toEqual({ ok: false, error: "sin_dias" });
    expect(validarPeticion(undefined, HOY)).toEqual({ ok: false, error: "sin_dias" });
  });

  it("el mínimo de prendas sigue siendo el acordado", () => {
    expect(MIN_PRENDAS_SEMANA).toBe(10);
  });
});


describe("el estado de un día", () => {
  const AHORA = Date.parse("2026-09-16T18:00:00Z");
  const hace = (ms: number) => new Date(AHORA - ms).toISOString();
  const STALE = 150_000;

  it("en fila no se muere a los 150 s: espera su turno", () => {
    expect(estadoDelDia({ gen_status: "generating", gen_error: EN_FILA, created_at: hace(4 * 60_000) }, AHORA, STALE)).toBe("en_fila");
  });

  it("en fila no muere por edad: se retoma en la siguiente lectura", () => {
    expect(estadoDelDia({ gen_status: "generating", gen_error: EN_FILA, created_at: hace(60 * 60_000) }, AHORA, STALE)).toBe("en_fila");
  });

  it("generando usa el mismo reloj que el look del día", () => {
    expect(estadoDelDia({ gen_status: "generating", gen_error: null, created_at: hace(60_000) }, AHORA, STALE)).toBe("generando");
    expect(estadoDelDia({ gen_status: "generating", gen_error: null, created_at: hace(STALE + 1) }, AHORA, STALE)).toBe("error");
  });

  it("un día colgado o fallido libera la fecha para volver a pedirla", () => {
    const colgado = estadoDelDia({ gen_status: "generating", gen_error: null, created_at: hace(STALE + 1) }, AHORA, STALE);
    expect(ocupaLaFecha(colgado)).toBe(false);
    expect(ocupaLaFecha("listo")).toBe(true);
    expect(ocupaLaFecha("en_fila")).toBe(true);
  });
});
