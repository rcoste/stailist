import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { ObjetivoPicker } from "./objetivo-picker";

// Objetivo del momento — va casi al final (paso 4 de 5), justo antes de generar,
// para que la petición quede fresca. (El diseño lo dibuja como "paso 1" pero el
// orden de navegación se mantiene; ver lib/onboarding.ts.)
export default async function ObjetivoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStep(3);
  const { error } = await searchParams;

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={4} />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          paso 4 de 5
        </p>
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          ¿qué necesitas{" "}
          <em className="font-display font-normal italic tracking-normal">hoy</em>?
        </h1>
      </div>

      {error === "guardar" && (
        <p className="text-sm text-error">
          No pude guardar tu elección — inténtalo otra vez.
        </p>
      )}

      <ObjetivoPicker />
    </section>
  );
}
