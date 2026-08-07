import { describe, it, expect } from "vitest";
import {
  acuerdoDeCalibracion,
  briefCompleto,
  estiloDelPerfil,
  marcadorEval,
  type EvalBriefFila,
  type NotaDeLook,
} from "./evales";
import type { NotaRubrica } from "@/lib/engine/rubrica";

// El eval es la banda de medir del motor: si su aritmética miente, la curva
// diría "mejoramos" sin que nada haya mejorado. Estos tests fijan las
// decisiones que no se pueden perder en una edición.

const nota = (p: Partial<NotaRubrica> = {}): NotaRubrica => ({
  analisis: "x",
  ocasion: 4,
  clima: 4,
  armado: 4,
  estilo: 3,
  color: 4,
  wow: 3,
  aprobado: true,
  porQue: "x",
  ...p,
});

const fila = (p: Partial<EvalBriefFila> = {}): EvalBriefFila => ({
  id: "f1",
  n: 1,
  brief: { etiqueta: "diario", objective: "diario", momento: "dia", weather: null },
  looks: [{ nombre: "A", item_ids: ["i1"], explicacion: "x" }],
  reviews: null,
  error: null,
  costoGenUsd: null,
  msGen: null,
  notas: null,
  costoNotasUsd: null,
  marcas: null,
  comentarios: null,
  ...p,
});

const conNotas = (ns: Partial<NotaDeLook>[]): NotaDeLook[] =>
  ns.map((n) => ({ violaciones: [], texto: null, vision: null, ...n }));

describe("briefCompleto — la fase se decide por los DATOS", () => {
  it("sin looks, falta generar", () => {
    expect(briefCompleto(fila({ looks: null }))).toBe(false);
  });

  it("con looks y sin notas, falta calificar", () => {
    expect(briefCompleto(fila())).toBe(false);
  });

  it("un juez a medias NO cuenta como completo — el otro paso lo rellena", () => {
    const f = fila({ notas: conNotas([{ texto: nota() }]) });
    expect(briefCompleto(f)).toBe(false);
  });

  it("con los dos jueces, listo", () => {
    const f = fila({ notas: conNotas([{ texto: nota(), vision: nota() }]) });
    expect(briefCompleto(f)).toBe(true);
  });

  it("un motor que truena ES un resultado: no se reintenta para siempre", () => {
    expect(briefCompleto(fila({ looks: null, error: "TOO_FEW_OUTFITS" }))).toBe(true);
  });
});

describe("marcadorEval", () => {
  it("promedia por dimensión y por juez, sin mezclarlos", () => {
    const f = fila({
      looks: [
        { nombre: "A", item_ids: ["i1"], explicacion: "x" },
        { nombre: "B", item_ids: ["i2"], explicacion: "x" },
      ],
      notas: conNotas([
        { texto: nota({ clima: 5 }), vision: nota({ clima: 1 }) },
        { texto: nota({ clima: 3 }), vision: nota({ clima: 3 }) },
      ]),
    });
    const m = marcadorEval([f], true);
    expect(m.texto.clima).toBe(4);
    expect(m.vision.clima).toBe(2);
  });

  it("sin estilo declarado, la dimensión NO se promedia (el 3 neutro no mide)", () => {
    // El juez pone 3 cuando el brief no trae estilo. Promediarlo diría "3.00"
    // con cara de medición y ensuciaría la comparación con corridas que sí lo
    // midieron.
    const f = fila({ notas: conNotas([{ texto: nota(), vision: nota() }]) });
    expect(marcadorEval([f], false).texto.estilo).toBeNull();
    expect(marcadorEval([f], true).texto.estilo).toBe(3);
  });

  it("sin colorimetría, la dimensión color tampoco se promedia", () => {
    const f = fila({ notas: conNotas([{ texto: nota(), vision: nota() }]) });
    expect(marcadorEval([f], true, false).texto.color).toBeNull();
    expect(marcadorEval([f], true, true).texto.color).toBe(4);
  });

  it("cuenta la reparación del juez de producción — el número que dirá cuándo sobra", () => {
    const f = fila({
      reviews: [
        { changed: true, verdict: "ok" },
        { changed: false, verdict: "ok" },
        { changed: false, verdict: "rechazado" },
      ],
    });
    const m = marcadorEval([f], false);
    expect(m.reparacion).toEqual({ candidatos: 3, reparados: 1, rechazados: 1 });
  });

  it("las violaciones se cuentan por look Y por regla", () => {
    const f = fila({
      looks: [
        { nombre: "A", item_ids: ["i1"], explicacion: "x" },
        { nombre: "B", item_ids: ["i2"], explicacion: "x" },
      ],
      notas: conNotas([
        {
          violaciones: [
            { regla: "lluvia-calzado", detalle: "x" },
            { regla: "sueter-sin-base", detalle: "x" },
          ],
          texto: nota(),
          vision: nota(),
        },
        { violaciones: [], texto: nota(), vision: nota() },
      ]),
    });
    const m = marcadorEval([f], false);
    expect(m.violaciones.total).toBe(2);
    expect(m.violaciones.looksConViolacion).toBe(1);
    expect(m.violaciones.porRegla["lluvia-calzado"]).toBe(1);
  });

  it("un juez caído no cuenta como aprobado ni como rechazo", () => {
    const f = fila({ notas: conNotas([{ texto: nota({ aprobado: false }) }]) });
    const m = marcadorEval([f], false);
    expect(m.aprobadoTexto).toEqual({ si: 0, de: 1 });
    expect(m.aprobadoVision).toEqual({ si: 0, de: 0 });
    expect(m.looksCalificados).toBe(0);
  });
});

describe("acuerdoDeCalibracion — la defensa anti-Goodhart", () => {
  it("mide acuerdo por capa y la cobertura de los 👎", () => {
    const f = fila({
      looks: [
        { nombre: "A", item_ids: ["i1"], explicacion: "x" },
        { nombre: "B", item_ids: ["i2"], explicacion: "x" },
      ],
      // look 0: humano 👎; texto lo caza, visión no. look 1: humano 👍 y los dos aprueban.
      notas: conNotas([
        { texto: nota({ aprobado: false }), vision: nota({ aprobado: true }) },
        { texto: nota(), vision: nota() },
      ]),
      marcas: { "0": "abajo", "1": "arriba" },
    });
    const a = acuerdoDeCalibracion([f]);
    expect(a.marcados).toBe(2);
    expect(a.texto).toEqual({ aciertos: 2, de: 2 });
    expect(a.vision).toEqual({ aciertos: 1, de: 2 });
    expect(a.abajos).toEqual({
      total: 1,
      cazaTexto: 1,
      cazaVision: 0,
      cazaCodigo: 0,
    });
  });

  it("el código solo se mide sobre sus alarmas: no predice 👍", () => {
    // Una regla que no dispara no es un acierto ni un fallo — es silencio.
    const f = fila({
      notas: conNotas([
        { violaciones: [{ regla: "mocasin-en-frio", detalle: "x" }], texto: nota() },
      ]),
      marcas: { "0": "abajo" },
    });
    const a = acuerdoDeCalibracion([f]);
    expect(a.codigo).toEqual({ alarmas: 1, conAbajo: 1 });
    expect(a.abajos.cazaCodigo).toBe(1);
  });

  it("un look sin calificar no entra al acuerdo aunque esté marcado", () => {
    const f = fila({ notas: null, marcas: { "0": "abajo" } });
    expect(acuerdoDeCalibracion([f]).marcados).toBe(0);
  });
});

describe("estiloDelPerfil — el juez lee lo MISMO que el motor", () => {
  it("junta marca, palabras y arquetipo", () => {
    const e = estiloDelPerfil({
      style_reference: { summary: "minimalismo cálido", tags: ["neutros"] },
      style_words: "sencillo con intención",
      style_archetype: { nombre: "El arquitecto", descripcion: "líneas limpias" },
    });
    expect(e.marca).toContain("minimalismo cálido");
    expect(e.palabras).toBe("sencillo con intención");
    expect(e.arquetipo).toBe("El arquitecto — líneas limpias");
  });

  it("un perfil vacío no inventa estilo", () => {
    const e = estiloDelPerfil({});
    expect(e).toEqual({ marca: null, palabras: null, arquetipo: null });
  });
});
