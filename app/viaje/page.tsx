import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadClosetPicks } from "@/lib/closet-picks";
import { TripWizard } from "@/components/trip-wizard";

export const maxDuration = 60;

// Raíz de Modo viaje = el wizard de 3 pasos (overlay full-screen). "Tus viajes"
// vive en /viaje/lista. El clóset alimenta el picker de anclas del paso 2
// ("¿algo que quieras llevar sí o sí?"), con las queridas primero.
export default async function ViajePage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();
  const closet = await loadClosetPicks(supabase, profile.id);
  return <TripWizard closet={closet} />;
}
