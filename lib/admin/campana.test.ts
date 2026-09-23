import { describe, expect, it } from "vitest";
import {
  PARO_MINIMO_VOLVIERON,
  PARO_MUESTRA,
  MXN_POR_USD,
  correoDiario,
  costoPor,
  criterioDeParo,
  esDeCampana,
  resumirCampana,
  textoParo,
  type ExtraCuenta,
} from "./campana";
import type { FilaPerfilAdquisicion } from "./adquisicion";

const AHORA = new Date("2026-10-30T18:00:00.000Z");
const ANUNCIO = { landing: "/", at: "2026-09-25T00:00:00Z", utm_source: "google", utm_campaign: "hombres-diario" };

function fila(p: Partial<FilaPerfilAdquisicion>): FilaPerfilAdquisicion {
  return {
    id: Math.random().toString(36).slice(2),
    email: null,
    gender: "hombre",
    onboarding_step: 5,
    inicio: "2026-09-25T17:00:00.000Z",
    dia_inicio: "2026-09-25",
    dias: ["2026-09-25"],
    origen: ANUNCIO,
    como_nos_conocio: null,
    ...p,
  };
}
const volvio = (p: Partial<FilaPerfilAdquisicion> = {}) => fila({ dias: ["2026-09-25", "2026-09-27"], ...p });
const noVolvio = (p: Partial<FilaPerfilAdquisicion> = {}) => fila({ dias: ["2026-09-25"], ...p });

describe("criterioDeParo — la decisión de escalar o parar", () => {
  it("con 6 que volvieron pasa, aunque la muestra no esté completa", () => {
    const filas = [...Array(6)].map(() => volvio());
    const p = criterioDeParo(filas, AHORA);
    expect(p.estado).toBe("pasa");
    expect(p.volvieron).toBe(PARO_MINIMO_VOLVIERON);
  });

  it("con 25 que cerraron su semana sin volver ya no se puede llegar a 6: no pasa", () => {
    const filas = [...Array(25)].map(() => noVolvio());
    expect(criterioDeParo(filas, AHORA).estado).toBe("no-pasa");
  });

  it("con 24 sin volver todavía se podría: faltan datos", () => {
    const filas = [...Array(24)].map(() => noVolvio());
    expect(criterioDeParo(filas, AHORA).estado).toBe("faltan-datos");
  });

  it("sólo cuenta las PRIMERAS 30 con primer look: la 31 que vuelve no salva la muestra", () => {
    const primeras = [...Array(PARO_MUESTRA)].map((_, i) =>
      noVolvio({ inicio: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00.000Z` })
    );
    const tarde = [...Array(10)].map(() => volvio({ inicio: "2026-10-10T10:00:00.000Z" }));
    const p = criterioDeParo([...tarde, ...primeras], AHORA);
    expect(p.conPrimerLook).toBe(PARO_MUESTRA);
    expect(p.volvieron).toBe(0);
    expect(p.estado).toBe("no-pasa");
  });

  it("no cuenta a quien no llegó a su primer look ni a quien no vino de un anuncio", () => {
    const filas = [
      ...[...Array(6)].map(() => volvio({ onboarding_step: 4 })),
      ...[...Array(6)].map(() => volvio({ origen: null })),
    ];
    const p = criterioDeParo(filas, AHORA);
    expect(p.conPrimerLook).toBe(0);
    expect(p.estado).toBe("faltan-datos");
  });

  it("una semana abierta no es 'no volvió': no empuja hacia no-pasa", () => {
    const hace2dias = { inicio: "2026-10-28T17:00:00.000Z", dia_inicio: "2026-10-28", dias: ["2026-10-28"] };
    const filas = [...Array(30)].map(() => fila(hace2dias));
    const p = criterioDeParo(filas, AHORA);
    expect(p.cerradas).toBe(0);
    expect(p.estado).toBe("faltan-datos");
  });

  it("el texto dice el veredicto en mayúsculas cuando ya hay veredicto", () => {
    expect(textoParo({ estado: "no-pasa", conPrimerLook: 30, cerradas: 30, volvieron: 2 })).toMatch(/^NO PASA/);
    expect(textoParo({ estado: "pasa", conPrimerLook: 12, cerradas: 8, volvieron: 6 })).toMatch(/^PASA/);
  });
});

describe("esDeCampana", () => {
  it("una etiqueta de campaña o un id de clic la hacen de campaña; un referer suelto no", () => {
    expect(esDeCampana({ landing: "/", at: "x", utm_campaign: "a" })).toBe(true);
    expect(esDeCampana({ landing: "/", at: "x", gclid: "a" })).toBe(true);
    expect(esDeCampana({ landing: "/", at: "x", referer: "instagram.com" })).toBe(false);
    // Instagram pega fbclid a cualquier link, también al de una publicación orgánica.
    expect(esDeCampana({ landing: "/", at: "x", fbclid: "a", referer: "l.instagram.com" })).toBe(false);
    expect(esDeCampana(null)).toBe(false);
  });
});

describe("resumirCampana — el embudo de punta a punta", () => {
  const extra = (p: Partial<ExtraCuenta>): ExtraCuenta => ({
    age_range: "25-34",
    ttv_s: 400,
    se_lo_puso: false,
    ia_usd_7d: 0.5,
    ...p,
  });

  it("junta en una fila lo de Google, las peticiones de código y lo de la base", () => {
    const a = volvio({ id: "a" });
    const b = noVolvio({ id: "b", onboarding_step: 2 });
    const [r] = resumirCampana({
      filas: [a, b],
      extras: new Map([
        ["a", extra({ ttv_s: 300, se_lo_puso: true })],
        ["b", extra({ ttv_s: null })],
      ]),
      codigos: [{ dia: "2026-09-25", fuente: "google", campana: "hombres-diario", nuevos: 5, recurrentes: 1 }],
      gasto: [
        { dia: "2026-09-25", campana: "hombres-diario", clics: 40, costo_mxn: 300, registros_google: 1 },
        { dia: "2026-09-26", campana: "hombres-diario", clics: 10, costo_mxn: 100, registros_google: null },
      ],
      ahora: AHORA,
    });
    expect(r).toMatchObject({
      fuente: "google",
      campana: "hombres-diario",
      clics: 50,
      costoMxn: 400,
      registrosGoogle: 1,
      pidieronCodigo: 5,
      entraron: 2,
      registro: 2,
      primerLook: 1,
      ttvMedianaS: 300,
      ventanaCerrada: 2,
      volvieron: 1,
      seLoPusieron: 1,
    });
    // gustos, colores, clóset, objetivo, primer look
    expect(r.pasos).toEqual([2, 2, 1, 1, 1]);
    expect(r.iaUsd).toBeCloseTo(1);
  });

  it("un menor de edad entra pero no cuenta como registro (Google tampoco lo cuenta)", () => {
    const [r] = resumirCampana({
      filas: [fila({ id: "m" })],
      extras: new Map([["m", extra({ age_range: "13-17" })]]),
      codigos: [],
      gasto: [],
      ahora: AHORA,
    });
    expect(r.entraron).toBe(1);
    expect(r.registro).toBe(0);
  });

  it("una campaña con gasto y nadie adentro TAMBIÉN sale: es justo el caso malo", () => {
    const rs = resumirCampana({
      filas: [],
      extras: new Map(),
      codigos: [],
      gasto: [{ dia: "2026-09-25", campana: "hombres-eventos", clics: 80, costo_mxn: 600, registros_google: 0 }],
      ahora: AHORA,
    });
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ fuente: "google", campana: "hombres-eventos", costoMxn: 600, entraron: 0 });
  });

  it("lo que no tiene rastro va al final", () => {
    const rs = resumirCampana({
      filas: [fila({ origen: null }), fila({ origen: null }), volvio()],
      extras: new Map(),
      codigos: [],
      gasto: [],
      ahora: AHORA,
    });
    expect(rs.at(-1)!.fuente).toBe("directo / sin rastro");
  });
});

describe("costoPor", () => {
  it("suma el anuncio y la IA convertida, entre las personas", () => {
    const [r] = resumirCampana({
      filas: [fila({ id: "a" })],
      extras: new Map([["a", { age_range: "25-34", ttv_s: 1, se_lo_puso: false, ia_usd_7d: 2 }]]),
      codigos: [],
      gasto: [{ dia: "2026-09-25", campana: "hombres-diario", clics: 1, costo_mxn: 100, registros_google: null }],
      ahora: AHORA,
    });
    expect(costoPor(r, 1)).toBeCloseTo(100 + 2 * MXN_POR_USD);
    expect(costoPor(r, 1, false)).toBe(100);
    expect(costoPor(r, 0)).toBeNull();
  });
});

describe("correoDiario", () => {
  it("el asunto dice lo de ayer y el cuerpo trae el criterio de paro y el link", () => {
    const { subject, text } = correoDiario({
      ayer: "2026-10-29",
      iaAyerUsd: 1.234,
      iaAyerLlamadas: 42,
      iaTop: { correo: "alguien@ejemplo.test", usd: 0.9 },
      nuevasAyer: 3,
      nuevasAyerDeCampana: 2,
      primerLookAyer: 1,
      campanas: [],
      paro: { estado: "faltan-datos", conPrimerLook: 4, cerradas: 1, volvieron: 1 },
      desde: "2026-09-25",
    });
    expect(subject).toBe("stailist · 2026-10-29: $1.23 de IA · 3 cuentas nuevas (2 de anuncios)");
    expect(text).toContain("faltan datos");
    expect(text).toContain("alguien@ejemplo.test");
    expect(text).toContain("https://stailist.co/admin/campana");
  });
});
