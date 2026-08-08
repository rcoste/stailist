import { describe, it, expect } from "vitest";
import { cuantasFaltan, preguntasPendientes, type PrendaAfinable } from "./afinar-prendas";

// Lo que estos tests protegen NO es que se pregunte, sino que NO se pregunte de
// más. El checklist de básicos nació para que catalogar el clóset no tomara
// horas; devolver 78 preguntas lo desharía.

// El spread al final y NO `?? default`: con `??`, pasar null explícito caía al
// default y los casos de "sin corte" / "sin categoría" nunca se probaban — el
// test decía que pasaban y no probaba nada.
const p = (o: Partial<PrendaAfinable> = {}): PrendaAfinable => ({
  id: "x",
  nombre: "Jeans negros",
  categoria: "bottom",
  certeza: "asumida",
  corte: "recto",
  usos: 5,
  ...o,
});

describe("a quién SÍ se le pregunta", () => {
  it("una prenda asumida, con corte inventado y usada", () => {
    expect(preguntasPendientes([p()])).toHaveLength(1);
  });

  it("ordena por USOS: primero donde el dato falso más pesa", () => {
    const r = preguntasPendientes([
      p({ id: "poco", usos: 1 }),
      p({ id: "mucho", usos: 14 }),
      p({ id: "medio", usos: 6 }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["mucho", "medio", "poco"]);
  });

  it("el tope es bajo a propósito: es un goteo, no un formulario", () => {
    const muchas = Array.from({ length: 30 }, (_, i) => p({ id: `i${i}`, usos: i }));
    expect(preguntasPendientes(muchas)).toHaveLength(3);
    // Pero se puede saber cuántas quedan sin prometer acabarlas hoy.
    expect(cuantasFaltan(muchas)).toBe(29); // la de usos=0 no cuenta
  });
});

describe("a quién NO se le pregunta — aquí está el valor", () => {
  it("una prenda con FOTO ya tiene su dato: no se pregunta", () => {
    expect(preguntasPendientes([p({ certeza: "exacta" })])).toHaveLength(0);
    expect(preguntasPendientes([p({ certeza: "generica" })])).toHaveLength(0);
  });

  it("una prenda que NUNCA se ha usado: preguntarla es cobrar sin dar", () => {
    expect(preguntasPendientes([p({ usos: 0 })])).toHaveLength(0);
  });

  it("sin corte inventado no hay nada que corregir", () => {
    // Si el catálogo no le puso corte, el motor no está afirmando nada falso.
    expect(preguntasPendientes([p({ corte: null })])).toHaveLength(0);
  });

  it("categorías donde el corte NO significa nada", () => {
    // El corte de unos lentes o un cinturón no cambia ningún look.
    for (const categoria of ["accesorio", "calzado"]) {
      expect(preguntasPendientes([p({ categoria })])).toHaveLength(0);
    }
  });

  it("sin categoría tampoco: no se puede saber si el corte importa", () => {
    expect(preguntasPendientes([p({ categoria: null })])).toHaveLength(0);
  });
});

describe("cómo se pregunta", () => {
  it("en plural para pantalones, en singular para prendas de arriba", () => {
    const [jeans] = preguntasPendientes([p({ nombre: "Jeans negros" })]);
    expect(jeans.texto).toContain("quedan");
    expect(jeans.opciones[0].label).toBe("ajustados al cuerpo");

    const [camisa] = preguntasPendientes([
      p({ nombre: "Camisa blanca", categoria: "top" }),
    ]);
    expect(camisa.texto).toContain("queda");
    expect(camisa.opciones[0].label).toBe("entallada");
  });

  it("las opciones están en palabras de persona, no de catálogo", () => {
    const [q] = preguntasPendientes([p()]);
    // El valor guardado es el del catálogo; lo que se LEE, no.
    expect(q.opciones.map((o) => o.valor)).toEqual(["entallado", "recto", "holgado"]);
    expect(q.opciones.map((o) => o.label)).not.toContain("entallado");
  });
});
