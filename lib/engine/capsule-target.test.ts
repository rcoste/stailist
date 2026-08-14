import { describe, it, expect } from "vitest";
import { bloqueVida } from "./capsule-target";
import { ASSESSMENT_QUESTIONS, type AssessmentQuestion } from "@/lib/capsule";

// Lo que se blinda: QUÉ frase le llega al motor por cada respuesta del quiz.
// El bloque "vida" es la mitad del contexto de la cápsula ideal, y el texto de
// la pregunta viaja dentro — así que reescribir una pregunta para que se
// entienda mejor puede, sin querer, quitarle señal al prompt.

const q = (over: Partial<AssessmentQuestion> = {}): AssessmentQuestion => ({
  id: "actividades",
  label: "pregunta de pantalla",
  multi: true,
  options: [
    { value: "gym", label: "Gym o deporte" },
    { value: "noche", label: "Salir de noche" },
  ],
  ...over,
});

describe("bloqueVida — qué le llega al motor del quiz de vida", () => {
  it("usa promptLabel en vez del label cuando la pregunta lo trae", () => {
    const linea = bloqueVida(
      [q({ promptLabel: "la frase que le rinde al motor" })],
      { actividades: "gym" }
    );
    expect(linea).toBe("- la frase que le rinde al motor → Gym o deporte");
  });

  it("sin promptLabel usa el label de la pantalla (comportamiento de siempre)", () => {
    expect(bloqueVida([q()], { actividades: "gym" })).toBe(
      "- pregunta de pantalla → Gym o deporte"
    );
  });

  it("una pregunta sin contestar no ocupa línea", () => {
    expect(bloqueVida([q()], {})).toBe("");
  });

  it("multi junta todas las respuestas elegidas", () => {
    expect(bloqueVida([q()], { actividades: "gym,noche" })).toBe(
      "- pregunta de pantalla → Gym o deporte, Salir de noche"
    );
  });

  // La regresión concreta del 2026-08-13: la pregunta de actividades se
  // reescribió porque "¿qué pide ropa especial?" confundía a la gente, pero esa
  // frase era justo la que le decía al motor que esas actividades SUMAN piezas.
  // Si alguien borra el promptLabel, el motor deja de oír la instrucción.
  it("la pregunta de actividades le sigue pidiendo ropa al motor", () => {
    const real = ASSESSMENT_QUESTIONS.find((x) => x.id === "actividades")!;
    expect(real.label).not.toMatch(/ropa especial/);
    expect(bloqueVida([real], { actividades: "gym" })).toMatch(/ropa especial/);
  });
});
