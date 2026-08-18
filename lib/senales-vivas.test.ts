import { describe, it, expect } from "vitest";
import {
  contarEventos,
  evaluarPar,
  evaluarSenales,
  type ParDeSenales,
} from "./senales-vivas";

// Lo que se blinda: que el panel NO grite con dos datos ni se calle con veinte.
// Las dos formas de que este chequeo no sirva de nada son gritar de más (nadie
// lo vuelve a mirar) y callarse de más (que es lo que ya pasó dos veces).

const par = (over: Partial<ParDeSenales> = {}): ParDeSenales => ({
  nombre: "fit check → me lo puse",
  disparador: "espejo_subido",
  disparos: 10,
  consecuencia: "worn",
  consecuencias: 10,
  cuesta: "la señal de oro del experimento",
  ...over,
});

describe("evaluarPar — cuándo decir que algo se rompió", () => {
  it("muchos disparos y CERO consecuencias: seca", () => {
    // El caso real del 2026-08-14 llevado a su versión con volumen.
    const v = evaluarPar(par({ disparos: 24, consecuencias: 0 }));
    expect(v.estado).toBe("seca");
    expect(v.detalle).toContain("24");
  });

  it("pocos disparos y cero consecuencias: NO acusa, admite que no sabe", () => {
    // Con dos usos, un cero puede ser casualidad. Acusar aquí es el camino
    // más corto a que nadie vuelva a mirar el panel.
    const v = evaluarPar(par({ disparos: 2, consecuencias: 0 }));
    expect(v.estado).toBe("sin-datos");
    expect(v.detalle).toContain("muy poco");
  });

  it("el mínimo se puede subir para señales ruidosas", () => {
    expect(evaluarPar(par({ disparos: 5, consecuencias: 0 })).estado).toBe("seca");
    expect(evaluarPar(par({ disparos: 5, consecuencias: 0, minimo: 20 })).estado).toBe(
      "sin-datos"
    );
  });

  it("sin disparos no concluye nada (0 de 0 no es lo mismo que 0 de 24)", () => {
    const v = evaluarPar(par({ disparos: 0, consecuencias: 0 }));
    expect(v.estado).toBe("sin-datos");
    expect(v.cobertura).toBe(0);
  });

  it("se pierde más de la mitad: floja", () => {
    const v = evaluarPar(par({ disparos: 10, consecuencias: 3 }));
    expect(v.estado).toBe("floja");
    expect(v.cobertura).toBe(30);
  });

  it("la mayoría llega: viva", () => {
    expect(evaluarPar(par({ disparos: 10, consecuencias: 9 })).estado).toBe("viva");
  });

  it("justo en la mitad cuenta como viva (el umbral no castiga el empate)", () => {
    expect(evaluarPar(par({ disparos: 10, consecuencias: 5 })).estado).toBe("viva");
  });

  it("arrastra qué se rompe, que es lo único accionable del aviso", () => {
    expect(evaluarPar(par({ disparos: 24, consecuencias: 0 })).cuesta).toContain(
      "señal de oro"
    );
  });
});

describe("evaluarSenales — lo roto arriba", () => {
  it("ordena seca, floja, sin-datos, viva", () => {
    const estados = evaluarSenales([
      par({ nombre: "a", disparos: 10, consecuencias: 10 }),
      par({ nombre: "b", disparos: 0, consecuencias: 0 }),
      par({ nombre: "c", disparos: 10, consecuencias: 1 }),
      par({ nombre: "d", disparos: 10, consecuencias: 0 }),
    ]).map((v) => `${v.nombre}:${v.estado}`);
    expect(estados).toEqual(["d:seca", "c:floja", "b:sin-datos", "a:viva"]);
  });
});

// ── El vínculo tiene fecha de nacimiento ──────────────────────────────────
//
// El caso real: el panel llevaba en rojo desde que nació (2026-08-13) con el
// vínculo funcionando al 100%. El fit check se volvió el escritor de `worn` el
// 2026-08-11, pero la ventana de 30 días alcanzaba hasta julio: 19 fit checks
// que por diseño NUNCA escribieron `worn` entraban como fallos.
//
// Un rojo permanente es peor que un verde permanente: el verde sólo aburre, el
// rojo entrena a ignorar justo el estado que debería hacerte actuar.
describe("contarEventos — los disparos de antes del vínculo no cuentan", () => {
  const eventos = [
    // La época en que el fit check NO escribía `worn` (lo hacía la card).
    { type: "espejo_subido", created_at: "2026-08-09T10:00:00Z" },
    { type: "espejo_subido", created_at: "2026-08-10T10:00:00Z" },
    { type: "espejo_subido", created_at: "2026-08-10T11:00:00Z" },
    // Ya con el vínculo vivo.
    { type: "espejo_subido", created_at: "2026-08-17T10:00:00Z" },
    { type: "worn", created_at: "2026-08-17T10:00:01Z" },
  ];

  it("sin `desde` cuenta todo (el comportamiento viejo)", () => {
    expect(contarEventos(eventos, "espejo_subido")).toBe(4);
  });

  it("con `desde` sólo cuenta lo posterior al vínculo", () => {
    expect(contarEventos(eventos, "espejo_subido", "2026-08-11")).toBe(1);
  });

  it("el mismo día del vínculo SÍ cuenta", () => {
    expect(
      contarEventos(
        [{ type: "worn", created_at: "2026-08-11T00:00:00Z" }],
        "worn",
        "2026-08-11"
      )
    ).toBe(1);
  });

  it("REGRESIÓN: sin `desde` el panel acusa un vínculo sano", () => {
    // Contando toda la ventana: 4 disparos, 1 consecuencia = 25% = "floja",
    // que es el rojo que salía en pantalla.
    const sinFecha = evaluarPar({
      nombre: "fit check → me lo puse",
      disparador: "espejo_subido",
      disparos: contarEventos(eventos, "espejo_subido"),
      consecuencia: "worn",
      consecuencias: contarEventos(eventos, "worn"),
      cuesta: "la señal de oro",
    });
    expect(sinFecha.estado).toBe("floja");

    // Contando desde que el vínculo existe: 1 de 1 = 100% = "viva".
    const conFecha = evaluarPar({
      nombre: "fit check → me lo puse",
      disparador: "espejo_subido",
      desde: "2026-08-11",
      disparos: contarEventos(eventos, "espejo_subido", "2026-08-11"),
      consecuencia: "worn",
      consecuencias: contarEventos(eventos, "worn", "2026-08-11"),
      cuesta: "la señal de oro",
    });
    expect(conFecha.estado).toBe("viva");
    expect(conFecha.cobertura).toBe(100);
  });

  it("el veredicto dice desde cuándo midió, para no aparentar otra cosa", () => {
    const v = evaluarPar({
      nombre: "fit check → me lo puse",
      disparador: "espejo_subido",
      desde: "2026-08-11",
      disparos: 2,
      consecuencia: "worn",
      consecuencias: 2,
      cuesta: "la señal de oro",
    });
    expect(v.detalle).toContain("11 ago");
  });
});
