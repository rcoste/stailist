import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { routeForStep } from "@/lib/onboarding";

// "/" es el router del journey: sin género → a elegirlo; onboarding
// incompleto → tu paso pendiente; completo → Hoy. Así el magic link y el
// ícono de la PWA siempre aciertan.
export default async function RootPage() {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");
  redirect(routeForStep(profile.onboarding_step));
}
