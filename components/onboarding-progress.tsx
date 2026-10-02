// Indicador de progreso del onboarding: 5 segmentos hairline, los completados
// en tinta (`bg-accent`, paleta v3). Discreto a propósito — el protagonista es la pregunta, no el meter.
export function OnboardingProgress({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div
      // En escritorio la barra mide lo mismo en TODOS los pasos (la columna de
      // pregunta), aunque la pantalla use el ancho completo: una barra que se
      // estira y se encoge entre pasos se lee como otra cosa.
      className="flex gap-2 lg:mx-auto lg:w-full lg:max-w-md"
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
