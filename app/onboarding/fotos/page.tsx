import { redirect } from "next/navigation";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { esVarianteFotos } from "@/lib/onboarding-variante";
import { FotosClient } from "./fotos-client";

// LAS 3 FOTOS, EN VEZ DE LA LISTA DE BÁSICOS (variante 'fotos' de la prueba
// A/B, lib/onboarding-variante.ts y migración 0172). Es el paso 2 del
// onboarding para la mitad de la gente: el primer look se arma con SU ropa.
//
// Pide correo porque el carrete guarda fotos y llama a la IA, y las dos cosas
// están cerradas a los borradores (lib/cuotas.ts, Storage): un borrador que
// llegue aquí va al correo y vuelve. Quien cayó en la lista de siempre no
// tiene nada que hacer aquí.
export default async function FotosOnboardingPage() {
  const profile = await requireStep(2);
  if (!esVarianteFotos(profile.onboarding_variante)) redirect("/onboarding/closet");
  if (!profile.email) redirect("/onboarding/correo");

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={3} />
      <FotosClient userId={profile.id} />
    </section>
  );
}
