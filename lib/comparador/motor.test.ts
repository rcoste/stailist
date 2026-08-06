import { describe, it, expect } from "vitest";
import {
  VARIANTES_MOTOR,
  variantePorClave,
  briefsPara,
  nRepetidos,
  ladoInvertido,
  ordenDelPar,
  votoDelPar,
  opcionesDeVariante,
  pBinomial,
  marcadorMotor,
  resumenPorRetador,
  estimadoMotor,
  LIMITE_VERCEL_MS,
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

describe("votoDelPar (deriva el par de los votos por look)", () => {
  it("mayoría simple decide", () => {
    expect(votoDelPar({ "0": "a", "1": "a", "2": "b" })).toBe("a");
  });

  it("un look ganado y dos empatados lo gana quien ganó", () => {
    expect(votoDelPar({ "0": "a", "1": "empate", "2": "empate" })).toBe("a");
  });

  it("empatados en victorias = empate del par", () => {
    expect(votoDelPar({ "0": "a", "1": "b" })).toBe("empate");
  });

  it("todos empatados = empate, no pendiente", () => {
    expect(votoDelPar({ "0": "empate", "1": "empate" })).toBe("empate");
  });

  it("sin votos = pendiente (null), no empate", () => {
    expect(votoDelPar({})).toBeNull();
    expect(votoDelPar(null)).toBeNull();
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
    marcasLook: null,
    defectosLook: null,
    comentariosLook: null,
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

  it("cuenta los looks marcados 👍/👎 por variante, sin mezclarlos con victorias", () => {
    const pares = [
      par({
        id: "p1",
        voto: "a",
        marcasLook: { a: { "0": "arriba", "1": "arriba" }, b: { "0": "abajo" } },
      }),
      par({ id: "p2", n: 2, voto: "empate", marcasLook: { b: { "2": "arriba" } } }),
    ];
    const m = marcadorMotor(VARIANTES, pares);
    const a = m.variantes.find((v) => v.clave === "a")!;
    const b = m.variantes.find((v) => v.clave === "b")!;
    expect([a.looksArriba, a.looksAbajo]).toEqual([2, 0]);
    expect([b.looksArriba, b.looksAbajo]).toEqual([1, 1]);
    // Las marcas NO son votos: 'a' ganó UN par pese a tener dos looks 👍.
    expect(a.victorias).toBe(1);
  });

  it("suma los defectos por look junto con los del formato viejo por lado", () => {
    const pares = [
      par({ id: "p1", voto: "a", defectos: { b: ["clima"] } }), // formato viejo
      par({ id: "p2", n: 2, voto: "a", defectosLook: { b: { "0": ["clima"], "2": ["color"] } } }),
    ];
    const b = marcadorMotor(VARIANTES, pares).variantes.find((v) => v.clave === "b")!;
    expect(b.defectos).toEqual({ clima: 2, color: 1 });
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

describe("resumenPorRetador", () => {
  const base = {
    corridas: [
      { id: "c1", variantes: [{ clave: "produccion", etiqueta: "Producción" }, { clave: "sonnet", etiqueta: "Sonnet 5" }] },
      { id: "c2", variantes: [{ clave: "produccion", etiqueta: "Producción" }, { clave: "kimi", etiqueta: "Kimi" }] },
    ],
    pares: [
      { corrida_id: "c1", voto: "produccion" },
      { corrida_id: "c1", voto: "empate" },
      { corrida_id: "c1", voto: "sonnet" },
      { corrida_id: "c1", voto: null }, // sin votar: no cuenta
      { corrida_id: "c2", voto: "kimi" },
      { corrida_id: "c2", voto: "kimi" },
    ],
    lados: [
      { corrida_id: "c1", variante: "produccion", costo_usd: 0.26, ms: 55000, error: null },
      { corrida_id: "c1", variante: "sonnet", costo_usd: 0.18, ms: 51000, error: null },
      { corrida_id: "c2", variante: "produccion", costo_usd: 0.26, ms: 55000, error: null },
      { corrida_id: "c2", variante: "kimi", costo_usd: 0.16, ms: 129000, error: null },
      { corrida_id: "c2", variante: "kimi", costo_usd: null, ms: null, error: "TRUNCATED" },
    ],
  };

  it("cuenta victorias del control y del retador por separado, sin los sin-votar", () => {
    const r = resumenPorRetador(base);
    const s = r.find((x) => x.clave === "sonnet")!;
    expect([s.ganaControl, s.ganaRetador, s.empates, s.paresVotados]).toEqual([1, 1, 1, 3]);
  });

  it("ordena por quién le ganó más al control — el orden de la decisión", () => {
    expect(resumenPorRetador(base)[0].clave).toBe("kimi"); // 2 victorias contra 1
  });

  it("separa costo y tiempo del retador del de SU control", () => {
    const k = resumenPorRetador(base).find((x) => x.clave === "kimi")!;
    expect(k.costoRetador).toBeCloseTo(0.16);
    expect(k.costoControl).toBeCloseTo(0.26);
    expect(k.msRetador).toBe(129000);
    expect(k.msControl).toBe(55000);
  });

  it("un error del retador cuenta como suyo y no ensucia sus promedios", () => {
    const k = resumenPorRetador(base).find((x) => x.clave === "kimi")!;
    expect(k.errores).toBe(1);
    expect(k.costoRetador).toBeCloseTo(0.16); // no lo arrastra a la baja
  });

  it("el límite de Vercel deja ver quién no cabe aunque gane", () => {
    const k = resumenPorRetador(base).find((x) => x.clave === "kimi")!;
    expect(k.msRetador! > LIMITE_VERCEL_MS).toBe(true);
    const s = resumenPorRetador(base).find((x) => x.clave === "sonnet")!;
    expect(s.msRetador! > LIMITE_VERCEL_MS).toBe(false);
  });

  it("ignora corridas que no sean control-contra-retador", () => {
    const r = resumenPorRetador({
      ...base,
      corridas: [{ id: "c3", variantes: [{ clave: "sin-rotacion", etiqueta: "A" }, { clave: "sin-neutros", etiqueta: "B" }] }],
    });
    expect(r).toHaveLength(0);
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
