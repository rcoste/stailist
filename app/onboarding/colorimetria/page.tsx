import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { Quiz } from "./quiz";

export default async function ColorimetriaPage() {
  await requireStep(1);

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={2} />

      <h1 className="text-display font-semibold tracking-[-0.025em] text-ink">
        Hablemos de tus colores
      </h1>

      {/* Colorimetría = quiz sin cámara (4 estaciones). El análisis por selfie
          quedó fuera del MVP, así que ya no se ofrece la elección. El lead y la
          demostración viven en la intro (quiz.tsx): son del paso de venta, no
          del de responder preguntas. */}
      <Quiz />
    </section>
  );
}
