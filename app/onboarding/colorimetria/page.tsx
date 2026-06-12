import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { Quiz } from "./quiz";

export default async function ColorimetriaPage() {
  await requireStep(2);

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={3} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          Hablemos de tus colores
        </h1>
        <p className="text-base text-muted">
          Seis preguntas rápidas — sin selfie, sin drama.
        </p>
      </div>

      <Quiz />
    </section>
  );
}
