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

  it("una candidata que YA es el sustituto elegido no vuelve a duelo", () => {
    // Elegiste "me quedo con la mía": sub:3 = la candidata. Re-proponer el
    // duelo sería preguntarte lo que ya contestaste.
    const { candidatas } = candidatasDeOverrides(
      { [candKey(3)]: "Camisa negra", "sub:3": "Camisa negra" },
      img
    );
    expect(candidatas[3]).toBeUndefined();
  });

  it("sin imagen resuelta, la candidata sobrevive (la imagen es cosmética)", () => {
    const { candidatas } = candidatasDeOverrides({ [candKey(1)]: "Top vino" }, img);
    expect(candidatas[1]).toEqual({ nombre: "Top vino", image: null });
  });

  it("overrides null o vacío no truena", () => {
    expect(candidatasDeOverrides(null, img)).toEqual({ candidatas: {}, descartados: [] });
    expect(candidatasDeOverrides({}, img)).toEqual({ candidatas: {}, descartados: [] });
  });
});
