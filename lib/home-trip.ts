import type { SupabaseClient } from "@supabase/supabase-js";
import {
  capsuleRows,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleTarget,
} from "@/lib/capsule";
import { diasHasta, VENTANA_VIAJE_DIAS } from "@/lib/trip-context";

// La card de viaje del home (rediseño 2026-08-11, handoff design_handoff_inicio).
// Sustituye a la card contextual de tres variantes (lib/home-card.ts, borrado):
// "sin estrenar" murió (casi toda prenda calificaba porque el registro de uso
// está seco) y "¿te lo pusiste ayer?" se volvió la invitación al fit check en el
// look. El viaje es lo ÚNICO contextual que queda — y solo a ≤7 días, porque un
// viaje a dos meses no es contexto de hoy.
export type HomeTrip = {
  lugar: string;
  /** Días según la fecha UTC del server. El CLIENTE lo recalcula con la suya:
   *  a las 18:00 de CDMX aquí ya es mañana, y este número se enseña como prosa
   *  ("en curso", "consíguelos hoy"), no como un badge. Ver HomeTripCard. */
  dias: number; // 0 = ya empezó
  href: string; // detalle si ya hay maleta; la lista si aún no
  maletaLista: boolean; // ya se generó y cruzó la maleta (capsule_match)
  faltan: number; // artículos de la maleta aún sin cubrir (0 sin maleta)
  fechaInicio: string; // YYYY-MM-DD — "consíguelos antes del jueves"
  /** playa/ciudad/trabajo/noche — el fallback de la foto cuando el nombre del
   *  lugar no está en el set (ver lib/destino-imagen). */
  ocasiones: string[];
};

// Los faltantes que la card anuncia, con LA MISMA regla que el detalle del
// viaje: `falta` y aún sin empacar (components/trip-result.tsx usa exactamente
// `eff(r) === "falta" && !isPacked(r.index)`). Si la card dijera un número y el
// detalle otro, el tap se sentiría como un cebo.
//
// Los sustitutos del clóset NO necesitan cláusula propia aunque lo parezca:
// setTripSubstitute ya marca `empacado[i] = true` al elegir uno, así que caen
// por la misma vía. Excluirlos aparte —como hacía la primera versión— sí
// cambiaba el número: al DESmarcar el empacado (togglePacked existe en el
// detalle) el detalle volvía a listar la prenda y la card seguía sin contarla.
export function contarFaltantesMaleta(
  target: CapsuleTarget | null,
  match: CapsuleMatch | null,
  overrides: CapsuleOverrides | null,
  empacado: Record<string, boolean> | null
): number {
  if (!target || !match) return 0;
  return capsuleRows(target, match, overrides).filter(
    (r) => !r.dismissed && r.effective === "falta" && !empacado?.[String(r.index)]
  ).length;
}

export async function loadHomeTrip(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeTrip | null> {
  const hoy = new Date().toISOString().slice(0, 10);
  // UN DÍA DE COLCHÓN en los dos bordes, porque este `hoy` es UTC y el de la
  // persona no: sin el colchón, a las 18:00 de CDMX el viaje que termina hoy ya
  // se cayó de la consulta (la card desaparece la última tarde del viaje) y el
  // que empieza en 8 días todavía no entra. El recorte fino lo hace el cliente
  // con SU fecha (HomeTripCard).
  const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  // Misma ventana y criterio que lib/trip-context (el badge de "Más"): si el
  // botón avisa de un viaje, la card del home tiene que hablar del mismo.
  const { data } = await supabase
    .from("trips")
    .select(
      "id, lugar, fecha_inicio, fecha_fin, ocasiones, capsule_target, capsule_match, overrides, empacado"
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("fecha_fin", ayer)
    .order("fecha_inicio", { ascending: true })
    .limit(1);

  const trip = data?.[0];
  if (!trip) return null;

  const dias = diasHasta(trip.fecha_inicio as string, hoy);
  if (dias > VENTANA_VIAJE_DIAS + 1) return null;

  const match = (trip.capsule_match as CapsuleMatch | null) ?? null;
  return {
    lugar: trip.lugar as string,
    dias: Math.max(0, dias),
    href: match ? `/viaje/${trip.id}` : "/viaje/lista",
    maletaLista: !!match,
    faltan: contarFaltantesMaleta(
      (trip.capsule_target as CapsuleTarget | null) ?? null,
      match,
      (trip.overrides as CapsuleOverrides | null) ?? null,
      (trip.empacado as Record<string, boolean> | null) ?? null
    ),
    fechaInicio: trip.fecha_inicio as string,
    ocasiones: ((trip.ocasiones as string[] | null) ?? []).filter(
      (o): o is string => typeof o === "string"
    ),
  };
}
