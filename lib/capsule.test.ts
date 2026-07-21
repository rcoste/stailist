import { describe, it, expect } from "vitest";
import {
  ASSESSMENT_QUESTIONS,
  assessmentQuestions,
  lifestyleSummary,
} from "./capsule";

describe("assessmentQuestions — quiz con género", () => {
  const findOpt = (qs: ReturnType<typeof assessmentQuestions>, qid: string, value: string) =>
    qs.find((q) => q.id === qid)?.options.find((o) => o.value === value);

  it("sin género devuelve la versión neutra tal cual", () => {
    expect(assessmentQuestions(null)).toBe(ASSESSMENT_QUESTIONS);
    expect(findOpt(ASSESSMENT_QUESTIONS, "fit", "nose")?.label).toBe("Aún no lo sé");
  });

  it("mujer: concordancia femenina y ejemplos de su clóset", () => {
    const qs = assessmentQuestions("mujer");
    expect(findOpt(qs, "fit", "nose")?.label).toBe("No estoy segura");
    expect(findOpt(qs, "formalidad_techo", "smart")?.hint).toContain("blusa");
  });

  it("hombre: concordancia masculina y ejemplos de su clóset", () => {
    const qs = assessmentQuestions("hombre");
    expect(findOpt(qs, "fit", "nose")?.label).toBe("No estoy seguro");
    expect(findOpt(qs, "formalidad_techo", "smart")?.hint).toContain("camisa");
  });

  it("ids y values idénticos en las tres versiones (las respuestas guardadas no cambian)", () => {
    const shape = (qs: ReturnType<typeof assessmentQuestions>) =>
      qs.map((q) => `${q.id}:${q.options.map((o) => o.value).join(",")}`).join("|");
    expect(shape(assessmentQuestions("mujer"))).toBe(shape(ASSESSMENT_QUESTIONS));
    expect(shape(assessmentQuestions("hombre"))).toBe(shape(ASSESSMENT_QUESTIONS));
  });

  it("no muta la versión neutra (devuelve copias)", () => {
    assessmentQuestions("mujer");
    expect(findOpt(ASSESSMENT_QUESTIONS, "fit", "nose")?.label).toBe("Aún no lo sé");
  });
});

describe("lifestyleSummary — el fit 'nose' no entra al resumen", () => {
  it("descarta 'nose' (no produce 'prefiere la ropa aún no lo sé')", () => {
    const s = lifestyleSummary({ fit: "nose", eventos: "seguido" });
    expect(s).not.toContain("prefiere la ropa");
    expect(s).toContain("eventos");
  });

  it("un fit real sí entra", () => {
    expect(lifestyleSummary({ fit: "entallado" })).toContain("prefiere la ropa entallado");
  });
});
