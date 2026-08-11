import { describe, it, expect } from "vitest";
import { pasosDelWizard } from "./wizard-pasos";

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
