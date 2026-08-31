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

// Coords → nombre de ciudad ("Querétaro"). Open-Meteo no tiene geocoding
// inverso, así que esto va por BigDataCloud — misma clase de servicio (gratis,
// sin API key, CORS abierto, pensado para llamarse desde el navegador).
//
// PARA QUÉ EXISTE (Roberto, probando el flujo): "dice listo, ya sé dónde…
// pero no me está diciendo qué ciudad es la que está detectando". Sin el
// nombre, la persona no puede verificar que la detección es correcta — y un
// clima de la ciudad equivocada se ve idéntico a uno de la correcta.
//
// Fail-open como todo el clima: si falla, null, y la UI dice lo de siempre.
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string | null> {
  try {
    // A DOS DECIMALES (~1 km): para nombrar la ciudad no hace falta el punto
    // exacto, y las coordenadas crudas del GPS (precisión de metros) no tienen
    // por qué salir hacia un tercero. Mismo principio que la etiqueta del
    // wizard: "no importa el punto exacto, la uso de referencia".
    const la = lat.toFixed(2);
    const lo = lon.toFixed(2);
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=es`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    // city = la ciudad; locality puede ser la colonia (más chico). Para el
    // clima la ciudad es el nivel correcto — y el que la persona reconoce.
    const name = data?.city || data?.locality || data?.principalSubdivision;
    return typeof name === "string" && name.trim() ? name.trim() : null;
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

// EL CLIMA DE LAS HORAS EN QUE SE VA A USAR EL LOOK, no el de cuando lo pides.
//
// Val (usuaria): "aunque yo especifique que el outfit es para más tarde, la app
// toma en cuenta el clima actual y no el pronóstico de la hora objetivo".
// Tenía razón, y por los dos caminos:
//   · para HOY se pedía `current` — la temperatura de este segundo;
//   · para otro día, el promedio (máxima + mínima) / 2 del día ENTERO, que
//     incluye el mínimo de las 5am aunque nadie ande en la calle a esa hora.
// El wizard ya sabía que el look era de noche (`momento` viaja hasta el prompt,
// donde afina la formalidad) — el termómetro era el único que no se enteraba.
//
// Medido en Querétaro el 2026-08-31: 25.6° a las 14:00 contra 17.7° a las
// 21:00. Son DOS bandas de BUCKETS de distancia (Cálido "playera, a gusto" →
// Templado "manga larga ligera"), o sea que cambia la capa que sale.
//
// ES UNA VENTANA, NO UN INSTANTE — y esa es la decisión de stylist.
// La tentación era pedir "la hora del momento" (14:00, 21:00). Está mal para el
// día: te vistes UNA vez y andas fuera de la mañana a la tarde, así que
// vestirte para el pico de las 14:00 te deja con frío a las 9am. Tampoco sirve
// el promedio del día entero, que arrastra el mínimo de la madrugada. Lo que se
// promedia son LAS HORAS QUE VAS A TRAER LA ROPA PUESTA.
//
// Y si el look es para hoy, la ventana empieza AHORA: pedir algo "de día" a las
// 5pm promedia 17:00-19:00, no la mañana que ya pasaste vestido de otra cosa.
const VENTANA = {
  dia: { desde: 9, hasta: 19 },
  noche: { desde: 19, hasta: 23 },
} as const;

export type Momento = keyof typeof VENTANA;

export function esMomento(v: unknown): v is Momento {
  return v === "dia" || v === "noche";
}

/**
 * Clima de `fechaLocal` durante las horas de `momento`.
 *
 * `fechaLocal` es "YYYY-MM-DD" y se pide EXPLÍCITA a propósito: esta función la
 * llaman el navegador (hora local de la persona) y rutas que corren en UTC, y
 * en UTC a las 6pm de CDMX ya es mañana — la misma trampa que el wizard ya
 * documenta en su propio `fechaLocal`.
 *
 * Sin `momento` no hay ventana que pedir, así que cae al resumen del día.
 *
 * Fail-open como todo el clima: si las horas no vienen (fecha fuera del
 * horizonte de pronóstico, red caída) cae al resumen diario —que a su vez cae
 * al histórico— y de ahí a null. El clima nunca bloquea (spec E6).
 */
export async function getWeatherParaMomento(
  lat: number,
  lon: number,
  fechaLocal: string,
  momento: Momento | null
): Promise<Weather | null> {
  if (momento) {
    const v = VENTANA[momento];
    const porHora = await fetchHourlyWeather(lat, lon, fechaLocal, v.desde, v.hasta);
    if (porHora) return porHora;
  }
  return getWeatherForDates(lat, lon, fechaLocal, fechaLocal);
}

// Una sola llamada trae las horas Y el ahora. El `current` no es adorno: lo usa
// `pickWindow` para saber qué parte de la ventana ya pasó, y como último
// recurso cuando la ventana entera quedó atrás (un look "de día" pedido a las
// 11pm — rarísimo, pero el dato honesto ahí es el de este momento).
async function fetchHourlyWeather(
  lat: number,
  lon: number,
  fechaLocal: string,
  desde: number,
  hasta: number
): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,weather_code&current=temperature_2m,weather_code` +
      `&start_date=${fechaLocal}&end_date=${fechaLocal}&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return pickWindow(data, fechaLocal, desde, hasta);
  } catch {
    return null;
  }
}

// Separado del fetch para poder probarlo con respuestas literales de Open-Meteo
// sin red. Con `timezone=auto` los `time` vienen en hora LOCAL del punto
// ("2026-08-31T21:00"), que es justo la que la persona tiene en la cabeza.
export function pickWindow(
  data: unknown,
  fechaLocal: string,
  desde: number,
  hasta: number
): Weather | null {
  const d = (data ?? {}) as {
    hourly?: { time?: unknown; temperature_2m?: unknown; weather_code?: unknown };
    current?: { time?: unknown; temperature_2m?: unknown; weather_code?: unknown };
  };
  const times = Array.isArray(d.hourly?.time) ? d.hourly.time : [];
  const temps = Array.isArray(d.hourly?.temperature_2m) ? d.hourly.temperature_2m : [];
  const codes = Array.isArray(d.hourly?.weather_code) ? d.hourly.weather_code : [];

  // La hora del LUGAR, no la de quien pregunta: `current.time` viene en la
  // misma zona que `hourly.time` (timezone=auto). Solo recorta si la fecha
  // objetivo es hoy; para mañana no hay nada que ya haya pasado.
  const ahora = typeof d.current?.time === "string" ? d.current.time : null;
  const horaAhora =
    ahora && ahora.startsWith(fechaLocal) ? Number(ahora.slice(11, 13)) : null;
  const piso = Number.isFinite(horaAhora) ? Math.max(desde, horaAhora as number) : desde;

  const dentro: number[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (typeof t !== "string" || !t.startsWith(fechaLocal)) continue;
    const h = Number(t.slice(11, 13));
    if (h >= piso && h <= hasta) dentro.push(i);
  }

  const grados = dentro
    .map((i) => temps[i])
    .filter((t): t is number => typeof t === "number");
  const claves = dentro
    .map((i) => codes[i])
    .filter((c): c is number => typeof c === "number");

  if (grados.length > 0) {
    const temp_c = Math.round(grados.reduce((a, b) => a + b, 0) / grados.length);
    return { temp_c, condition: condicionDeLaVentana(claves) };
  }

  // Ventana vacía (ya pasó entera, o el pronóstico no la cubre): el ahora.
  const tempAhora = d.current?.temperature_2m;
  const codeAhora = d.current?.weather_code;
  if (typeof tempAhora === "number" && typeof codeAhora === "number") {
    return { temp_c: Math.round(tempAhora), condition: describe(codeAhora) };
  }
  return null;
}

// BASTA UNA HORA DE AGUA PARA MOJARSE. Aquí NO aplica la regla de mayoría de
// `aggregateDaily` —esa resume un viaje de varios días, donde una llovizna
// suelta no define el equipaje—: esto son las horas en que traes la ropa
// puesta, y si llueve en una sola necesitas la capa. La UI conserva la salida
// ("¿la lluvia te toca?" / "¿llevas paraguas?") para quien no le importe.
// Se queda con el código MÁS ALTO de los mojados para no degradar una tormenta
// a llovizna; sin agua, la mediana, como el resumen diario.
function condicionDeLaVentana(codes: number[]): string {
  if (codes.length === 0) return describe(0);
  // 51 hacia arriba es TODA la precipitación de la tabla WMO: llovizna (51-57),
  // lluvia (61-67), nieve (71-77), chubascos (80-86) y tormenta (95-99). El
  // tope de 86 que tenía esto dejaba fuera justo la tormenta, que es la peor.
  const mojado = codes.filter((c) => c >= 51);
  if (mojado.length > 0) return describe(Math.max(...mojado));
  return describe([...codes].sort((a, b) => a - b)[Math.floor(codes.length / 2)]);
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
