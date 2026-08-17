import { describe, it, expect } from "vitest";
import { pasosDelWizard, momentoSugerido } from "./wizard-pasos";

// Base: día normal desde Hoy, sin nada que acotar.
const base = {
  saltaElPlan: false,
  objective: "diario" as string | null,
  tipoEvento: null as string | null,
  planLibre: false,
  codigoGuardado: null as string | null,
  codigoEfectivo: null as string | null,
};

describe("pasos del wizard", () => {
  it("el día normal son tres pantallas: plan → cuándo → clima", () => {
    expect(pasosDelWizard(base)).toEqual(["plan", "cuando", "clima"]);
  });

  it("el evento con su tipo elegido gana el paso de detalle", () => {
    expect(
      pasosDelWizard({ ...base, objective: "evento", tipoEvento: "boda" })
    ).toEqual(["plan", "detalle", "cuando", "clima"]);
  });

  it("evento SIN tipo todavía no acota nada (el detalle aparece al elegir el chip)", () => {
    expect(pasosDelWizard({ ...base, objective: "evento" })).toEqual([
      "plan",
      "cuando",
      "clima",
    ]);
  });

  it("contar el plan con tus palabras no abre detalle (no hay catálogo que acotar)", () => {
    expect(
      pasosDelWizard({
        ...base,
        objective: "evento",
        tipoEvento: "boda",
        planLibre: true,
      })
    ).toEqual(["plan", "cuando", "clima"]);
  });

  // EL HUECO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR.
  it("el PRIMER look con trabajo pregunta el código de vestimenta, aunque salte el plan", () => {
    expect(
      pasosDelWizard({ ...base, saltaElPlan: true, objective: "oficina" })
    ).toEqual(["detalle", "cuando", "clima"]);
  });

  it("el primer look con día normal no pregunta nada de más", () => {
    expect(pasosDelWizard({ ...base, saltaElPlan: true })).toEqual([
      "cuando",
      "clima",
    ]);
  });

  it("con el código ya guardado, trabajo no vuelve a preguntarlo nunca", () => {
    expect(
      pasosDelWizard({
        ...base,
        objective: "oficina",
        codigoGuardado: "business_casual",
        codigoEfectivo: "business_casual",
      })
    ).toEqual(["plan", "cuando", "clima"]);
  });

  it("quien dijo 'depende del día' sí tiene detalle cada vez (ahí se pregunta lo del cliente)", () => {
    expect(
      pasosDelWizard({
        ...base,
        objective: "oficina",
        codigoGuardado: "variable",
        codigoEfectivo: "variable",
      })
    ).toEqual(["plan", "detalle", "cuando", "clima"]);
  });

  // La trampa sutil: si el cálculo usara el código EFECTIVO, tocar una opción
  // borraría el paso en el que estás parado y el wizard saltaría solo.
  it("elegir el código dentro del paso no borra el paso bajo tus pies", () => {
    expect(
      pasosDelWizard({
        ...base,
        saltaElPlan: true,
        objective: "oficina",
        codigoGuardado: null, // el perfil sigue sin él hasta que se guarde
        codigoEfectivo: "casual", // acaba de tocarlo en esta pantalla
      })
    ).toEqual(["detalle", "cuando", "clima"]);
  });
});

describe("momentoSugerido — el default que ignoraba el reloj", () => {
  const alas = (h: number) => new Date(2026, 7, 17, h, 30);

  it("de noche sugiere noche", () => {
    expect(momentoSugerido(alas(21))).toBe("noche");
    expect(momentoSugerido(alas(23))).toBe("noche");
    expect(momentoSugerido(alas(2))).toBe("noche");
  });

  it("de día sugiere día", () => {
    expect(momentoSugerido(alas(9))).toBe("dia");
    expect(momentoSugerido(alas(15))).toBe("dia");
  });

  // Las fronteras exactas del umbral que el espejo ya usaba.
  it("las 19:00 ya son noche; las 18:59 todavía no", () => {
    expect(momentoSugerido(new Date(2026, 7, 17, 19, 0))).toBe("noche");
    expect(momentoSugerido(new Date(2026, 7, 17, 18, 59))).toBe("dia");
  });

  it("las 6:00 ya son día; las 5:59 todavía no", () => {
    expect(momentoSugerido(new Date(2026, 7, 17, 6, 0))).toBe("dia");
    expect(momentoSugerido(new Date(2026, 7, 17, 5, 59))).toBe("noche");
  });

  // A las 9pm planeando MAÑANA, el reloj no dice nada útil: arranca en día.
  it("para otro día arranca en día aunque sea de noche", () => {
    expect(momentoSugerido(alas(22), false)).toBe("dia");
    expect(momentoSugerido(alas(2), false)).toBe("dia");
  });
});
