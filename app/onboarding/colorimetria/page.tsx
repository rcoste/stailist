import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { Quiz } from "./quiz";

export default async function ColorimetriaPage() {
  await requireStep(1);

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={2} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          Hablemos de tus colores
        </h1>
        <p className="text-base text-muted">
          Para que cada look te favorezca de verdad.
        </p>
      </div>

      {/* Colorimetría = quiz sin cámara (4 estaciones). El análisis por selfie
          quedó fuera del MVP, así que ya no se ofrece la elección. */}
      <Quiz />
    </section>
  );
}
