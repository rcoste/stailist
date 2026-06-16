// Clima vía Open-Meteo (gratuita, sin API key). Si algo falla, regresamos
// null y el motor genera sin clima — el clima nunca bloquea (spec E6).

export type Weather = { temp_c: number; condition: string };

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
