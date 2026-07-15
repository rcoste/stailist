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
  { value: "mochila", label: "Mochila o bolsa", short: "mochila", hint: "lo mínimo", maxPiezas: 7 },
  { value: "mano", label: "Equipaje de mano", short: "carry-on", hint: "carry-on", maxPiezas: 11 },
  { value: "documentada", label: "Documentada", short: "maleta", hint: "con espacio", maxPiezas: 16 },
] as const;
export type Luggage = (typeof LUGGAGE)[number]["value"];

// Multi-maleta (modelo aerolínea): cuántas piezas de equipaje de cada tipo lleva
// — puedes combinar mochila + carry-on + N documentadas. La capacidad total
// (techo de prendas) es la SUMA de (cantidad × maxPiezas) de cada tipo.
export type Bolsas = Partial<Record<Luggage, number>>;

// Normaliza el equipaje a un mapa de cantidades: usa `bolsas` si trae algo; si no,
// deriva del `maleta` legacy (1 de ese tipo); null si no hay nada.
export function normalizeBolsas(
  bolsas: Bolsas | null | undefined,
  maleta?: Luggage | null
): Bolsas | null {
  if (bolsas && LUGGAGE.some((l) => (bolsas[l.value] ?? 0) > 0)) return bolsas;
  if (maleta) return { [maleta]: 1 };
  return null;
}

// Techo total de prendas = suma de (cantidad × maxPiezas) por tipo de bolsa.
export function luggageCapacity(
  bolsas: Bolsas | null | undefined,
  maleta?: Luggage | null
): number {
  const b = normalizeBolsas(bolsas, maleta);
  if (!b) return 0;
  return LUGGAGE.reduce((sum, l) => sum + (b[l.value] ?? 0) * l.maxPiezas, 0);
}

// Total de piezas de equipaje (cuántas bolsas en total).
export function bolsasCount(bolsas: Bolsas | null | undefined): number {
  if (!bolsas) return 0;
  return LUGGAGE.reduce((s, l) => s + (bolsas[l.value] ?? 0), 0);
}

// Resumen legible para UI: "1 carry-on · 2 maletas". Vacío si no hay equipaje.
export function luggageSummary(
  bolsas: Bolsas | null | undefined,
  maleta?: Luggage | null
): string {
  const b = normalizeBolsas(bolsas, maleta);
  if (!b) return "";
  return LUGGAGE.filter((l) => (b[l.value] ?? 0) > 0)
    .map((l) => {
      const n = b[l.value] ?? 0;
      return `${n} ${l.short}${n > 1 ? "s" : ""}`;
    })
    .join(" · ");
}

// La bolsa "dominante" (la de mayor capacidad presente) — para back-compat con el
// campo `maleta` (texto) y con lecturas legacy. null si no hay ninguna.
export function dominantLuggage(bolsas: Bolsas | null | undefined): Luggage | null {
  const present = LUGGAGE.filter((l) => (bolsas?.[l.value] ?? 0) > 0);
  if (present.length === 0) return null;
  return present.reduce((a, b) => (b.maxPiezas > a.maxPiezas ? b : a)).value;
}

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
  maleta: Luggage | null; // legacy: la bolsa dominante (back-compat); ver `bolsas`
  bolsas: Bolsas | null; // multi-maleta: cantidades por tipo
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
  downReason?: string | null; // por qué no le gustó (tras 👎) — señal para afinar
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

// "La lógica de esta maleta": una línea cálida armada con los DATOS del viaje
// (piezas, días, ocasiones, clima) — sin IA, así que existe también para viajes
// ya generados. Responde el "¿por qué me propones esto?" antes de la lista.
export function tripLogicLine(
  days: number,
  nPrendas: number,
  ocasiones: Occasion[],
  weather: TripWeather | null
): string {
  if (nPrendas <= 0) return "";
  const ocas = occasionLabels(ocasiones);
  let s = `${nPrendas} piezas para ${days} ${days === 1 ? "día" : "días"}, elegidas para mezclarse entre sí`;
  if (ocas) s += ` y cubrir ${ocas}`;
  if (weather) {
    if (/lluv|torment|chubasc/i.test(weather.condition ?? "")) {
      s += " — con una capa lista para la lluvia";
    } else if (weather.temp_c <= 12) {
      s += " — en capas para el frío";
    } else if (weather.temp_c >= 26) {
      s += " — todo ligero para el calor";
    }
  }
  return s + ".";
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
