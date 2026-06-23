import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PerfilTabs } from "@/components/perfil-tabs";
import { nameFromEmail } from "@/lib/pasaporte";
import { buildLabel, volumeLabel } from "@/lib/silueta";
import { seasonPalette, seasonDisplayLabel, seasonMetal } from "@/lib/colorimetria";
import { signOut } from "./actions";

// Perfil en mini-tabs: Cuenta (default) · Estilo · Preferencias. Este server
// component resuelve los datos (avatar firmado, paleta, silueta, banner del
// pasaporte) y los pasa a <PerfilTabs>, que maneja el cambio de pestaña en cliente.
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

  // Banner del pasaporte (pestaña Estilo): estación + (arquetipo · metal) + tus
  // mejores colores. Degrada con gracia si aún no hay colorimetría/estilo.
  const season = profile.palette_season;
  const pal = season ? seasonPalette(season, profile.palette_flow) : null;
  const seasonLabel = season ? seasonDisplayLabel(season, profile.palette_flow) : null;
  const metal = season ? seasonMetal(season, profile.palette_flow) : null;
  const archetypeNombre = profile.style_archetype?.nombre ?? null;

  const subParts = [
    archetypeNombre,
    metal ? `metal ${metal}` : null,
  ].filter(Boolean) as string[];

  const banner = {
    title: seasonLabel ?? "Tu pasaporte de estilo",
    sub: subParts.length > 0 ? subParts.join(" · ") : null,
    swatches: (pal?.mejores ?? []).slice(0, 5).map((c) => c.hex),
  };

  const siluetaLabel =
    profile.body_build || profile.body_volume
      ? [
          profile.body_build ? buildLabel(profile.body_build) : null,
          profile.body_volume ? volumeLabel(profile.body_volume) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <AppShell>
      <PerfilTabs
        name={nameFromEmail(profile.email)}
        email={profile.email}
        avatarUrl={avatarUrl}
        season={profile.palette_season}
        flow={profile.palette_flow}
        archetype={profile.style_archetype}
        tasteTags={profile.taste_tags}
        gender={profile.gender}
        styleVetoes={profile.style_vetoes}
        siluetaLabel={siluetaLabel}
        banner={banner}
        signOut={signOut}
      />
    </AppShell>
  );
}
