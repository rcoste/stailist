import { describe, expect, it } from "vitest";
import { routeForStep } from "./onboarding";

// LO QUE BLINDAN: que la prueba A/B del onboarding con fotos cambie UNA sola
// cosa del camino (el paso 2) y que un borrador de esa variante pase primero
// por el correo, porque sin correo no hay fotos (Storage y la IA no abren).

describe("routeForStep con la prueba A/B", () => {
  it("sin perfil, o en la lista de siempre, el paso 2 es la lista de básicos", () => {
    expect(routeForStep(2)).toBe("/onboarding/closet");
    expect(routeForStep(2, { onboarding_variante: "basicos", email: "a@b.c" })).toBe("/onboarding/closet");
    expect(routeForStep(2, { onboarding_variante: null, email: null })).toBe("/onboarding/closet");
  });
  it("en la variante con fotos, el paso 2 son las fotos; sin correo, primero el correo", () => {
    expect(routeForStep(2, { onboarding_variante: "fotos", email: "a@b.c" })).toBe("/onboarding/fotos");
    expect(routeForStep(2, { onboarding_variante: "fotos", email: null })).toBe("/onboarding/correo");
  });
  it("los demás pasos no cambian con la variante", () => {
    for (const step of [0, 1, 3, 4]) {
      expect(routeForStep(step, { onboarding_variante: "fotos", email: "a@b.c" })).toBe(routeForStep(step));
    }
    expect(routeForStep(5, { onboarding_variante: "fotos", email: "a@b.c" })).toBe("/hoy");
  });
});
