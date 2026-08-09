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

      {/* La cabecera se le PASA al deck en vez de pintarse aquí: tiene que
          desaparecer cuando el deck cede el turno a los pares de corte, que
          traen la suya. Pintándola aquí salían dos títulos apilados. */}
      <SwipeDeck
        looks={looks}
        calibracion
        gender={profile.gender ?? "hombre"}
        cabecera={
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              paso 1 de 5
            </p>
            <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
              ¿te gusta o{" "}
              <em className="font-display font-normal italic tracking-normal">no</em>?
            </h1>
          </div>
        }
      />
    </section>
  );
}
