import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { CapsulaForm } from "@/app/closet/capsula/capsula-form";
import type { LifestyleAnswers } from "@/lib/capsule";

// La acción saveLifestyle (2 llamadas a Opus, ~27s) se dispara desde esta página,
// así que aquí va el presupuesto de 60s de Vercel.
export const maxDuration = 60;

export default async function EditarCapsulaPage() {
  const profile = await requireOnboarded();
  const initial = (profile.lifestyle as LifestyleAnswers | null) ?? {};

  // Sin tab bar: el cuestionario tiene su propia barra de acción fija (Atrás /
  // Siguiente) — CTA y tab bar no coexisten.
  return (
    <AppShell hideTabBar>
      <section className="pt-1">
        <CapsulaForm initial={initial} />
      </section>
    </AppShell>
  );
}
