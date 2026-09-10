import { describe, expect, it } from "vitest";
import {
  EVENTOS_QUE_NO_SON_VOLVER,
  MINIMO_PARA_VOLVER,
  SQL_ADQUISICION,
  diaEnZona,
  fuenteDe,
  resumirAdquisicion,
  sumarDias,
  ventanaCerrada,
  volvioEn7Dias,
  type FilaPerfilAdquisicion,
} from "./adquisicion";

const AHORA = new Date("2026-09-30T18:00:00.000Z");

function fila(p: Partial<FilaPerfilAdquisicion>): FilaPerfilAdquisicion {
  return {
    id: "u",
    email: null,
    gender: "hombre",
    onboarding_step: 5,
    inicio: "2026-09-14T17:00:00.000Z",
    dia_inicio: "2026-09-14",
    dias: ["2026-09-14"],
    origen: null,
    ...p,
  };
}

describe("fuenteDe", () => {
  it("utm_source manda; sin utm se reconoce la plataforma por su id de clic", () => {
    expect(fuenteDe({ landing: "/", at: "x", utm_source: "Google" })).toBe("google");
    expect(fuenteDe({ landing: "/", at: "x", gclid: "a" })).toBe("google (sin utm)");
    expect(fuenteDe({ landing: "/", at: "x", ttclid: "a" })).toBe("tiktok (sin utm)");
    expect(fuenteDe({ landing: "/", at: "x", referer: "www.google.com" })).toBe("google.com");
    expect(fuenteDe(null)).toBe("directo / sin rastro");
  });
});

describe("volvioEn7Dias — la columna que decide la campaña", () => {
  it("actividad sólo el día que arrancó NO es volver (el onboarding largo no cuenta dos veces)", () => {
    expect(volvioEn7Dias("2026-09-14", ["2026-09-14"])).toBe(false);
  });

  it("al día siguiente sí, y el día 7 todavía", () => {
    expect(volvioEn7Dias("2026-09-14", ["2026-09-14", "2026-09-15"])).toBe(true);
    expect(volvioEn7Dias("2026-09-14", ["2026-09-21"])).toBe(true);
  });

  it("el día 8 ya no", () => {
    expect(volvioEn7Dias("2026-09-14", ["2026-09-22"])).toBe(false);
  });

  it("cruza fin de mes", () => {
    expect(sumarDias("2026-09-28", 7)).toBe("2026-10-05");
  });
});

describe("ventanaCerrada — por calendario de CDMX, igual que 'volvió'", () => {
  it("una cuenta de hace 3 días todavía no puede contar como 'no volvió'", () => {
    expect(ventanaCerrada("2026-09-27", AHORA)).toBe(false);
    expect(ventanaCerrada("2026-09-22", AHORA)).toBe(true);
  });

  it("no se cierra mientras dure su día 7, aunque ya pasaran 7×24 h", () => {
    // Arrancó el 14 a las 00:30 CDMX; ahora es el 21 a la 01:30 CDMX (7 días y 1 hora).
    const ahora = new Date("2026-09-21T07:30:00.000Z");
    expect(diaEnZona(ahora)).toBe("2026-09-21");
    expect(ventanaCerrada("2026-09-14", ahora)).toBe(false);
    expect(ventanaCerrada("2026-09-14", new Date("2026-09-22T07:30:00.000Z"))).toBe(true);
  });
});

describe("SQL_ADQUISICION — los arreglos de 'volvió' viven en la consulta", () => {
  it("los tres caminos de actividad llevan el piso de horas, y los eventos la exclusión", () => {
    const pisos = SQL_ADQUISICION.match(new RegExp(`interval '${MINIMO_PARA_VOLVER}'`, "g")) ?? [];
    expect(pisos).toHaveLength(3);
    expect(SQL_ADQUISICION).toMatch(/e\.type <> all \(\$1::text\[\]\)/);
    expect(EVENTOS_QUE_NO_SON_VOLVER).toContain("email_unsubscribed");
  });

  it("no corta en silencio", () => {
    expect(SQL_ADQUISICION).not.toMatch(/\blimit\b/i);
  });
});

describe("resumirAdquisicion", () => {
  const google = { landing: "/", at: "x", utm_source: "google", utm_campaign: "hombres-search" };

  it("agrupa por fuente y campaña, y 'volvió' sólo se cuenta con la ventana cerrada", () => {
    const filas = [
      fila({ id: "a", origen: google, dias: ["2026-09-14", "2026-09-16"] }),
      fila({ id: "b", origen: google, gender: "mujer", onboarding_step: 3 }),
      // Arrancó hace 2 días: cuenta como cuenta, no como "no volvió".
      fila({ id: "c", origen: google, inicio: "2026-09-28T18:00:00.000Z", dia_inicio: "2026-09-28" }),
      fila({ id: "d", origen: null }),
    ];
    const r = resumirAdquisicion(filas, AHORA);
    expect(r[0]).toEqual({
      fuente: "google",
      campana: "hombres-search",
      cuentas: 3,
      hombres: 2,
      mujeres: 1,
      primerLook: 2,
      ventanaCerrada: 2,
      volvieron: 1,
    });
    expect(r.at(-1)?.fuente).toBe("directo / sin rastro");
  });

  it("un origen corrupto en la base cae en 'sin rastro' en vez de romper el panel", () => {
    const r = resumirAdquisicion([fila({ origen: "basura" }), fila({ origen: { utm_source: 3 } })], AHORA);
    expect(r).toHaveLength(1);
    expect(r[0].fuente).toBe("directo / sin rastro");
  });
});
