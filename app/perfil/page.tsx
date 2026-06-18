import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChangeAvatar } from "@/components/change-avatar";
import { ColorimetriaSection } from "@/components/colorimetria-section";
import { InstallAppRow } from "@/components/install-app-row";
import { signOut } from "./actions";

// Perfil: tu cuenta y tus ajustes. Se construye por secciones — base (cuenta +
// opinión + sign out) + tu foto (avatar). Colorimetría y estilo se suman después.
export default async function PerfilPage() {
  const profile = await requireOnboarded();

  // La foto de avatar vive en el bucket privado → URL firmada para mostrarla.
  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <h1 className="text-h1 font-semibold text-ink">Perfil</h1>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Tu foto
          </span>
          <div className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
            {avatarUrl ? (
              <div className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-lg border border-line bg-bg">
                <Image src={avatarUrl} alt="Tu foto" fill sizes="72px" className="object-cover" />
              </div>
            ) : (
              <span className="flex h-24 w-[72px] shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-bg text-muted">
                <Icon name="camara" size={22} />
              </span>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <span className="text-xs text-muted">
                {avatarUrl
                  ? "La uso para ponerte los looks encima en el try-on."
                  : "Súbela y podrás verte con tus looks puestos."}
              </span>
              <ChangeAvatar userId={profile.id} hasAvatar={!!avatarUrl} />
            </div>
          </div>
        </div>

        <ColorimetriaSection season={profile.palette_season} />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Tu estilo
          </span>
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            {profile.style_archetype ? (
              <>
                <div className="flex flex-col gap-0.5">
                  <span className="editorial text-xl text-ink">
                    {profile.style_archetype.nombre}
                  </span>
                  <span className="text-xs text-muted">
                    {profile.style_archetype.descripcion}
                  </span>
                </div>
                {profile.taste_tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.taste_tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-line bg-bg px-2.5 py-1 text-xs capitalize text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted">Aún no tenemos tu estilo.</span>
            )}
          </div>
        </div>

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
          <InstallAppRow />

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
