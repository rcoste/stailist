import { describe, it, expect } from "vitest";
import { pickWindow } from "./index";

// EL CLIMA ES EL DE LAS HORAS EN QUE SE USA EL LOOK, NO EL DE CUANDO SE PIDE.
//
// Val (usuaria): "aunque yo especifique que el outfit es para más tarde, la app
// toma en cuenta el clima actual y no el pronóstico de la hora objetivo".
//
// Lo que estos tests blindan no es el parseo de un JSON: es la decisión de
// stylist de que la ventana son LAS HORAS QUE TRAES LA ROPA PUESTA. Ni el
// instante en que preguntas, ni el pico del día, ni el promedio de 24h que
// arrastra el mínimo de la madrugada. Medido en Querétaro el 2026-08-31 —25.6°
// a las 14:00 contra 17.7° a las 21:00— eso son dos bandas de BUCKETS
// (Cálido "playera, a gusto" → Templado "manga larga ligera"): cambia la capa.
//
// Los payloads son la forma literal de Open-Meteo con `timezone=auto`: los
// `time` vienen en hora LOCAL del punto, sin sufijo de zona.

const DIA = { desde: 9, hasta: 19 };
const NOCHE = { desde: 19, hasta: 23 };

/** Curva real de Querétaro el 2026-08-31, 0-23h. */
const CURVA = [
  17.1, 16.6, 16.2, 15.9, 15.6, 15.4, 15.3, 16.9, 19.4, 21.6, 23.4, 24.6,
  25.2, 25.5, 25.6, 25.2, 24.3, 22.9, 21.0, 19.4, 18.4, 17.7, 17.2, 16.8,
];

function dia(fecha: string, ahora: string | null, tempAhora = 22.9, codes?: number[]) {
  return {
    hourly: {
      time: CURVA.map((_, h) => `${fecha}T${String(h).padStart(2, "0")}:00`),
      temperature_2m: CURVA,
      weather_code: codes ?? CURVA.map(() => 0),
    },
    ...(ahora
      ? { current: { time: ahora, temperature_2m: tempAhora, weather_code: 0 } }
      : {}),
  };
}

const prom = (a: number, b: number) =>
  Math.round(CURVA.slice(a, b + 1).reduce((x, y) => x + y, 0) / (b - a + 1));

describe("pickWindow", () => {
  it("un look de noche pedido en la tarde trae el clima de la NOCHE", () => {
    // El caso de Val, exacto: son las 17:00 (22.9°) y pide algo para la noche.
    const d = dia("2026-08-31", "2026-08-31T17:00");
    const w = pickWindow(d, "2026-08-31", NOCHE.desde, NOCHE.hasta)!;
    expect(w.temp_c).toBe(prom(19, 23)); // 18°
    // Y NO los 23° de ahora, que es lo que devolvía antes.
    expect(w.temp_c).not.toBe(23);
  });

  it("día y noche del mismo día dan bandas distintas", () => {
    // Si estos dos coincidieran, todo el arreglo sería decorativo.
    const d = dia("2026-08-31", "2026-08-31T07:00", 16.9);
    expect(pickWindow(d, "2026-08-31", DIA.desde, DIA.hasta)!.temp_c).toBe(prom(9, 19)); // 23°
    expect(pickWindow(d, "2026-08-31", NOCHE.desde, NOCHE.hasta)!.temp_c).toBe(prom(19, 23)); // 18°
  });

  it("la ventana del día NO es el pico ni el promedio de 24h", () => {
    // Las dos formas fáciles de equivocarse: vestirte para las 14:00 (25.6°) te
    // deja con frío a las 9am; el promedio del día entero (~20°) arrastra el
    // mínimo de las 6am, cuando nadie anda en la calle.
    const d = dia("2026-08-31", "2026-08-31T07:00", 16.9);
    const w = pickWindow(d, "2026-08-31", DIA.desde, DIA.hasta)!;
    const pico = Math.round(Math.max(...CURVA));
    const dia24 = Math.round(CURVA.reduce((a, b) => a + b, 0) / 24);
    expect(w.temp_c).toBeLessThan(pico);
    expect(w.temp_c).toBeGreaterThan(dia24);
  });

  it("si el look es para HOY, la ventana empieza AHORA", () => {
    // Pedir algo "de día" a las 5pm: las horas que te faltan son 17-19, no la
    // mañana que ya pasaste vestido de otra cosa.
    const d = dia("2026-08-31", "2026-08-31T17:00");
    expect(pickWindow(d, "2026-08-31", DIA.desde, DIA.hasta)!.temp_c).toBe(prom(17, 19)); // 21°
  });

  it("una fecha futura no mira el reloj: la ventana completa", () => {
    // `current` es de hoy y la fecha objetivo es otra — nada "ya pasó".
    const d = { ...dia("2026-09-01", null), current: { time: "2026-08-31T17:00", temperature_2m: 22.9, weather_code: 0 } };
    expect(pickWindow(d, "2026-09-01", DIA.desde, DIA.hasta)!.temp_c).toBe(prom(9, 19));
  });

  it("si la ventana entera ya pasó, cae al ahora", () => {
    // Un look "de día" pedido a las 11pm. Raro, pero no debe devolver null.
    const d = dia("2026-08-31", "2026-08-31T23:00", 16.8);
    expect(pickWindow(d, "2026-08-31", DIA.desde, DIA.hasta)!.temp_c).toBe(17);
  });

  it("BASTA UNA HORA DE AGUA: una tormenta a las 21:00 moja la noche entera", () => {
    // Aquí NO aplica la regla de mayoría de aggregateDaily (esa resume viajes
    // de varios días). Son las horas en que traes la ropa puesta: si llueve en
    // una sola, necesitas la capa. La UI conserva la salida ("¿la lluvia te
    // toca?") para quien vaya entechado.
    const codes = CURVA.map(() => 0);
    codes[21] = 95;
    const d = dia("2026-08-31", "2026-08-31T17:00", 22.9, codes);
    expect(pickWindow(d, "2026-08-31", NOCHE.desde, NOCHE.hasta)!.condition).toBe("tormenta");
    // Y el día, que no la toca, sigue seco.
    expect(pickWindow(d, "2026-08-31", DIA.desde, DIA.hasta)!.condition).toBe("despejado");
  });

  it("no degrada una tormenta a llovizna", () => {
    // Se queda con lo más severo de la ventana: salir con paraguas de bolsillo
    // a una tormenta es peor que sobre-preparse para una llovizna.
    const codes = CURVA.map(() => 0);
    codes[20] = 51; // llovizna
    codes[22] = 82; // chubascos violentos
    const d = dia("2026-08-31", "2026-08-31T17:00", 22.9, codes);
    expect(pickWindow(d, "2026-08-31", NOCHE.desde, NOCHE.hasta)!.condition).toBe("chubascos");
  });

  it("sin horas en el payload cae al ahora; sin nada, null", () => {
    // Fail-open: el clima nunca bloquea (spec E6). El llamador cae al resumen
    // diario cuando esto devuelve null.
    const soloAhora = {
      hourly: { time: [], temperature_2m: [], weather_code: [] },
      current: { time: "2026-08-31T17:00", temperature_2m: 22.9, weather_code: 3 },
    };
    expect(pickWindow(soloAhora, "2026-08-31", NOCHE.desde, NOCHE.hasta)).toEqual({
      temp_c: 23,
      condition: "parcialmente nublado",
    });
    expect(pickWindow({}, "2026-08-31", NOCHE.desde, NOCHE.hasta)).toBeNull();
    expect(pickWindow(null, "2026-08-31", NOCHE.desde, NOCHE.hasta)).toBeNull();
  });
});
