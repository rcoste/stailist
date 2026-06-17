import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { CapsulaForm } from "./capsula-form";
import type { LifestyleAnswers } from "@/lib/capsule";

// La acción saveLifestyle hace 2 llamadas a Opus (generar + match): medido ~27s
// con clóset de 57. Le damos el presupuesto de 60s de Vercel (sin esto, una
// server action puede cortarse mucho antes y la cápsula falla en silencio).
export const maxDuration = 60;

export default async function CapsulaPage() {
  const profile = await requireOnboarded();
  const initial = (profile.lifestyle as LifestyleAnswers | null) ?? {};

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <div className="flex flex-col gap-2">
          <Link href="/closet" className="text-sm font-medium text-muted hover:text-ink">
            ← Clóset
          </Link>
          <h1 className="text-h1 font-semibold text-ink">Tu cápsula</h1>
          <p className="text-sm text-muted">
            Cuéntame de tu vida y te digo qué tan bien te cubre tu clóset — y qué piezas te
            faltan de verdad. Nada de comprar; solo claridad.
          </p>
        </div>
        <CapsulaForm initial={initial} />
      </section>
    </AppShell>
  );
}
