import { describe, expect, it } from "vitest";
import { resumirRonda, resumirPorVariante } from "./resumen-ronda";
import { normalizarCritica, DEFECTOS_VALIDOS } from "./juez-stylist";
import type { CriticaStylist, Gravedad } from "./juez-stylist";

// Lo que se blinda: que el orden de los temas sirva para DECIDIR qué arreglar.
// Un resumen ordenado por frecuencia a secas pondría diez "detalles" arriba de
// un fallo que tira looks, y quien lo lea arreglaría lo barato en vez de lo
// caro. Ese orden es todo el valor del archivo.

const h = (defecto: string, gravedad: Gravedad, pieza = "camisa negra") => ({
  pieza,
  problema: `problema de ${defecto}`,
  arreglo: `cambia ${pieza}`,
  gravedad,
  defecto,
});

const critica = (hallazgos: ReturnType<typeof h>[]): CriticaStylist => ({
  resumen: "traje carbón, camisa negra, botín café",
  hallazgos,
  loQueFunciona: "el traje está bien emparejado",
});

describe("el orden de los temas es lo que hace útil el resumen", () => {
  it("lo que ROMPE va arriba aunque salga menos veces", () => {
    const r = resumirRonda([
      critica([h("color", "rompe")]),
      critica([h("plano", "detalle")]),
      critica([h("plano", "detalle")]),
      critica([h("plano", "detalle")]),
    ]);
    // "plano" sale 3 veces y "color" 1, pero color tira looks.
    expect(r.temas[0].defecto).toBe("color");
    expect(r.temas[0].rompen).toBe(1);
    expect(r.temas[1].defecto).toBe("plano");
    expect(r.temas[1].looks).toBe(3);
  });

  it("a igual gravedad, manda en cuántos LOOKS apareció", () => {
    const r = resumirRonda([
      critica([h("clima", "resta")]),
      critica([h("color", "resta")]),
      critica([h("color", "resta")]),
    ]);
    expect(r.temas[0].defecto).toBe("color");
    expect(r.temas[0].looks).toBe(2);
  });

  it("un look con dos hallazgos del mismo tema cuenta UNA vez en `looks`", () => {
    // Si contara hallazgos, un solo look ruidoso podría inventar un tema
    // recurrente que no existe.
    const r = resumirRonda([critica([h("color", "resta"), h("color", "detalle")])]);
    expect(r.temas[0].looks).toBe(1);
    expect(r.temas[0].hallazgos).toBe(2);
  });

  it("los ejemplos salen de los hallazgos MÁS graves, no de los primeros", () => {
    const r = resumirRonda([
      critica([h("color", "detalle", "cinturón")]),
      critica([h("color", "detalle", "calcetín")]),
      critica([h("color", "rompe", "camisa negra")]),
    ]);
    expect(r.temas[0].ejemplos[0].pieza).toBe("camisa negra");
  });
});

describe("los conteos de cabecera", () => {
  it("distingue looks limpios, con hallazgos y con roturas", () => {
    const r = resumirRonda([
      critica([]),
      critica([h("color", "detalle")]),
      critica([h("clima", "rompe")]),
    ]);
    expect(r.looks).toBe(3);
    expect(r.conHallazgos).toBe(2);
    expect(r.conRotos).toBe(1);
  });

  it("una ronda sin hallazgos no inventa temas", () => {
    const r = resumirRonda([critica([]), critica([])]);
    expect(r.temas).toEqual([]);
    expect(r.conHallazgos).toBe(0);
  });
});

describe("por variante: no dice cuál ganó, dice EN QUÉ difieren", () => {
  it("separa los temas de cada lado", () => {
    const r = resumirPorVariante({
      produccion: [critica([h("plano", "detalle")])],
      "sin-coherencia-cromatica": [critica([h("color", "rompe")])],
    });
    expect(r.produccion.temas[0].defecto).toBe("plano");
    expect(r["sin-coherencia-cromatica"].temas[0].defecto).toBe("color");
    expect(r["sin-coherencia-cromatica"].conRotos).toBe(1);
    expect(r.produccion.conRotos).toBe(0);
  });
});

describe("normalizarCritica: el candado del vocabulario", () => {
  it("tira hallazgos con un defecto inventado", () => {
    // Un defecto fuera del vocabulario rompería el conteo EN SILENCIO: saldría
    // un tema que nadie sabe de dónde salió.
    const c = normalizarCritica({
      resumen: "x",
      loQueFunciona: "y",
      hallazgos: [
        h("color", "rompe"),
        { ...h("color", "rompe"), defecto: "vibra-rara" },
      ],
    });
    expect(c.hallazgos).toHaveLength(1);
    expect(c.hallazgos[0].defecto).toBe("color");
  });

  it("tira hallazgos sin arreglo: la mitad que ninguna rúbrica da", () => {
    const c = normalizarCritica({
      hallazgos: [{ ...h("color", "rompe"), arreglo: "" }],
    });
    expect(c.hallazgos).toEqual([]);
  });

  it("ordena por gravedad aunque el modelo los devuelva revueltos", () => {
    const c = normalizarCritica({
      hallazgos: [h("plano", "detalle"), h("color", "rompe"), h("clima", "resta")],
    });
    expect(c.hallazgos.map((x) => x.gravedad)).toEqual(["rompe", "resta", "detalle"]);
  });

  it("el vocabulario es el mismo que usa Roberto al votar", () => {
    // Si estas dos listas se separan, los hallazgos del juez y las marcas
    // humanas dejan de poder contarse juntos.
    expect(DEFECTOS_VALIDOS).toContain("color");
    expect(DEFECTOS_VALIDOS).toContain("proporcion");
    expect(DEFECTOS_VALIDOS.length).toBeGreaterThanOrEqual(7);
  });
});
