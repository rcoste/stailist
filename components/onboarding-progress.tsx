// Indicador de progreso del onboarding: 5 segmentos hairline, los completados
// en burdeos. Discreto a propósito — el protagonista es la pregunta, no el meter.
export function OnboardingProgress({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div
      className="flex gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={step}
      aria-label={`Paso ${step} de 5`}
    >
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={`h-1 flex-1 rounded-full ${
            s <= step ? "bg-accent" : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}
