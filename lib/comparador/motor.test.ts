import { describe, it, expect } from "vitest";
import {
  VARIANTES_MOTOR,
  variantePorClave,
  briefsPara,
  nRepetidos,
  ladoInvertido,
  ordenDelPar,
  opcionesDeVariante,
  pBinomial,
  marcadorMotor,
  estimadoMotor,
  N_VISTAZO,
  type ParMotor,
} from "./motor";

describe("variantes del motor", () => {
  it("las claves son únicas", () => {
    const claves = VARIANTES_MOTOR.map((v) => v.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("'produccion' es el control: sin flags y sin modelo propio", () => {
    const p = variantePorClave("produccion");
    expect(p).not.toBeNull();
    expect(p!.opciones).toBeUndefined();
    expect(p!.modeloId).toBeUndefined();
  });

  it("cada variante cambia UNA sola cosa (modelo O un flag, nunca ambos)", () => {
    for (const v of VARIANTES_MOTOR) {
      if (v.clave === "produccion") continue;
      const flags = Object.keys(v.opciones ?? {}).length;
      const cambios = (v.modeloId ? 1 : 0) + flags;
      expect(cambios, v.clave).toBe(1);
    }
  });
});

describe("briefs", () => {
  it("el vistazo siempre son 6, pida lo que pida quien llama", () => {
    expect(briefsPara("vistazo", 40)).toHaveLength(N_VISTAZO);
  });

  it("el veredicto cicla el pool y distingue las vueltas en la etiqueta", () => {
    const briefs = briefsPara("veredicto", 24);
    expect(briefs).toHaveLength(24);
    // La 2ª vuelta del pool (posición 10+) no repite etiqueta exacta.
    expect(briefs[10].etiqueta).not.toBe(briefs[0].etiqueta);
    expect(briefs[10].objective).toBe(briefs[0].objective);
  });

  it("espejos: 0 en vistazo, ~10% con mínimo 2 en veredicto", () => {
    expect(nRepetidos("vistazo", 6)).toBe(0);
    expect(nRepetidos("veredicto", 20)).toBe(2);
    expect(nRepetidos("veredicto", 40)).toBe(4);
  });
});

describe("el ciego", () => {
  it("es determinista: el mismo par siempre sale igual", () => {
    expect(ladoInvertido("abc-123")).toBe(ladoInvertido("abc-123"));
  });

  it("no está clavado en un solo lado", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `par-${i}-xyz`);
    const invertidos = ids.filter(ladoInvertido).length;
    expect(invertidos).toBeGreaterThan(10);
    expect(invertidos).toBeLessThan(40);
  });

  it("el espejo SIEMPRE muestra el orden inverso a su original", () => {
    const claves: [string, string] = ["a", "b"];
    for (let i = 0; i < 20; i++) {
      const original = ordenDelPar(`orig-${i}`, null, claves);
      const espejo = ordenDelPar(`esp-${i}`, `orig-${i}`, claves);
      expect(espejo).toEqual([original[1], original[0]]);
    }
  });
});

describe("opcionesDeVariante (el traductor que comparten ruta y smoke)", () => {
  const catalogo = (id: string) =>
    id === "modelo-x" ? { proveedor: "anthropic" as const, id, etiqueta: "X" } : null;

  it("producción = opciones vacías, sin modelo (cae al de lib/models)", () => {
    expect(opcionesDeVariante(variantePorClave("produccion")!, catalogo)).toEqual({});
  });

  it("una variante de flags pasa sus flags tal cual", () => {
    expect(
      opcionesDeVariante(variantePorClave("sin-blueprint")!, catalogo)
    ).toEqual({ sinBlueprint: true });
  });

  it("un modeloId que ya no está en el catálogo devuelve null, no producción en silencio", () => {
    expect(
      opcionesDeVariante(
        { clave: "x", etiqueta: "X", ayuda: "", modeloId: "ya-no-existe" },
        catalogo
      )
    ).toBeNull();
  });

  it("un modeloId vigente entra como modelo resuelto", () => {
    const o = opcionesDeVariante(
      { clave: "x", etiqueta: "X", ayuda: "", modeloId: "modelo-x" },
      catalogo
    );
    expect(o?.modelo?.id).toBe("modelo-x");
  });
});

describe("pBinomial (sign test)", () => {
  it("sin votos no dice nada", () => {
    expect(pBinomial(0, 0)).toBeNull();
  });

  it("un empate perfecto es puro azar (p = 1)", () => {
    expect(pBinomial(10, 10)).toBe(1);
  });

  it("15-5 apenas cruza el 0.05 (el caso que decide un veredicto de 20)", () => {
    const p = pBinomial(15, 5)!;
    expect(p).toBeGreaterThan(0.04);
    expect(p).toBeLessThan(0.05);
  });

  it("es simétrico", () => {
    expect(pBinomial(14, 6)).toBeCloseTo(pBinomial(6, 14)!, 10);
  });
});

const VARIANTES = [
  { clave: "a", etiqueta: "A" },
  { clave: "b", etiqueta: "B" },
];

function par(over: Partial<ParMotor>): ParMotor {
  return {
    id: "p1",
    n: 1,
    brief: { etiqueta: "diario · templado", objective: "diario", momento: "dia", weather: null },
    repiteDe: null,
    voto: null,
    defectos: null,
    nota: null,
    lados: [
      { variante: "a", looks: [], reviews: null, error: null, costoUsd: 0.2, ms: 30000 },
      { variante: "b", looks: [], reviews: null, error: null, costoUsd: 0.1, ms: 20000 },
    ],
    ...over,
  };
}

describe("marcadorMotor", () => {
  it("cuenta victorias y empates solo de pares reales votados", () => {
    const pares = [
      par({ id: "p1", voto: "a" }),
      par({ id: "p2", n: 2, voto: "a" }),
      par({ id: "p3", n: 3, voto: "empate" }),
      par({ id: "p4", n: 4, voto: null }), // sin votar: no cuenta
    ];
    const m = marcadorMotor(VARIANTES, pares);
    expect(m.votados).toBe(3);
    expect(m.empates).toBe(1);
    expect(m.variantes.find((v) => v.clave === "a")!.victorias).toBe(2);
    expect(m.variantes.find((v) => v.clave === "b")!.victorias).toBe(0);
  });

  it("los espejos no suman victorias: solo miden consistencia", () => {
    const pares = [
      par({ id: "p1", voto: "a" }),
      par({ id: "e1", n: 5, repiteDe: "p1", voto: "a" }), // coincide
      par({ id: "p2", n: 2, voto: "b" }),
      par({ id: "e2", n: 6, repiteDe: "p2", voto: "a" }), // se contradijo
    ];
    const m = marcadorMotor(VARIANTES, pares);
    expect(m.variantes.find((v) => v.clave === "a")!.victorias).toBe(1);
    expect(m.variantes.find((v) => v.clave === "b")!.victorias).toBe(1);
    expect(m.consistencia).toEqual({ espejos: 2, coinciden: 1 });
  });

  it("junta defectos por variante y saca promedios de costo y tiempo", () => {
    const pares = [
      par({ id: "p1", voto: "a", defectos: { b: ["clima", "color"] } }),
      par({ id: "p2", n: 2, voto: "b", defectos: { b: ["clima"] } }),
    ];
    const m = marcadorMotor(VARIANTES, pares);
    const b = m.variantes.find((v) => v.clave === "b")!;
    expect(b.defectos).toEqual({ clima: 2, color: 1 });
    expect(b.costoPromedio).toBeCloseTo(0.1);
    expect(b.msPromedio).toBe(20000);
  });

  it("los defectos marcados en un espejo SÍ cuentan (es etiquetado válido)", () => {
    const pares = [
      par({ id: "p1", voto: "a" }),
      par({ id: "e1", n: 5, repiteDe: "p1", voto: "a", defectos: { b: ["plano"] } }),
    ];
    const m = marcadorMotor(VARIANTES, pares);
    expect(m.variantes.find((v) => v.clave === "b")!.defectos).toEqual({ plano: 1 });
  });

  it("un lado con error cuenta como error, no desaparece", () => {
    const pares = [
      par({
        id: "p1",
        lados: [
          { variante: "a", looks: null, reviews: null, error: "tronó", costoUsd: null, ms: null },
          { variante: "b", looks: [], reviews: null, error: null, costoUsd: 0.1, ms: 20000 },
        ],
      }),
    ];
    const m = marcadorMotor(VARIANTES, pares);
    expect(m.variantes.find((v) => v.clave === "a")!.errores).toBe(1);
  });
});

describe("estimadoMotor", () => {
  it("da un número antes del botón, y Sonnet sale más barato que producción", () => {
    const dos = estimadoMotor(["produccion", "sonnet"], 20);
    expect(dos).not.toBeNull();
    expect(dos!).toBeGreaterThan(0);
    expect(estimadoMotor(["sonnet"], 20)!).toBeLessThan(
      estimadoMotor(["produccion"], 20)!
    );
  });

  it("una clave desconocida devuelve null, no un precio inventado", () => {
    expect(estimadoMotor(["produccion", "no-existe"], 20)).toBeNull();
  });
});
