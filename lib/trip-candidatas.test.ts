import { describe, expect, it } from "vitest";
import { candKey, candNoKey, candidatasDeOverrides } from "@/lib/trip-candidatas";

// EL CONTRATO DE LAS LLAVES NAMESPACED EN OVERRIDES.
//
// `trips.overrides` es un solo jsonb compartido por TRES inquilinos: las
// decisiones del match (llaves numéricas "3"), los sustitutos elegidos
// ("sub:3") y ahora las candidatas del duelo ("cand:3" / "candNo:3"). Nadie
// valida ese blob — la disciplina de los prefijos ES el aislamiento. Esto
// blinda que el lector de candidatas no lea de más ni de menos.

const img = (n: string) => (n === "Camisa negra" ? "https://x/cam.jpg" : null);

describe("candidatasDeOverrides", () => {
  it("lee la candidata con su imagen y los descartes", () => {
    const { candidatas, descartados } = candidatasDeOverrides(
      { [candKey(3)]: "Camisa negra", [candNoKey(5)]: true },
      img
    );
    expect(candidatas[3]).toEqual({ nombre: "Camisa negra", image: "https://x/cam.jpg" });
    expect(descartados).toEqual([5]);
  });

  it("IGNORA a los otros dos inquilinos del blob: decisiones y sustitutos", () => {
    // La decisión "3" del match y el "sub:2" elegido no son candidatas. Si el
    // regex fuera laxo ("cand" como substring, o llaves numéricas), el duelo
    // se pintaría sobre datos de otro dueño.
    const { candidatas, descartados } = candidatasDeOverrides(
      { "3": "accept", "sub:2": "Jeans negros", basura: 9 },
      img
    );
    expect(Object.keys(candidatas)).toHaveLength(0);
    expect(descartados).toHaveLength(0);
  });

  it("una candidata que YA es el sustituto elegido sale como GANADA, no desaparece", () => {
    // Elegiste "me quedo con la mía": sub:3 = la candidata. Sigue en el mapa
    // porque el duelo resuelto se pinta (con su "deshacer"); lo que la
    // distingue de una pendiente es estar en `ganados`. Omitirla —como hacía
    // la primera versión— era justo lo que dejaba la decisión sin vuelta atrás.
    const { candidatas, ganados } = candidatasDeOverrides(
      { [candKey(3)]: "Camisa negra", "sub:3": "Camisa negra" },
      img
    );
    expect(candidatas[3]).toEqual({ nombre: "Camisa negra", image: "https://x/cam.jpg" });
    expect(ganados).toEqual([3]);
  });

  // Hasta el 2026-10-21 un sustituto distinto de la candidata NO contaba como
  // ganado, y el duelo volvía a pintarse pendiente al recargar aunque ya
  // hubiera elegido una prenda suya. Con "elegir otra de mi clóset" en el
  // duelo, elegir a mano ES resolverlo a favor de lo suyo (con su "deshacer").
  it("un sustituto elegido a mano, distinto de la candidata, también cierra el duelo", () => {
    const { ganados } = candidatasDeOverrides(
      { [candKey(3)]: "Camisa negra", "sub:3": "Camisa azul" },
      img
    );
    expect(ganados).toEqual([3]);
  });

  it("un sustituto sin candidata (un parecido resuelto a mano) también", () => {
    expect(candidatasDeOverrides({ "sub:5": "Suéter gris" }, img).ganados).toEqual([5]);
  });

  it("sin imagen resuelta, la candidata sobrevive (la imagen es cosmética)", () => {
    const { candidatas } = candidatasDeOverrides({ [candKey(1)]: "Top vino" }, img);
    expect(candidatas[1]).toEqual({ nombre: "Top vino", image: null });
  });

  it("overrides null o vacío no truena", () => {
    expect(candidatasDeOverrides(null, img)).toEqual({ candidatas: {}, descartados: [], ganados: [] });
    expect(candidatasDeOverrides({}, img)).toEqual({ candidatas: {}, descartados: [], ganados: [] });
  });
});
