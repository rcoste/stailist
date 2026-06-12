import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { saveObjective } from "./actions";
import { OBJECTIVES, type Objective } from "./objectives";

const DESCRIPTIONS: Record<Objective, string> = {
  diario: "Looks para tu rutina, sin pensarle tanto",
  oficina: "Verte pro aunque el día esté pesado",
  evento: "Boda, cena, algo que importa",
  viaje: "Vestir bien con lo que cabe en la maleta",
  refrescar: "Salir del mismo look de siempre",
};

export default async function ObjetivoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStep(0);
  const { error } = await searchParams;

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={1} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          ¿Qué necesitas hoy?
        </h1>
        <p className="text-base text-muted">
          Empecemos por lo que te trae aquí.
        </p>
      </div>

      {error === "guardar" && (
        <p className="text-sm text-error">
          No pude guardar tu elección — inténtalo otra vez.
        </p>
      )}

      <form action={saveObjective} className="flex flex-col gap-3">
        {(Object.keys(OBJECTIVES) as Objective[]).map((key) => (
          <button
            key={key}
            type="submit"
            name="objective"
            value={key}
            className="flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-2xl border border-line bg-surface px-5 py-3 text-left transition-colors duration-200 hover:border-accent focus-visible:border-accent focus-visible:outline-none"
          >
            <span className="text-base font-medium text-ink">
              {OBJECTIVES[key]}
            </span>
            <span className="text-sm text-muted">{DESCRIPTIONS[key]}</span>
          </button>
        ))}
      </form>
    </section>
  );
}
