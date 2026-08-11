// Clima vía Open-Meteo (gratuita, sin API key). Si algo falla, regresamos
// null y el motor genera sin clima — el clima nunca bloquea (spec E6).

// `estimated` = no es pronóstico real (el viaje cae fuera del horizonte de
// Open-Meteo, ~16 días). Es el clima TÍPICO de la temporada, sacado del histórico
// del año pasado en esas mismas fechas. La UI lo etiqueta distinto ("clima típico").
export type Weather = { temp_c: number; condition: string; estimated?: boolean };

// Grupos de weather_code de Open-Meteo → descripción corta en español.
function describe(code: number): string {
  if (code === 0) return "despejado";
  if (code <= 3) return "parcialmente nublado";
  if (code <= 48) return "neblina";
  if (code <= 57) return "llovizna";
  if (code <= 67) return "lluvia";
  if (code <= 77) return "nieve";
  if (code <= 82) return "chubascos";
  if (code <= 86) return "nieve";
  return "tormenta";
}

// ¿ESTA CONDICIÓN TRAE AGUA? La pregunta la comparten el wizard que la
// PREGUNTA (weather-picker), el prompt que la ORDENA (engine/prompt), el juez
// que la revisa (engine/critic, engine/rubrica) y el banco de evales. Vivía
// escrita cinco veces —y la copia del wizard ya había derivado: sin el flag de
// mayúsculas y con otra lista de palabras—, que es justo como el techado se
// rompe en silencio: la UI no pregunta por una lluvia que el motor sí ve.
// Todas llaman aquí; agregar "aguacero" es un solo cambio.
const LLUVIA_RE = /lluvia|llov|chubasco|tormenta/i;

export function hayLluvia(condition: string | null | undefined): boolean {
  return LLUVIA_RE.test(condition ?? "");
}

/**
 * El clima que ve EL MOTOR cuando la persona dijo que va a estar bajo techo.
 *
 * Es la decisión de Roberto y es de mitigación, no de prompt: "si nosotros ya
 * tenemos una heurística de que, aunque llueva, va a estar adentro, entonces no
 * le damos ese dato". Mandarle los DOS hechos ("va a llover" + "va a estar
 * adentro") lo obliga a resolver una contradicción y ahí es donde se rompe —
 * mandarle solo la temperatura no.
 *
 * Quitar la palabra de lluvia apaga de una vez, y sin tocar el prompt, las tres
 * cosas que dependen de ella: la instrucción de capa impermeable, la regla de
 * calzado (reglas-ejecucion #6) y la de capa exterior (#7). Todas leen esta
 * misma condición.
 *
 * LA TEMPERATURA NUNCA SE TOCA: bajo techo sigues eligiendo entre manga corta y
 * abrigo. Lo único que sobra es el agua.
 *
 * OJO — esto es SOLO para el motor. El clima que se PERSISTE con el look es el
 * real (llovió), porque el historial no debe mentir sobre el día.
 */
export function climaParaElMotor(
  weather: Weather | null,
  techado: boolean
): Weather | null {
  if (!weather || !techado || !hayLluvia(weather.condition)) return weather;
  // "nublado" y no "despejado": cuando llueve el cielo está cerrado, y es lo
  // más cercano a la verdad que se puede decir sin nombrar el agua.
  return { ...weather, condition: "nublado" };
}

// Resuelve el clima desde el body del request: si viene clima manual (el
// usuario lo eligió con referencias), se usa tal cual; si vienen coords, se
// consulta Open-Meteo; si no, null (el motor genera sin clima).
export async function resolveWeather(body: {
  lat?: number;
  lon?: number;
  weather?: { temp_c?: number; condition?: string };
}): Promise<Weather | null> {
  const m = body.weather;
  if (
    m &&
    typeof m.temp_c === "number" &&
    Number.isFinite(m.temp_c) &&
    m.temp_c >= -30 &&
    m.temp_c <= 55 &&
    typeof m.condition === "string"
  ) {
    return { temp_c: Math.round(m.temp_c), condition: m.condition.slice(0, 40) };
  }
  if (typeof body.lat === "number" && typeof body.lon === "number") {
    return getWeather(body.lat, body.lon);
  }
  return null;
}

export async function getWeather(
  lat: number,
  lon: number
): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temp !== "number" || typeof code !== "number") return null;
    return { temp_c: Math.round(temp), condition: describe(code) };
  } catch {
    return null;
  }
}

// Modo viaje: ciudad → coords vía Open-Meteo geocoding (gratis, sin key).
export async function geocodePlace(
  name: string
): Promise<{ lat: number; lon: number; label: string } | null> {
  const q = name.trim();
  if (!q) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      q
    )}&count=1&language=es&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r || typeof r.latitude !== "number" || typeof r.longitude !== "number") return null;
    const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    return { lat: r.latitude, lon: r.longitude, label };
  } catch {
    return null;
  }
}

// Agrega el bloque `daily` de Open-Meteo (forecast o archive — mismo shape) a un
// solo resumen: temperatura media del rango y condición predominante.
function aggregateDaily(daily: unknown): { temp_c: number; condition: string } | null {
  const d = (daily ?? {}) as {
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
    weather_code?: unknown;
  };
  const maxes = d.temperature_2m_max;
  const mins = d.temperature_2m_min;
  const codes = d.weather_code;
  if (!Array.isArray(maxes) || maxes.length === 0) return null;

  let sum = 0;
  let n = 0;
  for (let i = 0; i < maxes.length; i++) {
    const mx = maxes[i];
    const mn = Array.isArray(mins) ? mins[i] : undefined;
    if (typeof mx === "number" && typeof mn === "number") {
      sum += (mx + mn) / 2;
      n++;
    } else if (typeof mx === "number") {
      sum += mx;
      n++;
    }
  }
  if (n === 0) return null;

  const valid = (Array.isArray(codes) ? codes : []).filter(
    (c): c is number => typeof c === "number"
  );
  // Precipitación: lluvia/llovizna/chubascos vs nieve. Solo etiquetamos el rango
  // como lluvioso/nevado si la precipitación DOMINA (más de la mitad de los días)
  // — antes un solo día con llovizna marcaba "lluvia" todo el viaje. Y la nieve
  // (códigos 71-77, 85-86) ya no se confunde con lluvia.
  const isRain = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82);
  const isSnow = (c: number) => (c >= 71 && c <= 77) || (c >= 85 && c <= 86);
  const rainN = valid.filter(isRain).length;
  const snowN = valid.filter(isSnow).length;
  let condition: string;
  if (valid.length > 0 && rainN + snowN > valid.length / 2) {
    condition = snowN >= rainN ? "nieve" : "lluvia";
  } else {
    condition = describe(valid[Math.floor(valid.length / 2)] ?? 0);
  }
  return { temp_c: Math.round(sum / n), condition };
}

// Modo viaje: clima agregado para el rango de fechas (resumen único del viaje).
// Primero intenta el PRONÓSTICO de Open-Meteo (~16 días). Si el viaje está más
// lejos (no hay pronóstico), cae al HISTÓRICO: el mismo rango de fechas del año
// pasado vía archive-api. "Nueva York en agosto = caluroso" — sentido común
// estacional en vez de un genérico sin clima. Marca ese clima como `estimated`.
export async function getWeatherForDates(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<Weather | null> {
  const forecast = await fetchDailyWeather(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&start_date=${startDate}&end_date=${endDate}&timezone=auto`
  );
  if (forecast) return forecast;

  // Fuera del horizonte de pronóstico → histórico del año pasado en esas fechas.
  return getHistoricalWeatherForDates(lat, lon, startDate, endDate);
}

// Llama a Open-Meteo (forecast o archive) y agrega el resultado. null si falla.
async function fetchDailyWeather(url: string): Promise<{ temp_c: number; condition: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return aggregateDaily(data?.daily);
  } catch {
    return null;
  }
}

// Histórico: el mismo rango de fechas (mismos mes-día, mismos días de duración)
// del AÑO PASADO relativo a hoy — siempre tiene datos en el archive (que va con
// pocos días de retraso). Sirve para viajes a meses vista, donde no hay pronóstico
// pero el clima típico de la temporada sí informa qué empacar.
export async function getHistoricalWeatherForDates(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<Weather | null> {
  // Duración del viaje (días inclusivos), para reconstruir el rango histórico.
  const a = new Date(startDate + "T00:00:00Z").getTime();
  const b = new Date(endDate + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const days = Math.max(1, Math.round((b - a) / 86_400_000) + 1);

  // Año pasado relativo a HOY (no al viaje): garantiza datos aunque el viaje sea
  // a 2027. Conserva mes-día del inicio; el fin se recalcula sumando los días.
  const histYear = new Date().getUTCFullYear() - 1;
  const histStart = `${histYear}-${startDate.slice(5)}`;
  const sd = new Date(histStart + "T00:00:00Z");
  if (!Number.isFinite(sd.getTime())) return null;
  sd.setUTCDate(sd.getUTCDate() + (days - 1));
  const histEnd = sd.toISOString().slice(0, 10);

  const agg = await fetchDailyWeather(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&start_date=${histStart}&end_date=${histEnd}&timezone=auto`
  );
  if (!agg) return null;
  return { ...agg, estimated: true };
}
