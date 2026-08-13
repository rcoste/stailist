import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadClosetPicks } from "@/lib/closet-picks";
import { tripDays, type Bolsas, type Occasion, type Parada } from "@/lib/trip";
import { TripWizard, type TripEditInit } from "@/components/trip-wizard";

export const maxDuration = 60;

// Raíz de Modo viaje = el wizard de 3 pasos (overlay full-screen). "Tus viajes"
// vive en /viaje/lista. El clóset alimenta el picker de anclas del paso 2
// ("¿algo que quieras llevar sí o sí?"), con las queridas primero.
//
// ?edit=<tripId> (menú "···" del detalle): el wizard abre pre-llenado con la
// ruta del viaje, solo paso 1, y al guardar ofrece rehacer la maleta o solo
// guardar ruta y fechas.
export default async function ViajePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit: editId } = await searchParams;
  const profile = await requireOnboarded();
  const supabase = await createClient();
  const closet = await loadClosetPicks(supabase, profile.id);

  let edit: TripEditInit | null = null;
  if (editId) {
    const { data: trip } = await supabase
      .from("trips")
      .select("id, paradas, fecha_inicio, fecha_fin, ocasiones, bolsas, maleta, contexto")
      .eq("id", editId)
      .eq("user_id", profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!trip) notFound();
    const paradas = Array.isArray(trip.paradas) ? (trip.paradas as Parada[]) : [];
    // Noches por parada para el paso 1. Viajes viejos (modo fechas, sin
    // `noches`) reparten las noches del rango: todas a la única parada, o
    // parejo con el sobrante en la primera.
    const noches = Math.max(1, tripDays(trip.fecha_inicio, trip.fecha_fin) - 1);
    const base = Math.max(1, Math.floor(noches / Math.max(1, paradas.length)));
    const sobra = Math.max(0, noches - base * paradas.length);
    edit = {
      tripId: trip.id as string,
      paradas: paradas.map((p, i) => ({
        lugar: p.lugar,
        noches: p.noches ?? base + (i === 0 ? sobra : 0),
      })),
      inicio: trip.fecha_inicio as string,
      ocasiones: (trip.ocasiones as Occasion[]) ?? [],
      // Viajes de antes de multi-maleta traen bolsas null y solo `maleta`
      // (texto): sin este fallback, rehacer desde editar degradaba en
      // silencio una documentada a carry-on (mismo fallback que el server).
      bolsas:
        (trip.bolsas as Bolsas | null) ??
        (trip.maleta ? ({ [trip.maleta as string]: 1 } as Bolsas) : null),
      contexto: (trip.contexto as string | null) ?? null,
    };
  }

  return <TripWizard closet={closet} edit={edit} />;
}
