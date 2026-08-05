import { describe, it, expect } from "vitest";
import { INSTRUCCION_INSPIRACION, elegirInspiracion, type Inspiracion } from "./inspiracion";

/**
 * Un Supabase de mentira que recuerda los filtros que le pusieron y devuelve lo
 * que se le dijo. Basta porque lo que se prueba aquí NO es la base: es DÓNDE
 * corta la escalera de aflojado, que es la decisión que costó el A/B.
 */
function supabaseFalso(porIntento: Inspiracion[][]) {
  const filtros: Record<string, unknown>[] = [];
  let n = 0;
  const constructor = (usados: Record<string, unknown>) => {
    const q = {
      select: () => constructor(usados),
      eq: (c: string, v: unknown) => constructor({ ...usados, [c]: v }),
      in: (c: string, v: unknown) => constructor({ ...usados, [c]: v }),
      contains: (c: string, v: unknown) => constructor({ ...usados, [c]: v }),
      then: (resolve: (r: { data: Inspiracion[] }) => unknown) => {
        filtros.push(usados);
        return Promise.resolve(resolve({ data: porIntento[n++] ?? [] }));
      },
    };
    return q;
  };
  return {
    cliente: { from: () => constructor({}) } as never,
    filtros,
  };
}

const foto = (p: Partial<Inspiracion> = {}): Inspiracion => ({
  path: "hombre/casual-limpio/x.jpg",
  estilo: "casual-limpio",
  clima: "templado",
  paleta: "neutra",
  silueta: "recta",
  ...p,
});

const base = {
  familias: ["casual-limpio"],
  genero: "hombre" as const,
  clima: "templado" as const,
  season: "invierno",
  rand: () => 0.5,
};

describe("a quién se le enseñan fotos y a quién no", () => {
  it("para OFICINA exige nivel arreglado en la consulta", async () => {
    // El A/B lo perdió aquí: a los dos casos de oficina se le enseñaron 18 fotos
    // "cuidado" contra 9 "arreglado" y el motor copió lo casual. Roberto: "ni al
    // caso, jamás usaría eso para la oficina".
    const { cliente, filtros } = supabaseFalso([[foto({ registro: "arreglado" })]]);
    await elegirInspiracion(cliente, { ...base, ocasion: "oficina" });
    expect(filtros[0].registro).toEqual(["arreglado", "formal"]);
  });

  it("sin material arreglado para oficina NO enseña nada, en vez de bajar el nivel", async () => {
    // La lección del A/B en una línea: julio, SIN una sola foto, ganó los dos
    // casos de oficina contra fotos casuales. Cuando la ocasión pide nivel,
    // ninguna referencia es mejor que una relajada.
    const { cliente, filtros } = supabaseFalso([[], [], []]);
    const r = await elegirInspiracion(cliente, { ...base, ocasion: "oficina" });
    expect(r).toEqual([]);
    // Y CORTA ahí: tres intentos, no cinco. Los dos últimos peldaños de la
    // escalera larga sueltan la ocasión entera, que es como acabaría enseñando
    // una foto de café un martes para una junta.
    expect(filtros).toHaveLength(3);
    for (const f of filtros) expect(f.registro).toEqual(["arreglado", "formal"]);
  });

  it("para DIARIO no exige registro y sí conserva la escalera larga", async () => {
    // En diario las fotos iban ganando 2-1: ahí una foto de calle de más nunca
    // hizo daño, así que se afloja hasta encontrar algo.
    const { cliente, filtros } = supabaseFalso([[], [], [], [], [foto()]]);
    const r = await elegirInspiracion(cliente, { ...base, ocasion: "diario" });
    expect(filtros[0].registro).toBeUndefined();
    expect(filtros.length).toBe(5);
    expect(r).toHaveLength(1);
  });

  it("'refrescar' consulta como diario, que es su equivalente etiquetado", async () => {
    // La biblioteca se etiquetó con cuatro ocasiones y el producto tiene cinco.
    // Sin el mapeo, refrescar caía al respaldo SIN filtro de ocasión — 3 de las
    // 36 fotos de la corrida quedaron fuera de lugar justo por eso.
    const { cliente, filtros } = supabaseFalso([[foto()]]);
    await elegirInspiracion(cliente, { ...base, ocasion: "refrescar" });
    expect(filtros[0].ocasiones).toEqual(["diario"]);
  });
});

// elegirInspiracion pide un cliente de Supabase, así que aquí se prueba la
// instrucción — que es donde vive la decisión de diseño que Roberto peleó.
describe("la instrucción de inspiración", () => {
  it("pide UN look por foto, no un promedio de las tres", () => {
    // Roberto: "si me gustan minimalista, coreano e hipster, ahí no vas a
    // promediar y hacer una quimera de estilo; la respuesta es una de las tres,
    // o las tres". Un promedio de tres estilos no es un estilo — es un look que
    // no es de ninguno. En el piloto original generaban tres a la vez y eso era
    // parte de por qué funcionaba.
    expect(INSTRUCCION_INSPIRACION).toContain("UNA FOTO POR LOOK");
    expect(INSTRUCCION_INSPIRACION).toContain("NO mezcles las tres");
    expect(INSTRUCCION_INSPIRACION.toLowerCase()).toContain("promediarlos");
  });

  it("dice que el color de la foto no se copia", () => {
    // "Aunque esa foto traiga polo azul, para ese polo podría ser perfectamente
    // verde": de la referencia se toma la estructura, no el color, y la
    // colorimetría de la persona manda.
    expect(INSTRUCCION_INSPIRACION).toContain("NO ES LITERAL");
    expect(INSTRUCCION_INSPIRACION).toContain("colorimetría manda");
  });

  it("permite ignorar una foto que no se puede acercar", () => {
    // Sin esta salida, un modelo con tres fotos enfrente fuerza prendas para
    // parecerse a ellas — que es de donde salen los Frankenstein.
    expect(INSTRUCCION_INSPIRACION).toContain("IGNORA esa foto");
  });

  it("las prendas SIEMPRE son del clóset real", () => {
    expect(INSTRUCCION_INSPIRACION).toContain("REGLA DURA");
    expect(INSTRUCCION_INSPIRACION).toContain("jamás uses ni menciones una prenda");
  });

  it("dice que el nivel de arreglo lo manda la ocasión, no la foto", () => {
    // El error que costó el A/B, ahora escrito: de la referencia se toma la
    // combinación; qué tan arreglado va lo decide para qué es el día.
    expect(INSTRUCCION_INSPIRACION).toContain("EL NIVEL DE ARREGLO TAMPOCO LO MANDA LA FOTO");
    expect(INSTRUCCION_INSPIRACION).toContain("lo manda la OCASIÓN");
  });
});
