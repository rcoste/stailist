import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { looksForGender } from "@/lib/looks";
import { SwipeDeck } from "./swipe-deck";

export default async function GustosPage() {
  const profile = await requireStep(1);
  const looks = looksForGender(profile.gender ?? "hombre");

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={2} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          ¿Cuál va contigo?
        </h1>
        <p className="text-base text-muted">
          Desliza o usa los botones — ❤️ si te lo pondrías, ✕ si ni de chiste.
        </p>
      </div>

      <SwipeDeck looks={looks} />
    </section>
  );
}
