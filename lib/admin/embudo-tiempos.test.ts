import { describe, it, expect } from "vitest";
import {
  TOPE_TRAMO_S,
  fmtSegundos,
  mediana,
  tiemposPorTramo,
  type EventoPaso,
} from "./embudo-tiempos";

const t0 = Date.parse("2026-09-06T10:00:00Z");
const at = (s: number) => new Date(t0 + s * 1000).toISOString();
const inicio = (u: string, s: number): EventoPaso => ({
  user_id: u,
  created_at: at(s),
  type: "onboarding_started",
  data: null,
});
const pre = (u: string, paso: "genero" | "edad", s: number): EventoPaso => ({
  user_id: u,
  created_at: at(s),
  type: "onboarding_step",
  data: { step: 0, paso },
});
const step = (u: string, n: number, s: number): EventoPaso => ({
  user_id: u,
  created_at: at(s),
  type: "onboarding_step",
  data: { step: n },
});

// Una persona que hace todo el onboarding de corrido, con tiempos redondos.
const ana: EventoPaso[] = [
  inicio("ana", 0),
  pre("ana", "genero", 10),
  pre("ana", "edad", 20),
  step("ana", 1, 80), // 60 s de swipes
  step("ana", 2, 140),
  step("ana", 3, 230),
  step("ana", 4, 240),
  step("ana", 5, 270),
];

describe("mediana", () => {
  it("impar, par y vacío", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(3);
    expect(mediana([])).toBeNull();
  });
});

describe("tiemposPorTramo", () => {
  it("reconstruye cada tramo como la resta contra el paso anterior", () => {
    const r = Object.fromEntries(tiemposPorTramo(ana).map((t) => [t.llave, t.medianaS]));
    expect(r).toEqual({ genero: 10, edad: 10, "1": 60, "2": 60, "3": 90, "4": 10, "5": 30 });
  });

  it("toma el PRIMER evento de cada paso: repetirlo no lo hace más rápido", () => {
    const conRepeticion = [...ana, step("ana", 2, 500)]; // colorimetría rehecha después
    const r = tiemposPorTramo(conRepeticion).find((t) => t.llave === "2")!;
    expect(r.medianaS).toBe(60);
  });

  it("un tramo de más de dos horas es 'se fue y volvió', no cuenta", () => {
    const beto: EventoPaso[] = [
      inicio("beto", 0),
      pre("beto", "genero", 5),
      pre("beto", "edad", 10),
      step("beto", 1, 10 + TOPE_TRAMO_S + 1), // volvió al día siguiente
    ];
    const r = tiemposPorTramo([...ana, ...beto]);
    const gustos = r.find((t) => t.llave === "1")!;
    expect(gustos.n).toBe(1); // sólo ana
    expect(gustos.medianaS).toBe(60);
  });

  it("quien no tiene el paso anterior no aporta a ese tramo", () => {
    // Perfil viejo: sin onboarding_started ni pre-pasos, sólo steps 1-5.
    const vieja: EventoPaso[] = [step("v", 1, 0), step("v", 2, 100), step("v", 5, 400)];
    const r = tiemposPorTramo(vieja);
    expect(r.find((t) => t.llave === "genero")!.n).toBe(0);
    expect(r.find((t) => t.llave === "2")!.medianaS).toBe(100);
    // sin 3 ni 4 no hay tramo 3, 4 ni 5
    expect(r.find((t) => t.llave === "5")!.n).toBe(0);
  });

  it("la mediana se calcula entre personas", () => {
    const rapida = [...ana].map((e) => ({ ...e, user_id: "r" }));
    const lenta: EventoPaso[] = ana.map((e) =>
      e.user_id === "ana"
        ? { ...e, user_id: "l", created_at: at(Math.round((Date.parse(e.created_at) - t0) / 1000) * 3) }
        : e
    );
    const r = tiemposPorTramo([...ana, ...rapida, ...lenta]);
    const swipes = r.find((t) => t.llave === "1")!;
    expect(swipes.n).toBe(3);
    expect(swipes.medianaS).toBe(60); // 60, 60, 180 → 60
  });

  it("ignora eventos que no cierran ningún tramo", () => {
    const ruido: EventoPaso = {
      user_id: "ana",
      created_at: at(5),
      type: "onboarding_step",
      data: { step: 9 },
    };
    expect(tiemposPorTramo([...ana, ruido])).toEqual(tiemposPorTramo(ana));
  });
});

describe("fmtSegundos", () => {
  it("segundos, minutos redondos y mezcla", () => {
    expect(fmtSegundos(45)).toBe("45s");
    expect(fmtSegundos(120)).toBe("2m");
    expect(fmtSegundos(103)).toBe("1m 43s");
    expect(fmtSegundos(null)).toBe("—");
  });
});
