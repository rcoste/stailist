import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routeForStep } from "@/lib/onboarding";
import { Landing } from "@/components/landing/landing";

// "/" tiene doble cara:
//  - Deslogueada → la landing pública (marketing + captura de correo a la waitlist).
//  - Logueada → el router del journey: sin género → a elegirlo; onboarding
//    incompleto → tu paso pendiente; completo → Hoy. Así el magic link y el
//    ícono de la PWA siempre aciertan.
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <Landing />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender, onboarding_step")
    .eq("id", user.id)
    .single();

  // Sesión sin profile (caso borde): que login lo resuelva.
  if (!profile) redirect("/login");
  if (!profile.gender) redirect("/onboarding/genero");
  redirect(routeForStep(profile.onboarding_step));
}
