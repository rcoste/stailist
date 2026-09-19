import { describe, expect, it } from "vitest";
import {
  CLAVE_GRAVEDAD,
  NIVELES_GRAVEDAD,
  PESOS_INICIALES,
  PREGUNTAS_DEFECTO,
  criticaDesdeJev,
  curvaDeUmbral,
  discriminacion,
  gravedadDeEscala,
  preguntasDelJuez,
  type CasoMedible,
} from "./juez-jev";
import { DEFECTOS_MOTOR } from "@/lib/comparador/motor";
import type { RespuestaJev } from "@/lib/jev";

const noul = (n: number): RespuestaJev => ({ type: "noul", noul: n });
const score = (s: number): RespuestaJev => ({
  type: "score",
  score: s,
  confidence: 0.8,
  probabilities: {},
  legend: {},
});

describe("las preguntas", () => {
  it("cubre TODOS los defectos del vocabulario de Roberto", () => {
    // Si alguien agrega un defecto a DEFECTOS_MOTOR y no lo pregunta aquí, el
    // retador mide menos cosas que el juez vigente y la comparación miente.
    for (const d of DEFECTOS_MOTOR) expect(PREGUNTAS_DEFECTO[d.clave], d.clave).toBeTruthy();
  });

  it("manda un noul por defecto más la escala de gravedad", () => {
    const qs = preguntasDelJuez();
    expect(Object.keys(qs)).toHaveLength(DEFECTOS_MOTOR.length + 1);
    expect(qs[CLAVE_GRAVEDAD].type).toBe("score");
    expect(qs.color.type).toBe("noul");
  });

  it("la escala va de menos a más y cabe en los 2-10 niveles que acepta la API", () => {
    expect(NIVELES_GRAVEDAD.length).toBeGreaterThanOrEqual(2);
    expect(NIVELES_GRAVEDAD.length).toBeLessThanOrEqual(10);
  });
});

describe("de probabilidades a crítica", () => {
  it("ignora los defectos por debajo del umbral", () => {
    const c = criticaDesdeJev({ color: noul(0.2), [CLAVE_GRAVEDAD]: score(3) });
    expect(c.hallazgos).toHaveLength(0);
  });

  it("la gravedad la pone la escala del look, no la confianza del defecto", () => {
    // Estar segurísimo de que hay un choque de color (0.99) NO significa que el
    // look esté roto: la escala dice que apenas resta. Es la separación que el
    // juez vigente no logra hacer.
    const c = criticaDesdeJev({ color: noul(0.99), [CLAVE_GRAVEDAD]: score(2.0) });
    expect(c.hallazgos).toHaveLength(1);
    expect(c.hallazgos[0].gravedad).toBe("resta");
    expect(c.hallazgos[0].defecto).toBe("color");
  });

  it("'plano' se descarta igual que en js9: el retador y el campeón cuentan lo mismo", () => {
    // 18 de 21 "plano" del examen de js4 cayeron en looks que Roberto aprobó.
    // Si Jev lo emitiera y js9 no, la fila de "cualquier hallazgo" compararía
    // vocabularios distintos e inflaría a Jev por los dos lados a la vez.
    const c = criticaDesdeJev({ plano: noul(0.95), [CLAVE_GRAVEDAD]: score(3) });
    expect(c.hallazgos).toEqual([]);
  });

  it("descartar 'plano' no se lleva los demás defectos del mismo look", () => {
    const c = criticaDesdeJev({ plano: noul(0.95), color: noul(0.9), [CLAVE_GRAVEDAD]: score(3) });
    expect(c.hallazgos.map((h) => h.defecto)).toEqual(["color"]);
  });

  it("un look impecable no deja hallazgos, aunque el defecto pase el umbral", () => {
    // La escala en 0 dice "se lo pondría tal cual". Antes esto devolvía un
    // hallazgo de nivel detalle, que inflaba caza Y falsa alarma a la vez.
    expect(gravedadDeEscala(0.2)).toBeNull();
    const c = criticaDesdeJev({ color: noul(0.99), [CLAVE_GRAVEDAD]: score(0.2) });
    expect(c.hallazgos).toEqual([]);
  });

  it("si la escala NO vino contestada, el defecto NO se pierde: cae en detalle", () => {
    // "No contestó" y "está impecable" son cosas distintas: callar un defecto
    // por un fallo de la llamada es perder señal en silencio.
    const c = criticaDesdeJev({ color: noul(0.9) });
    expect(c.hallazgos).toHaveLength(1);
    expect(c.hallazgos[0].gravedad).toBe("detalle");
  });

  it("deja la probabilidad a la vista en el problema", () => {
    const c = criticaDesdeJev({ ocasion: noul(0.87), [CLAVE_GRAVEDAD]: score(3) });
    expect(c.hallazgos[0].problema).toContain("0.87");
  });

  it("no inventa arreglo ni pieza: es lo que este modelo no da", () => {
    const c = criticaDesdeJev({ ocasion: noul(0.9), [CLAVE_GRAVEDAD]: score(3) });
    expect(c.hallazgos[0].arreglo).toBe("");
  });

  it("respeta un umbral distinto del inicial", () => {
    const resp = { color: noul(0.55), [CLAVE_GRAVEDAD]: score(3) };
    expect(criticaDesdeJev(resp, PESOS_INICIALES).hallazgos).toHaveLength(1);
    expect(criticaDesdeJev(resp, { ...PESOS_INICIALES, umbral: 0.8 }).hallazgos).toHaveLength(0);
  });
});

describe("la curva de umbral", () => {
  const casos: CasoMedible[] = [
    { probabilidades: { color: 0.9 }, escala: 3, marca: "abajo" },
    { probabilidades: { color: 0.6 }, escala: 2, marca: "abajo" },
    { probabilidades: { color: 0.7 }, escala: 2, marca: "arriba" },
    { probabilidades: { color: 0.1 }, escala: 0, marca: "arriba" },
  ];

  it("al bajar el umbral caza más 👎 y también ensucia más 👍", () => {
    const [alto, bajo] = curvaDeUmbral(casos, ["color"], [0.8, 0.5]);
    expect(alto.caza).toBe(1);
    expect(alto.falsaAlarma).toBe(0);
    expect(bajo.caza).toBe(2);
    expect(bajo.falsaAlarma).toBe(1);
  });

  it("cuenta los totales de cada lado", () => {
    const [p] = curvaDeUmbral(casos, ["color"], [0.5]);
    expect(p.totalAbajo).toBe(2);
    expect(p.totalArriba).toBe(2);
  });

  it("un defecto que el modelo nunca contestó no marca nada", () => {
    const [p] = curvaDeUmbral(casos, ["repetido"], [0.1]);
    expect(p.caza).toBe(0);
    expect(p.falsaAlarma).toBe(0);
  });
});

describe("qué pregunta sirve", () => {
  it("ordena por separación y deja abajo la que no discrimina", () => {
    const casos: CasoMedible[] = [
      { probabilidades: { color: 0.9, plano: 0.8 }, escala: 3, marca: "abajo" },
      { probabilidades: { color: 0.8, plano: 0.8 }, escala: 3, marca: "abajo" },
      { probabilidades: { color: 0.1, plano: 0.8 }, escala: 0, marca: "arriba" },
      { probabilidades: { color: 0.2, plano: 0.8 }, escala: 0, marca: "arriba" },
    ];
    const d = discriminacion(casos, ["color", "plano"]);
    expect(d[0].defecto).toBe("color");
    expect(d[0].separacion).toBeCloseTo(0.7, 5);
    // "plano" dice lo mismo de todos: no está midiendo su gusto.
    expect(d[1].defecto).toBe("plano");
    expect(d[1].separacion).toBeCloseTo(0, 5);
  });
});
