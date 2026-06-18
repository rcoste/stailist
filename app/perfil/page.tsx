import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { signOut } from "./actions";

// Perfil: tu cuenta y tus ajustes. Se construye por partes — esta es la base
// (cuenta + opinión + cerrar sesión). Avatar, colorimetría y estilo se suman
// como secciones encima (ver docs/designs/post-onboarding-nudges.md no aplica;
// es feature aparte). Voz de marca: cálida y directa.
export default async function PerfilPage() {
  const profile = await requireOnboarded();

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <h1 className="text-h1 font-semibold text-ink">Perfil</h1>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Tu cuenta
          </span>
          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon name="sobre" size={16} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-xs text-muted">Tu correo</span>
              <span className="truncate text-sm font-medium text-ink">{profile.email}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href="mailto:hola@stailist.co?subject=Mi%20opini%C3%B3n%20de%20stailist"
            className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon name="corazon" size={16} />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-ink">Danos tu opinión</span>
              <span className="text-xs text-muted">Qué te late, qué no, qué falta.</span>
            </div>
            <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
          </a>

          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center rounded-lg border border-line bg-surface text-sm font-medium text-muted transition-colors hover:border-ink hover:text-ink"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
