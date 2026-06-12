import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";

export default async function HistorialPage() {
  await requireOnboarded();
  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-4">
        <div>
          <h1 className="text-h1 font-semibold text-ink">Historial</h1>
          <p className="text-sm text-muted">Tus looks pasados viven aquí.</p>
        </div>

        {/* Estado vacío con calidez + CTA (spec del design review) */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
          <p className="editorial text-lg text-ink">tu primer look te espera</p>
          <p className="text-sm text-muted">
            Cuando generes outfits, aquí podrás volver a verlos, votarlos y
            marcar los que te pusiste.
          </p>
          <Link
            href="/hoy"
            className="flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Genera tu look de hoy
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
