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

// Modo viaje: pronóstico agregado para el rango de fechas (resumen único del
// viaje). Open-Meteo da pronóstico ~16 días; fuera de eso devuelve null y el
// caller cae a preguntar el clima esperado.
export async function getWeatherForDates(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&start_date=${startDate}&end_date=${endDate}&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const maxes = data?.daily?.temperature_2m_max;
    const mins = data?.daily?.temperature_2m_min;
    const codes = data?.daily?.weather_code;
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
    const rainy = valid.some((c) => c >= 51 && c <= 82);
    const condition = rainy
      ? "lluvia"
      : describe(valid[Math.floor(valid.length / 2)] ?? 0);
    return { temp_c: Math.round(sum / n), condition };
  } catch {
    return null;
  }
}
