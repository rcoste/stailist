import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { routeForStep } from "@/lib/onboarding";

// "/" es el router del journey: onboarding incompleto → tu paso pendiente;
// completo → Hoy. Así el magic link y el ícono de la PWA siempre aciertan.
export default async function RootPage() {
  const profile = await getProfile();
  redirect(routeForStep(profile.onboarding_step));
}
