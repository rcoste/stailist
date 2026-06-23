import { requireOnboarded } from "@/lib/auth";
import { TripWizard } from "@/components/trip-wizard";

export const maxDuration = 60;

// Raíz de Modo viaje = el wizard de 4 pasos (overlay full-screen). "Tus viajes"
// vive en /viaje/lista.
export default async function ViajePage() {
  await requireOnboarded();
  return <TripWizard />;
}
