import { describe, it, expect } from "vitest";
import { climaParaElMotor, hayLluvia, type Weather } from "./index";

// BAJO TECHO LA LLUVIA NO EXISTE PARA EL MOTOR.
//
// Roberto: "puede estar lloviendo y si yo voy a estar siempre entechado, me la
// pela la lluvia... si nosotros ya tenemos una heurística de que, aunque
// llueva, va a estar adentro, entonces no le damos ese dato".
//
// La decisión de diseño que estos tests blindan es CUÁL de las dos formas se
// implementó: no se le manda al modelo "va a llover PERO estará bajo techo"
// para que lo resuelva —dos hechos en tensión son justo donde se rompe—, se le
// quita el dato del agua antes de que lo vea. Como el prompt y las reglas de
// ejecución leen la MISMA condición, quitarla apaga las tres cosas de una vez:
// capa impermeable, veto de calzado y paraguas.

const lluvia: Weather = { temp_c: 22, condition: "lluvia" };

describe("hayLluvia", () => {
  it("reconoce todo lo que Open-Meteo llama agua", () => {
    // Son las salidas literales de describe() en lib/weather: si esta lista se
    // desincroniza, la UI pregunta por una lluvia que el motor no ve (o al
    // revés) y nadie se entera.
    for (const c of ["lluvia", "llovizna", "chubascos", "tormenta"]) {
      expect(hayLluvia(c)).toBe(true);
    }
  });

  it("no confunde con lo seco", () => {
    for (const c of ["despejado", "parcialmente nublado", "neblina", "nieve"]) {
      expect(hayLluvia(c)).toBe(false);
    }
    expect(hayLluvia(null)).toBe(false);
    expect(hayLluvia(undefined)).toBe(false);
  });

  // La condición normalmente llega en minúsculas (describe() en este mismo
  // archivo), pero también puede venir de `weather` manual en el body de la
  // request (resolveWeather la acepta tal cual, sin normalizar mayúsculas).
  // El regex trae el flag /i a propósito — este test es la cerca contra que
  // alguien lo quite sin darse cuenta y la detección se vuelva silenciosamente
  // sensible a mayúsculas.
  it("detecta lluvia sin importar mayúsculas (clima manual no viene normalizado)", () => {
    expect(hayLluvia("Lluvia")).toBe(true);
    expect(hayLluvia("TORMENTA")).toBe(true);
  });
});

describe("climaParaElMotor", () => {
  it("bajo techo, el motor ya no ve lluvia", () => {
    const visto = climaParaElMotor(lluvia, true)!;
    expect(hayLluvia(visto.condition)).toBe(false);
  });

  it("LA TEMPERATURA NUNCA SE TOCA — bajo techo sigues eligiendo manga o abrigo", () => {
    // Es la mitad de la decisión y la más fácil de romper por accidente: lo que
    // sobra bajo techo es el agua, no el frío.
    expect(climaParaElMotor(lluvia, true)!.temp_c).toBe(22);
    expect(climaParaElMotor({ temp_c: 8, condition: "tormenta" }, true)!.temp_c).toBe(8);
  });

  it("afuera, el clima llega intacto (el lado seguro es no tocar nada)", () => {
    expect(climaParaElMotor(lluvia, false)).toEqual(lluvia);
  });

  it("sin lluvia, techado no cambia nada", () => {
    const seco: Weather = { temp_c: 25, condition: "despejado" };
    expect(climaParaElMotor(seco, true)).toEqual(seco);
  });

  it("no muta el clima original: lo persistido sigue diciendo que llovió", () => {
    // El historial NO debe mentir sobre el día. Si esta función mutara su
    // entrada, el look quedaría guardado como un día despejado que nunca fue.
    const original: Weather = { temp_c: 22, condition: "lluvia" };
    climaParaElMotor(original, true);
    expect(original.condition).toBe("lluvia");
  });

  it("conserva 'estimated' (el clima típico de una fecha lejana sigue siendo típico)", () => {
    const tipico: Weather = { temp_c: 20, condition: "llovizna", estimated: true };
    expect(climaParaElMotor(tipico, true)!.estimated).toBe(true);
  });

  it("sin clima no inventa uno", () => {
    expect(climaParaElMotor(null, true)).toBeNull();
    expect(climaParaElMotor(null, false)).toBeNull();
  });
});
