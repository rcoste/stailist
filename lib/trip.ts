// Modo viaje (v1) — dominio puro (sin IA ni DB; seguro para cliente). Reusa el
// modelo de cápsula: la cápsula ideal del viaje (CapsuleTarget) se cruza con tu
// clóset (matchCapsule) → "empaca esto" + "te falta".
import type {
  CapsuleMatch,
  CapsuleOverrides,
  CapsuleTarget,
} from "@/lib/capsule";

export const OCCASIONS = [
  { value: "playa", label: "Playa o piscina" },
  { value: "ciudad", label: "Ciudad y pasear" },
  { value: "trabajo", label: "Trabajo o formal" },
  { value: "noche", label: "Salir de noche" },
  { value: "aire", label: "Aire libre" },
] as const;
export type Occasion = (typeof OCCASIONS)[number]["value"];

// El tamaño de maleta es un TECHO, no una meta: la cápsula se dimensiona al
// viaje (días × ocasiones × clima) y la maleta la recorta solo si se pasaría.
export const LUGGAGE = [
  { value: "mochila", label: "Mochila o bolsa", hint: "lo mínimo", maxPiezas: 7 },
  { value: "mano", label: "Equipaje de mano", hint: "carry-on", maxPiezas: 11 },
  { value: "documentada", label: "Documentada", hint: "con espacio", maxPiezas: 16 },
] as const;
export type Luggage = (typeof LUGGAGE)[number]["value"];

export type TripWeather = { temp_c: number; condition: string; estimated?: boolean };

// Una parada del viaje (multidestino). `noches` solo aparece en el modo "por
// lugar"; las fechas por parada se derivan del rango + noches. `weather` es el
// clima resuelto en esa parada (para que el motor empaque para el rango).
export type Parada = {
  lugar: string;
  lat?: number | null;
  lon?: number | null;
  noches?: number;
  weather?: TripWeather | null;
};

export type Trip = {
  id: string;
  lugar: string;
  paradas: Parada[] | null;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string;
  ocasiones: Occasion[];
  maleta: Luggage | null;
  weather: TripWeather | null;
  capsule_target: CapsuleTarget | null;
  capsule_match: CapsuleMatch | null;
  overrides: CapsuleOverrides | null;
  empacado: Record<string, boolean>;
  outfits: TripOutfit[] | null;
};

// Un look del viaje: prendas concretas (por NOMBRE de prenda del clóset, ya
// denormalizado al guardar) que combinan para una ocasión. Armado solo con lo
// que de verdad empacas. La página resuelve cada nombre a su imagen.
export type TripOutfit = {
  ocasion: Occasion;
  titulo: string; // "Cena junto al mar"
  porque: string; // una línea cálida de por qué funciona
  tip?: string | null; // "el toque" — cómo llevarlo (opcional)
  prendas: string[]; // nombres de prendas del clóset (lo empacable)
  voto?: "up" | "down" | null; // 👍/👎 del usuario sobre el look (se regenera con ellos)
};

// Días del viaje (inclusivo). Fechas en YYYY-MM-DD, comparadas en UTC.
export function tripDays(inicio: string, fin: string): number {
  const a = new Date(inicio + "T00:00:00Z").getTime();
  const b = new Date(fin + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export function occasionLabels(values: Occasion[]): string {
  const set = new Set(values);
  return OCCASIONS.filter((o) => set.has(o.value))
    .map((o) => o.label.toLowerCase())
    .join(", ");
}

export function luggageMeta(maleta: Luggage | null) {
  return LUGGAGE.find((l) => l.value === maleta) ?? null;
}

// Noches del viaje = días − 1 (un viaje de 8 días tiene 7 noches).
export function tripNights(inicio: string, fin: string): number {
  return Math.max(0, tripDays(inicio, fin) - 1);
}

// Reparte `total` noches entre `count` paradas lo más parejo posible; el sobrante
// va a las primeras. Ej: 7 noches, 3 paradas → [3, 2, 2]. Es el default del modo
// "por lugar" antes de que el usuario ajuste los steppers.
export function splitNights(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

// Deriva las fechas (YYYY-MM-DD) de cada parada desde el inicio del viaje y las
// noches por parada: la parada i ocupa `noches[i]` días consecutivos. Aproximado
// (sirve para afinar clima/cantidades por parada, no es un itinerario exacto).
export function paradaRanges(
  inicio: string,
  noches: number[]
): { inicio: string; fin: string }[] {
  const out: { inicio: string; fin: string }[] = [];
  const cursor = new Date(inicio + "T00:00:00Z");
  if (!Number.isFinite(cursor.getTime())) return out;
  for (const n of noches) {
    const start = cursor.toISOString().slice(0, 10);
    const dias = Math.max(1, n);
    cursor.setUTCDate(cursor.getUTCDate() + (dias - 1));
    out.push({ inicio: start, fin: cursor.toISOString().slice(0, 10) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
