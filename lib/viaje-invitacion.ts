import { randomBytes } from "node:crypto";
import type { Occasion, TripWeather } from "@/lib/trip";

// INVITAR A UN VIAJE (2026-10-16): la lógica pura. Quien ya armó su viaje
// manda /v/<token>; la otra persona entra con la ruta, las fechas y las
// actividades puestas y arma SU maleta (migración 0176). Lo que viaja en el
// link es SÓLO la ruta: nunca la maleta, los looks ni el texto libre.

/** Cookie que recuerda la invitación mientras alguien nuevo hace su onboarding. */
export const COOKIE_INVITACION = "st_viaje_inv";
export const INVITACION_MAX_AGE_S = 60 * 60 * 24 * 30;

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{12}$/;

/** 9 bytes al azar → 12 caracteres de URL. Inadivinable a fuerza bruta. */
export function tokenNuevo(): string {
  return randomBytes(9).toString("base64url");
}

/** Antes de ir a la base: un token con otra forma no puede existir. */
export function tokenValido(t: unknown): t is string {
  return typeof t === "string" && FORMATO_TOKEN.test(t);
}

export type ParadaInvitacion = { lugar: string; noches: number; weather: TripWeather | null };

export type ViajeInvitacion = {
  lugar: string;
  paradas: ParadaInvitacion[];
  fechaInicio: string;
  fechaFin: string;
  ocasiones: Occasion[];
};

/** Lo que devuelve la función `viaje_por_invitacion`, ya con forma confiable. */
export function leerInvitacion(r: unknown): ViajeInvitacion | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.lugar !== "string" || typeof o.fecha_inicio !== "string" || typeof o.fecha_fin !== "string") return null;
  const paradas = (Array.isArray(o.paradas) ? o.paradas : [])
    .map((p) => p as { lugar?: unknown; noches?: unknown; weather?: unknown })
    .filter((p) => typeof p.lugar === "string" && p.lugar.trim())
    .map((p) => ({
      lugar: String(p.lugar),
      noches: typeof p.noches === "number" && p.noches >= 1 ? Math.round(p.noches) : 0,
      weather: p.weather && typeof p.weather === "object" ? (p.weather as TripWeather) : null,
    }));
  // Viajes viejos (modo fechas, sin noches por parada): el rango completo a la
  // única parada, o parejo con el sobrante en la primera. Mismo reparto que
  // "editar ruta y fechas" (app/viaje/page.tsx).
  if (paradas.length > 0 && paradas.some((p) => p.noches === 0)) {
    const total = Math.max(1, diasEntre(o.fecha_inicio, o.fecha_fin));
    const base = Math.max(1, Math.floor(total / paradas.length));
    const sobra = Math.max(0, total - base * paradas.length);
    paradas.forEach((p, i) => (p.noches = base + (i === 0 ? sobra : 0)));
  }
  return {
    lugar: o.lugar,
    paradas: paradas.length > 0 ? paradas : [{ lugar: o.lugar, noches: Math.max(1, diasEntre(o.fecha_inicio, o.fecha_fin)), weather: null }],
    fechaInicio: o.fecha_inicio,
    fechaFin: o.fecha_fin,
    ocasiones: Array.isArray(o.ocasiones) ? (o.ocasiones.filter((x) => typeof x === "string") as Occasion[]) : [],
  };
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Un viaje que ya terminó no se ofrece: armar la maleta de algo pasado no sirve. */
export function yaPaso(v: Pick<ViajeInvitacion, "fechaFin">, hoy: string): boolean {
  return v.fechaFin < hoy;
}

/** "1 persona ya armó su maleta" / "3 personas…": lo que ve quien invitó. */
export function textoUnidos(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "1 persona ya armó su maleta con tu viaje" : `${n} personas ya armaron su maleta con tu viaje`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dm = (d: string) => `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]}`;

/**
 * La vista previa del link en WhatsApp (og:title / og:description). Es lo
 * primero que ve quien recibe la invitación, antes de abrir nada: sin esto
 * heredaba la de la landing ("tu stylist personal con IA") y no decía que era
 * un viaje. QA 2026-10-16.
 */
export function vistaPreviaDeInvitacion(v: ViajeInvitacion | null): { titulo: string; descripcion: string } {
  if (!v) return { titulo: "te invitaron a un viaje · stailist", descripcion: "arma tu maleta con tu propia ropa." };
  const destino = v.paradas.map((p) => p.lugar.split(",")[0].trim()).filter((x, i, a) => a.indexOf(x) === i).join(" · ");
  return {
    titulo: `te invitaron a un viaje a ${destino}`,
    descripcion: `${dm(v.fechaInicio)} – ${dm(v.fechaFin)}. arma tu maleta con tu propia ropa: la ruta y las fechas ya están puestas.`,
  };
}
