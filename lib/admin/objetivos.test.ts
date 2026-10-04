import { describe, expect, it } from "vitest";
import type { FilaPerfilAdquisicion } from "./adquisicion";
import { fuenteDeCampana, type ResumenCampana } from "./campana";
import {
  OBJETIVOS,
  canalDe,
  diasCorridos,
  evaluarObjetivos,
  resumirUso,
  textoObjetivos,
  totalesPorCanal,
  type UsoCuenta,
} from "./objetivos";

// LO QUE SE BLINDA: que cada objetivo del plan P-03 caiga en el estado que el
// plan escribió antes de gastar. Un umbral mal leído aquí es una decisión de
// seguir o apagar un canal tomada con el número equivocado.

function fila(p: Partial<ResumenCampana>): ResumenCampana {
  return {
    fuente: "google",
    campana: "hombres-diario",
    impresiones: null,
    clics: null,
    costoMxn: null,
    registrosGoogle: null,
    pidieronCodigo: 0, landing: 0, boton: 0, correoVisto: 0, correoOk: 0,
    entraron: 0,
    registro: 0,
    pasos: [0, 0, 0, 0, 0],
    primerLook: 0,
    ttvMedianaS: null,
    ventanaCerrada: 0,
    volvieron: 0,
    seLoPusieron: 0,
    iaUsd: 0,
    ...p,
  };
}
const SIN_PARO = { estado: "faltan-datos", conPrimerLook: 0, cerradas: 0, volvieron: 0 } as const;
const linea = (resumen: ResumenCampana[], clave: string, hoy = "2026-10-10") =>
  evaluarObjetivos({ resumen, paro: SIN_PARO, hoy }).find((l) => l.clave === clave);

describe("canales", () => {
  it("lee el canal de la fuente, con o sin utm", () => {
    expect(canalDe("google")).toBe("google");
    expect(canalDe("google (sin utm)")).toBe("google");
    expect(canalDe("instagram")).toBe("meta");
    expect(canalDe("facebook")).toBe("meta");
    expect(canalDe("tiktok (sin utm)")).toBe("tiktok");
    expect(canalDe("chatgpt.com")).toBe("otro");
  });

  it("un gasto sin nadie adentro toma el canal del prefijo de su campaña", () => {
    expect(fuenteDeCampana("ig-etiqueta")).toBe("instagram");
    expect(fuenteDeCampana("tt-maleta")).toBe("tiktok");
    expect(fuenteDeCampana("hombres-diario")).toBe("google");
  });

  it("suma por canal y deja fuera lo que no es de anuncios", () => {
    const t = totalesPorCanal([
      fila({ fuente: "instagram", campana: "ig-etiqueta", clics: 10, impresiones: 1000, costoMxn: 100, registro: 2 }),
      fila({ fuente: "instagram", campana: "ig-maleta", clics: 5, impresiones: 500, costoMxn: 50, registro: 1 }),
      fila({ fuente: "directo / sin rastro", campana: "—", registro: 40 }),
    ]);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ canal: "meta", clics: 15, impresiones: 1500, costoMxn: 150, registro: 3 });
  });
});

describe("evaluarObjetivos", () => {
  it("el criterio de paro manda: 'pasa' es va bien, 'no pasa' es alarma", () => {
    const pasa = evaluarObjetivos({ resumen: [], paro: { estado: "pasa", conPrimerLook: 20, cerradas: 12, volvieron: 6 }, hoy: "2026-10-10" });
    expect(pasa[0]).toMatchObject({ clave: "recurrencia", estado: "bien" });
    const no = evaluarObjetivos({ resumen: [], paro: { estado: "no-pasa", conPrimerLook: 30, cerradas: 30, volvieron: 2 }, hoy: "2026-10-10" });
    expect(no[0].estado).toBe("alarma");
  });

  it("costo por registro: 200 o menos va bien, más de 400 es alarma, en medio se vigila", () => {
    expect(linea([fila({ costoMxn: 2000, registro: 10 })], "costo-registro")!.estado).toBe("bien");
    expect(linea([fila({ costoMxn: 3000, registro: 10 })], "costo-registro")!.estado).toBe("vigilar");
    expect(linea([fila({ costoMxn: 5000, registro: 10 })], "costo-registro")!.estado).toBe("alarma");
  });

  it("gastar más de 400 sin un solo registro ya es alarma, no 'faltan datos'", () => {
    expect(linea([fila({ costoMxn: 500, registro: 0 })], "costo-registro")!.estado).toBe("alarma");
    expect(linea([fila({ costoMxn: 100, registro: 0 })], "costo-registro")!.estado).toBe("sin-datos");
  });

  it("registro → primer look no se juzga con menos de la muestra mínima", () => {
    expect(linea([fila({ registro: OBJETIVOS.muestraMinima - 1, primerLook: 0 })], "registro-a-look")!.estado).toBe("sin-datos");
    expect(linea([fila({ registro: 10, primerLook: 2 })], "registro-a-look")!.estado).toBe("alarma");
    expect(linea([fila({ registro: 10, primerLook: 5 })], "registro-a-look")!.estado).toBe("bien");
  });

  it("el CTR de redes se mide con otra vara que el de búsqueda", () => {
    const r = [
      fila({ fuente: "google", clics: 20, impresiones: 1000, costoMxn: 1 }),
      fila({ fuente: "tiktok", campana: "tt-maleta", clics: 8, impresiones: 1000, costoMxn: 1 }),
    ];
    expect(linea(r, "ctr-google")!.estado).toBe("vigilar"); // 2%: entre 1.5 y 3
    expect(linea(r, "ctr-tiktok")!.estado).toBe("vigilar"); // 0.8%: entre 0.5 y 1
  });

  it("sin impresiones capturadas el CTR dice que faltan, no inventa", () => {
    expect(linea([fila({ clics: 20, costoMxn: 100 })], "ctr-google")).toMatchObject({ estado: "sin-datos", real: "—" });
  });

  it("apagar un canal: sólo con 2,000 gastados y más de 800 por primer look", () => {
    const antes = linea([fila({ fuente: "instagram", campana: "ig-x", costoMxn: 1500, primerLook: 1 })], "apagar-meta");
    expect(antes!.estado).not.toBe("alarma");
    const cumplio = linea([fila({ fuente: "instagram", campana: "ig-x", costoMxn: 2400, primerLook: 2 })], "apagar-meta");
    expect(cumplio).toMatchObject({ estado: "alarma", nota: "Se cumplió la regla: apagar este canal." });
    const nadie = linea([fila({ fuente: "instagram", campana: "ig-x", costoMxn: 2000, primerLook: 0 })], "apagar-meta");
    expect(nadie!.estado).toBe("alarma");
    const bien = linea([fila({ fuente: "instagram", campana: "ig-x", costoMxn: 2400, primerLook: 6 })], "apagar-meta");
    expect(bien!.estado).toBe("bien");
  });

  it("el tope mira el ritmo: a la mitad, gastar más de la mitad ya se vigila", () => {
    expect(diasCorridos("2026-09-30")).toBe(0);
    expect(diasCorridos("2026-10-09")).toBe(9);
    expect(diasCorridos("2026-10-30")).toBe(18);
    const r = [fila({ costoMxn: 8000 })];
    expect(linea(r, "tope", "2026-10-09")!.estado).toBe("vigilar"); // 8000/9*18 = 16,000
    expect(linea([fila({ costoMxn: 6000 })], "tope", "2026-10-09")!.estado).toBe("bien");
    expect(linea([fila({ costoMxn: 14000 })], "tope", "2026-10-30")!.estado).toBe("alarma");
  });
});

describe("resumirUso", () => {
  const ANUNCIO = { landing: "/", at: "2026-10-02T00:00:00Z", utm_source: "instagram", utm_campaign: "ig-etiqueta" };
  const persona = (id: string, p: Partial<FilaPerfilAdquisicion> = {}): FilaPerfilAdquisicion => ({
    id,
    email: null,
    gender: "hombre",
    onboarding_step: 5,
    inicio: "2026-10-02T17:00:00.000Z",
    dia_inicio: "2026-10-02",
    dias: null,
    origen: ANUNCIO,
    como_nos_conocio: null,
    ...p,
  });
  const nada = { viaje: false, capsula: false, prueba: false, fitcheck: false, adelantado: false };

  it("cuenta sólo a la gente de anuncios que llegó a su primer look", () => {
    const uso = new Map<string, UsoCuenta>([
      ["a", { ropaPropia: 12, looks: 4, modulos: { ...nada, prueba: true } }],
      ["b", { ropaPropia: 0, looks: 2, modulos: nada }],
      ["c", { ropaPropia: 30, looks: 9, modulos: { ...nada, viaje: true } }],
    ]);
    const r = resumirUso(
      [persona("a"), persona("b"), persona("c", { onboarding_step: 3 }), persona("d", { origen: null })],
      uso
    );
    expect(r).toMatchObject({ personas: 2, conRopaPropia: 1, looksMediana: 3 });
    expect(r.modulos).toMatchObject({ prueba: 1, viaje: 0 });
  });

  it("el correo dice el estado en palabras y trae el uso", () => {
    const lineas = evaluarObjetivos({ resumen: [fila({ costoMxn: 5000, registro: 10 })], paro: SIN_PARO, hoy: "2026-10-10" });
    const uso = resumirUso([persona("a")], new Map([["a", { ropaPropia: 5, looks: 3, modulos: nada }]]));
    const t = textoObjetivos(lineas, uso).join("\n");
    expect(t).toContain("[alarma] Costo por registro");
    expect(t).toContain("1 subieron ropa propia");
  });
});
