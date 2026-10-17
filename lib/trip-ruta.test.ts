import { describe, it, expect, vi } from "vitest";

// La resolución de ruta compartida por POST /api/trip y PATCH /api/trip/[id]/ruta
// (handoff viaje 2). geocodePlace/getWeatherForDates van mockeados: aquí se
// prueba la LÓGICA (fallbacks, agregación, normalización), no Open-Meteo.
vi.mock("@/lib/weather", () => ({
  geocodePlace: vi.fn(async (name: string) => {
    if (name === "Nolandia") return null; // no geocodifica
    return { lat: 10, lon: 20, label: `${name}, Región, País` };
  }),
  getWeatherForDates: vi.fn(async (_lat: number, _lon: number, _ini: string, _fin: string) => ({
    temp_c: 18,
    condition: "despejado",
  })),
}));

import {
  TRIP_DATE_RE,
  MAX_PARADAS,
  MAX_NOMBRE_LUGAR,
  normalizarRuta,
  resolverParadas,
  aggregateWeather,
  ventanasDeParadas,
  lugarDisplay,
} from "./trip-ruta";
import type { Parada, TripWeather } from "./trip";

const w = (temp_c: number, condition: string, estimated?: boolean): TripWeather => ({
  temp_c,
  condition,
  ...(estimated ? { estimated: true } : {}),
});
const p = (lugar: string, weather: TripWeather | null = null): Parada => ({ lugar, weather });

describe("normalizarRuta — el body crudo a paradas limpias, EN PARES", () => {
  it("recorta, tira vacíos y de una letra, y deduplica ADYACENTES", () => {
    expect(normalizarRuta(["  Tokio ", "", "X", "Tokio", "Kioto"], undefined).lugares).toEqual([
      "Tokio",
      "Kioto",
    ]);
  });

  it("una ruta redonda es legítima: Tokio → Kioto → Tokio conserva las 3 paradas", () => {
    // El dedupe global (Set) colapsaba la vuelta y desalineaba las noches
    // por índice — el guard de longitud las tiraba TODAS (red team del ship).
    const { lugares, segNoches } = normalizarRuta(
      ["Tokio", "Kioto", "Tokio"],
      [{ noches: 2 }, { noches: 3 }, { noches: 1 }]
    );
    expect(lugares).toEqual(["Tokio", "Kioto", "Tokio"]);
    expect(segNoches).toEqual([2, 3, 1]);
  });

  it("las noches viajan CON su lugar: el dedupe no las desalinea", () => {
    const { lugares, segNoches } = normalizarRuta(
      ["Tokio", "Tokio", "Kioto"],
      [{ noches: 2 }, { noches: 2 }, { noches: 3 }]
    );
    expect(lugares).toEqual(["Tokio", "Kioto"]);
    expect(segNoches).toEqual([2, 3]);
  });

  it("tope de paradas: se queda con las primeras MAX_PARADAS, noches incluidas", () => {
    const siete = ["Aa", "Bb", "Cc", "Dd", "Ee", "Ff", "Gg"];
    const { lugares, segNoches } = normalizarRuta(
      siete,
      siete.map((_, i) => ({ noches: i + 1 }))
    );
    expect(lugares).toEqual(siete.slice(0, MAX_PARADAS));
    expect(segNoches).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("capa el largo de cada nombre (geocoder caído persiste el string tal cual)", () => {
    const largo = "x".repeat(500);
    expect(normalizarRuta([largo], undefined).lugares[0]).toHaveLength(MAX_NOMBRE_LUGAR);
  });

  it("sin segmentos (o con longitud rota): segNoches null, lugares limpios igual", () => {
    expect(normalizarRuta(["Tokio", "Kioto"], undefined).segNoches).toBeNull();
    expect(normalizarRuta(["Tokio", "Kioto"], [{ noches: 2 }]).segNoches).toBeNull();
  });

  it("basura de la red (no-array, nulls adentro) no truena: devuelve []", () => {
    expect(normalizarRuta(undefined, undefined).lugares).toEqual([]);
    expect(normalizarRuta("Tokio", undefined).lugares).toEqual([]);
    expect(normalizarRuta([null, undefined], undefined).lugares).toEqual([]);
  });
});

describe("TRIP_DATE_RE — el formato de fecha que aceptan ambas rutas", () => {
  it("acepta YYYY-MM-DD y rechaza lo demás", () => {
    expect(TRIP_DATE_RE.test("2026-08-14")).toBe(true);
    expect(TRIP_DATE_RE.test("2026-8-14")).toBe(false);
    expect(TRIP_DATE_RE.test("14/08/2026")).toBe(false);
    expect(TRIP_DATE_RE.test("")).toBe(false);
  });
});

describe("aggregateWeather — el resumen del header del viaje", () => {
  it("sin clima en ninguna parada: null (no un 0°C inventado)", () => {
    expect(aggregateWeather([p("Tokio"), p("Kioto")])).toBeNull();
  });

  it("promedia la temperatura redondeando, solo de las paradas con clima", () => {
    const agg = aggregateWeather([p("A", w(10, "despejado")), p("B", w(21, "nublado")), p("C")]);
    expect(agg?.temp_c).toBe(16); // (10+21)/2 = 15.5 → 16
  });

  it("precipitación solo si domina (mayoría de ciudades)", () => {
    // 1 de 3 con lluvia: NO marca el viaje — condition = la de la primera.
    const minoria = aggregateWeather([
      p("A", w(20, "despejado")),
      p("B", w(20, "lluvia ligera")),
      p("C", w(20, "nublado")),
    ]);
    expect(minoria?.condition).toBe("despejado");
    // 2 de 3 con lluvia: sí domina.
    const mayoria = aggregateWeather([
      p("A", w(20, "lluvia ligera")),
      p("B", w(20, "tormenta")),
      p("C", w(20, "despejado")),
    ]);
    expect(mayoria?.condition).toBe("lluvia");
  });

  it("lluvia minoritaria en la PRIMERA ciudad: hoy la condition del viaje es la de la primera", () => {
    // Fija el comportamiento dependiente de orden del fallback (conds[0]).
    // Si algún día se decide que la minoritaria no debe marcar el viaje ni
    // siquiera yendo primera, este test es el que debe cambiar A PROPÓSITO.
    const agg = aggregateWeather([
      p("A", w(20, "lluvia ligera")),
      p("B", w(20, "despejado")),
      p("C", w(20, "nublado")),
    ]);
    expect(agg?.condition).toBe("lluvia ligera");
  });

  it("nieve le gana a lluvia cuando empatan o la superan", () => {
    const agg = aggregateWeather([p("A", w(-2, "nieve")), p("B", w(1, "lluvia"))]);
    expect(agg?.condition).toBe("nieve");
  });

  it("estimated se contagia si CUALQUIER parada lo es; si ninguna, no aparece", () => {
    const conEst = aggregateWeather([p("A", w(20, "despejado", true)), p("B", w(20, "nublado"))]);
    expect(conEst?.estimated).toBe(true);
    const sinEst = aggregateWeather([p("A", w(20, "despejado"))]);
    expect(sinEst).not.toHaveProperty("estimated");
  });
});

describe("lugarDisplay — el `lugar` denormalizado que guarda trips", () => {
  it("primera parte de cada label, unidas con punto medio", () => {
    expect(
      lugarDisplay([p("Tokio, Tokio, Japón"), p("Kioto, Kioto, Japón"), p("Osaka, Osaka, Japón")])
    ).toBe("Tokio · Kioto · Osaka");
  });

  it("una parada: su nombre sin adornos", () => {
    expect(lugarDisplay([p("Nueva York, Nueva York, Estados Unidos")])).toBe("Nueva York");
  });
});

describe("resolverParadas — geocode + clima con fallbacks", () => {
  it("parada que geocodifica: label del geocoder + clima; noches solo si vienen", async () => {
    const paradas = await resolverParadas(["Tokio", "Kioto"], [2, null], "2026-09-01", "2026-09-04");
    expect(paradas[0]).toEqual({
      lugar: "Tokio, Región, País",
      lat: 10,
      lon: 20,
      noches: 2,
      weather: { temp_c: 18, condition: "despejado" },
    });
    // Sin noches (null): la llave NO aparece — el modo fechas no la inventa.
    expect(paradas[1]).not.toHaveProperty("noches");
  });

  it("parada que NO geocodifica: conserva su nombre, sin coordenadas ni clima", async () => {
    const [parada] = await resolverParadas(["Nolandia"], null, "2026-09-01", "2026-09-04");
    expect(parada).toEqual({ lugar: "Nolandia", lat: null, lon: null, weather: null });
  });

  it("con `previas`, un nombre sin cambios reusa sus coordenadas (no re-geocodifica)", async () => {
    const previa: Parada = { lugar: "Tokio, Región, País", lat: 35, lon: 139, weather: null };
    const [parada] = await resolverParadas(
      ["Tokio, Región, País"],
      null,
      "2026-09-01",
      "2026-09-04",
      [previa]
    );
    // lat/lon de la previa (35/139), NO del geocoder mockeado (10/20) — y un
    // timeout transitorio de Open-Meteo ya no puede pisar coords buenas.
    expect(parada.lat).toBe(35);
    expect(parada.lon).toBe(139);
    expect(parada.weather).toEqual({ temp_c: 18, condition: "despejado" });
  });
});

// 2026-10-17: el clima se pide por las fechas de CADA parada, y el resumen
// lleva el rango real del viaje (la mínima más baja, la máxima más alta).
describe("ventanasDeParadas", () => {
  it("encadena llegada y salida con las noches de cada parada", () => {
    expect(ventanasDeParadas("2026-10-22", "2026-11-17", [7, 9, 5, 5])).toEqual([
      { inicio: "2026-10-22", fin: "2026-10-29" },
      { inicio: "2026-10-29", fin: "2026-11-07" },
      { inicio: "2026-11-07", fin: "2026-11-12" },
      { inicio: "2026-11-12", fin: "2026-11-17" },
    ]);
  });
  it("sin noches (viaje viejo) no inventa: null → se usa el rango entero", () => {
    expect(ventanasDeParadas("2026-10-22", "2026-11-17", null)).toBeNull();
    expect(ventanasDeParadas("2026-10-22", "2026-11-17", [7, null])).toBeNull();
  });
  it("nunca pasa del fin del viaje", () => {
    expect(ventanasDeParadas("2026-10-22", "2026-10-25", [2, 5])![1]).toEqual({ inicio: "2026-10-24", fin: "2026-10-25" });
  });
});

describe("aggregateWeather — el rango del viaje", () => {
  it("la mínima más baja y la máxima más alta entre paradas", () => {
    const agg = aggregateWeather([
      p("Mineápolis", { temp_c: 6, condition: "nublado", temp_min: 1, temp_max: 11 }),
      p("Tokio", { temp_c: 14, condition: "despejado", temp_min: 9, temp_max: 19 }),
    ]);
    expect([agg?.temp_min, agg?.temp_max]).toEqual([1, 19]);
  });
  it("una parada sin rango aporta su promedio como mínima y máxima", () => {
    const agg = aggregateWeather([p("A", w(6, "nublado")), p("B", { temp_c: 14, condition: "x", temp_min: 9, temp_max: 19 })]);
    expect([agg?.temp_min, agg?.temp_max]).toEqual([6, 19]);
  });
});
