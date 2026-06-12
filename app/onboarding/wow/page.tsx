import { OnboardingProgress } from "@/components/onboarding-progress";
import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { routeForStep } from "@/lib/onboarding";
import { WowClient } from "./wow-client";

// El momento wow: 2-3 outfits generados con tu clóset, tus gustos y tu paleta.
// Acepta step 4 (recién terminó checklist) Y step 5 (la generación lo cerró
// mientras seguía en esta pantalla votando) — un reload no debe expulsarla
// a /hoy a media votación, pero pasos anteriores sí redirigen.
export default async function WowPage() {
  const profile = await getProfile();
  if (profile.onboarding_step < 4) {
    redirect(routeForStep(profile.onboarding_step));
  }

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={5} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          Tus primeros looks
        </h1>
        <p className="text-base text-muted">
          Armados con tu clóset, tus gustos y tus colores.
        </p>
      </div>

      <WowClient />
    </section>
  );
}
