import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { looksForGender } from "@/lib/looks";
import { SwipeDeck } from "./swipe-deck";

export default async function GustosPage() {
  const profile = await requireStep(0);
  const looks = looksForGender(profile.gender ?? "hombre");

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={1} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          ¿Qué estilo te gusta?
        </h1>
        <p className="text-base text-muted">
          No pienses si lo tienes — desliza por puro gusto. ❤️ si te encanta, ✕
          si no es lo tuyo.
        </p>
      </div>

      <SwipeDeck looks={looks} />
    </section>
  );
}
