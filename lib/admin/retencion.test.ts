import { describe, expect, it } from "vitest";
import { curva, diasEntre, fila, volvieronEnSuSemana, type PersonaRetencion } from "./retencion";
import { opcionesDe, pasaFiltro } from "./filtro-personas";

// LO QUE BLINDAN: que la curva no se hunda con gente que todavía no tiene cómo
// haber vuelto, y que la fila distinga "no entró" de "ese día no ha llegado".

const HOY = "2026-10-20";
const p = (id: string, diaInicio: string, dias: number[]): PersonaRetencion => ({ id, etiqueta: id, diaInicio, dias });

describe("fila", () => {
  it("día 0 siempre entró; lo vivido sin rastro es 'no'; hoy y lo que viene es 'futuro'", () => {
    const f = fila(p("a", "2026-10-17", [1]), HOY, 5);
    // 17 = día 0, 18 = día 1 (entró), 19 = día 2 (no), 20 = hoy, día 3 (futuro).
    expect(f).toEqual(["entro", "entro", "no", "futuro", "futuro", "futuro"]);
  });

  it("si hoy ya entró, hoy cuenta como entró", () => {
    expect(fila(p("a", "2026-10-17", [3]), HOY, 3)[3]).toBe("entro");
  });
});

describe("curva", () => {
  it("el denominador del día N es sólo quien ya vivió ese día completo", () => {
    const personas = [
      p("vieja-volvio", "2026-10-01", [1, 7]),
      p("vieja-no", "2026-10-01", []),
      p("de-ayer", "2026-10-19", []),
    ];
    const c = curva(personas, HOY);
    const d1 = c.find((x) => x.dia === 1)!;
    const d7 = c.find((x) => x.dia === 7)!;
    // La de ayer vive hoy su día 1: todavía no cuenta.
    expect(d1).toEqual({ dia: 1, volvieron: 1, de: 2 });
    expect(d7).toEqual({ dia: 7, volvieron: 1, de: 2 });
  });
});

describe("volvieronEnSuSemana", () => {
  it("cuenta a quien volvió entre el día 1 y el 7, entre quienes cerraron su semana", () => {
    const r = volvieronEnSuSemana(
      [p("si", "2026-10-01", [3]), p("tarde", "2026-10-01", [9]), p("abierta", "2026-10-15", [1])],
      HOY
    );
    expect(r).toEqual({ volvieron: 1, de: 2 });
  });
});

describe("diasEntre", () => {
  it("cuenta días de calendario", () => {
    expect(diasEntre("2026-10-30", "2026-11-02")).toBe(3);
  });
});

describe("pasaFiltro (compartido con el embudo)", () => {
  const co = { campana: "app-neutra-co", pais: "CO" };
  const org = { campana: "—", pais: "MX" };
  it("anuncios, sin anuncio, una campaña y un país", () => {
    expect(pasaFiltro(co, { origen: "anuncios", pais: "todos" })).toBe(true);
    expect(pasaFiltro(org, { origen: "anuncios", pais: "todos" })).toBe(false);
    expect(pasaFiltro(org, { origen: "organico", pais: "MX" })).toBe(true);
    expect(pasaFiltro(co, { origen: "app-neutra", pais: "todos" })).toBe(false);
    expect(pasaFiltro({ campana: "—", pais: null }, { origen: "todas", pais: "sin" })).toBe(true);
  });
  it("las campañas de prueba nunca pasan ni salen como opción", () => {
    const prueba = { campana: "prueba-borrador", pais: "MX" };
    expect(pasaFiltro(prueba, { origen: "todas", pais: "todos" })).toBe(false);
    expect(opcionesDe([prueba, co, org])).toEqual({ campanas: ["app-neutra-co"], paises: ["CO", "MX"] });
  });
});
