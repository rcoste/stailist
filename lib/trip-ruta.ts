import { geocodePlace, getWeatherForDates } from "@/lib/weather";
import type { Parada, TripWeather } from "@/lib/trip";

// La ruta de un viaje, resuelta: geocoding + clima por parada. Compartido por
// POST /api/trip (crear/rehacer) y PATCH /api/trip/[id]/ruta (editar ruta y
// fechas SIN rehacer la maleta) — nació al partirse en dos rutas para el menú
// "editar ruta y fechas" del handoff viaje 2.

export const TRIP_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_PARADAS = 6;
export const MAX_TRIP_DAYS = 30;
// Un nombre de lugar no capado se persiste verbatim cuando el geocoder falla
// (multi-MB posibles) — mismo espíritu que el tope de 200 del `contexto`.
export const MAX_NOMBRE_LUGAR = 80;

/** Normaliza la ruta cruda del body EN PARES lugar+noches.
 *
 *  Por qué pares y no dos listas: deduplicar o recortar los lugares por
 *  separado desalineaba `segmentos` por índice y el guard de longitud tiraba
 *  TODAS las noches en silencio (red team del ship). Y el dedupe es solo de
 *  ADYACENTES: una ruta redonda "Tokio → Kioto → Tokio" es legítima — el Set
 *  global la colapsaba. */
export function normalizarRuta(
  lugaresRaw: unknown,
  segmentosRaw: unknown
): { lugares: string[]; segNoches: (number | null)[] | null } {
  const lugares = Array.isArray(lugaresRaw) ? lugaresRaw : [];
  const segs =
    Array.isArray(segmentosRaw) && segmentosRaw.length === lugares.length
      ? (segmentosRaw as { noches?: unknown }[])
      : null;
  const pares: { lugar: string; noches: number | null }[] = [];
  for (let i = 0; i < lugares.length; i++) {
    const lugar = String(lugares[i] ?? "").trim().slice(0, MAX_NOMBRE_LUGAR);
    if (lugar.length <= 1) continue;
    if (pares.length > 0 && pares[pares.length - 1].lugar === lugar) continue;
    const n = segs?.[i]?.noches;
    // Tope por parada: un cliente con bugs no persiste noches absurdas que
    // luego alimenten el prompt del motor en un rebuild.
    const noches =
      typeof n === "number" && Number.isInteger(n) && n > 0 && n <= MAX_TRIP_DAYS ? n : null;
    pares.push({ lugar, noches });
  }
  const top = pares.slice(0, MAX_PARADAS);
  return {
    lugares: top.map((p) => p.lugar),
    segNoches: segs ? top.map((p) => p.noches) : null,
  };
}

/** Geocodifica cada parada y resuelve su clima en el rango (en paralelo).
 *  Una parada que no geocodifica conserva su nombre, sin clima.
 *
 *  `previas`: paradas ya resueltas del viaje (el PATCH de editar ruta las
 *  pasa). Si el nombre no cambió se REUSAN label/lat/lon — no se re-geocodifica
 *  lo ya resuelto, y un timeout transitorio de Open-Meteo ya no pisa
 *  coordenadas buenas con null. El clima SIEMPRE se resuelve de nuevo: las
 *  fechas pudieron cambiar. */
export async function resolverParadas(
  lugaresNombres: string[],
  segNoches: (number | null)[] | null,
  fechaInicio: string,
  fechaFin: string,
  previas: Parada[] = []
): Promise<Parada[]> {
  return Promise.all(
    lugaresNombres.map(async (nombre, i) => {
      const noches = segNoches && segNoches[i] ? { noches: segNoches[i] as number } : {};
      const previa = previas.find((p) => p.lugar === nombre);
      if (previa && previa.lat != null && previa.lon != null) {
        // Si Open-Meteo parpadea (timeout → null), se conserva el clima previo:
        // uno aproximado de fechas viejas informa más que un header sin clima.
        const weather =
          (await getWeatherForDates(previa.lat, previa.lon, fechaInicio, fechaFin)) ??
          previa.weather ??
          null;
        return { lugar: previa.lugar, lat: previa.lat, lon: previa.lon, ...noches, weather };
      }
      const geo = await geocodePlace(nombre);
      const weather = geo
        ? await getWeatherForDates(geo.lat, geo.lon, fechaInicio, fechaFin)
        : null;
      return {
        lugar: geo?.label ?? nombre,
        lat: geo?.lat ?? null,
        lon: geo?.lon ?? null,
        ...noches,
        weather,
      };
    })
  );
}

// Agrega los climas de las paradas a un resumen único (para el header del viaje):
// temperatura promedio; precipitación SOLO si domina (más de la mitad de las
// ciudades), distinguiendo nieve de lluvia; estimado si alguna parada lo es.
export function aggregateWeather(paradas: Parada[]): TripWeather | null {
  const withW = paradas.filter((p) => p.weather);
  if (withW.length === 0) return null;
  const avg = Math.round(
    withW.reduce((s, p) => s + (p.weather as TripWeather).temp_c, 0) / withW.length
  );
  const conds = withW.map((p) => (p.weather as TripWeather).condition);
  const snowN = conds.filter((c) => /nieve/.test(c)).length;
  const rainN = conds.filter((c) => /lluvia|tormenta|chubasco|llovizna/.test(c)).length;
  const estimated = withW.some((p) => (p.weather as TripWeather).estimated);
  // Solo precipitación dominante (mayoría de ciudades) marca el viaje.
  const condition =
    snowN + rainN > withW.length / 2 ? (snowN >= rainN ? "nieve" : "lluvia") : conds[0];
  return {
    temp_c: avg,
    condition,
    ...(estimated ? { estimated: true } : {}),
  };
}

/** "Tokio · Kioto · Osaka" — el `lugar` denormalizado que guarda trips. */
export function lugarDisplay(paradas: Parada[]): string {
  return paradas.map((p) => p.lugar.split(",")[0].trim()).join(" · ");
}
