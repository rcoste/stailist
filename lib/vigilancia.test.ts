import { describe, it, expect } from "vitest";
import { FALLOS_MISMA_PERSONA, FALLOS_PARA_AVISAR, correoDeAlarmas, decidirAlarmas } from "./vigilancia";

const sano = {
  fallosUltimaHora: 0,
  llamadasUltimaHora: 40,
  gastoUltimasHoras: 1.2,
  topeGasto: 25,
};

describe("cuándo NO se avisa", () => {
  it("un día normal no manda nada", () => {
    expect(decidirAlarmas(sano)).toEqual([]);
  });

  it("dos fallos sueltos son mala suerte, no una alarma", () => {
    expect(decidirAlarmas({ ...sano, fallosUltimaHora: 2 })).toEqual([]);
  });

  it("dos de dos llamadas es 100% de fallo y AUN ASÍ no avisa", () => {
    // El disparador es el conteo y no la tasa a propósito: con dos llamadas en
    // una hora muerta, cualquier tasa es ruido. Un correo así se aprende a
    // ignorar, y entonces el que importa tampoco se lee.
    expect(
      decidirAlarmas({ ...sano, fallosUltimaHora: 2, llamadasUltimaHora: 2 })
    ).toEqual([]);
  });
});

describe("racha de fallos", () => {
  it("avisa justo al llegar al umbral", () => {
    const a = decidirAlarmas({ ...sano, fallosUltimaHora: FALLOS_PARA_AVISAR });
    expect(a.map((x) => x.clave)).toEqual(["fallos"]);
  });

  it("el aviso dice cómo pararlo", () => {
    const a = decidirAlarmas({ ...sano, fallosUltimaHora: 9, llamadasUltimaHora: 9 });
    expect(a[0].detalle).toContain("MOTOR_PAUSADO");
  });

  it("no divide entre cero cuando no hubo llamadas", () => {
    const a = decidirAlarmas({
      ...sano,
      fallosUltimaHora: 6,
      llamadasUltimaHora: 0,
    });
    expect(a[0].titulo).toContain("6");
    expect(a[0].detalle).not.toContain("NaN");
    expect(a[0].detalle).not.toContain("Infinity");
  });
});

describe("gasto", () => {
  it("avisa al 80% del tope, no al 100%", () => {
    // Llegar al 100% quiere decir que la app YA le está diciendo que no a la
    // gente; para entonces el aviso llega tarde.
    expect(decidirAlarmas({ ...sano, gastoUltimasHoras: 19.9 })).toEqual([]);
    const a = decidirAlarmas({ ...sano, gastoUltimasHoras: 20 });
    expect(a.map((x) => x.clave)).toEqual(["gasto"]);
  });

  it("dice cuánto y contra qué tope", () => {
    const a = decidirAlarmas({ ...sano, gastoUltimasHoras: 22.5, topeGasto: 25 });
    expect(a[0].titulo).toContain("$22.50");
    expect(a[0].detalle).toContain("$25.00");
  });
});

describe("el correo", () => {
  it("con una sola alarma, el asunto ES la alarma", () => {
    const a = decidirAlarmas({ ...sano, fallosUltimaHora: 7 });
    expect(correoDeAlarmas(a).subject).toContain("7 llamadas de IA fallaron");
  });

  it("con dos, el asunto las cuenta", () => {
    const a = decidirAlarmas({
      ...sano,
      fallosUltimaHora: 7,
      gastoUltimasHoras: 24,
    });
    expect(a).toHaveLength(2);
    expect(correoDeAlarmas(a).subject).toContain("2 avisos");
  });

  it("siempre lleva el link del panel", () => {
    const a = decidirAlarmas({ ...sano, fallosUltimaHora: 7 });
    expect(correoDeAlarmas(a).text).toContain("/admin/ia");
  });
});

// EL CASO DE VAL (2026-09-09), que la vigilancia NO cazó por UN fallo de
// margen. Intentó verse un look puesto cuatro veces entre 12:19 y 12:50 —el
// modelo de imagen de Google estaba caído esa media hora— y se rindió. Ese día
// hubo OCHO llamadas en total: sus cuatro fallos eran el 50%, todos suyos, y el
// umbral absoluto (5) no disparó. Se supo tres horas después, por casualidad.
describe("alguien atorado AHORA — el segundo disparador", () => {
  const val = { correo: "val@ejemplo.com", fallos: 4, tarea: "tryon" };

  it("el día de Val: 4 fallos de 8 llamadas NO llegan al umbral absoluto…", () => {
    expect(decidirAlarmas({ ...sano, fallosUltimaHora: 4, llamadasUltimaHora: 8 })).toEqual([]);
  });

  it("…pero con la persona identificada, sí avisa", () => {
    const a = decidirAlarmas({ ...sano, fallosUltimaHora: 4, llamadasUltimaHora: 8, peorPersona: val });
    expect(a.map((x) => x.clave)).toContain("persona");
    expect(a.find((x) => x.clave === "persona")!.titulo).toContain("val@ejemplo.com");
  });

  it("nombra la tarea cuando todos los fallos son de la misma", () => {
    const a = decidirAlarmas({ ...sano, peorPersona: val });
    expect(a[0].detalle).toContain("tryon");
  });

  it("y no la nombra cuando los fallos están repartidos entre tareas", () => {
    const a = decidirAlarmas({ ...sano, peorPersona: { ...val, tarea: null } });
    expect(a[0].detalle).not.toMatch(/Todos en/);
  });

  it("dos fallos NO avisan: pueden ser un reintento con mala suerte", () => {
    expect(decidirAlarmas({ ...sano, peorPersona: { ...val, fallos: 2 } })).toEqual([]);
    expect(FALLOS_MISMA_PERSONA).toBe(3);
  });

  it("sin persona identificada, se comporta como antes", () => {
    expect(decidirAlarmas({ ...sano, peorPersona: null })).toEqual([]);
    expect(decidirAlarmas(sano)).toEqual([]);
  });

  it("el aviso de la persona va PRIMERO: es el único con alguien esperando", () => {
    const a = decidirAlarmas({
      ...sano,
      fallosUltimaHora: FALLOS_PARA_AVISAR,
      llamadasUltimaHora: 20,
      peorPersona: val,
    });
    expect(a[0].clave).toBe("persona");
    expect(a.map((x) => x.clave)).toContain("fallos");
  });
});
