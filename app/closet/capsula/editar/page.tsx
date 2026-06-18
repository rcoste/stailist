import Link from "next/link";
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

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <div className="flex flex-col gap-2">
          <Link href="/closet" className="text-sm font-medium text-muted hover:text-ink">
            ← Clóset
          </Link>
          <h1 className="text-h1 font-semibold text-ink">Tu cápsula</h1>
          <p className="text-sm text-muted">
            Cuéntame de tu vida y te armo el clóset ideal para ti — y te digo qué prendas ya
            tienes y cuáles te faltan. Nada de comprar; solo claridad.
          </p>
        </div>
        <CapsulaForm initial={initial} />
      </section>
    </AppShell>
  );
}
