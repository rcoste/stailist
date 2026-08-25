import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PerfilTabs } from "@/components/perfil-tabs";
import { nameFromEmail } from "@/lib/pasaporte";
import { buildLabel, volumeLabel } from "@/lib/silueta";
import { dressCodePorClave, ropaDeDressCode } from "@/lib/dress-code";
import { seasonPalette, seasonDisplayLabel, metalForSeason } from "@/lib/colorimetria";
import { signOut } from "./actions";
import { resendParentConsent } from "./consentimiento-actions";
import { isMinor } from "@/lib/edad";
import { permisoUrl } from "@/lib/consentimiento";

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

  // Estilo de referencia: firma sus fotos (bucket privado) para las miniaturas.
  const sr = profile.style_reference;
  let styleReference: {
    summary: string;
    tags: string[];
    fit?: { verdict: string; note: string } | null;
    images: string[];
    paths?: string[];
  } | null = null;
  if (sr) {
    const paths = Array.isArray(sr.image_paths)
      ? sr.image_paths
      : sr.image_path
        ? [sr.image_path]
        : [];
    const supabase = await createClient();
    const { data } = paths.length
      ? await supabase.storage.from("prendas").createSignedUrls(paths, 3600)
      : { data: [] };
    styleReference = {
      summary: sr.summary,
      tags: sr.tags ?? [],
      fit: sr.fit ?? null,
      images: (data ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u),
      // Las rutas viajan al cliente para poder SUMAR fotos sin perder las que ya
      // hay (la card las manda de vuelta como `keep`).
      paths,
    };
  }

  // ¿Ya tiene cápsula? Solo entonces tiene sentido avisarle que cambiar su
  // estilo la deja desactualizada — si no tiene, el aviso sería ruido.
  const tieneCapsula = !!profile.capsule_target;

  // Banner del pasaporte (pestaña Estilo): estación + (arquetipo · metal) + tus
  // mejores colores. Degrada con gracia si aún no hay colorimetría/estilo.
  const season = profile.palette_season;
  const pal = season ? seasonPalette(season, profile.palette_flow) : null;
  const seasonLabel = season ? seasonDisplayLabel(season, profile.palette_flow) : null;
  const metal = season ? metalForSeason(season, profile.palette_flow) : null;
  const archetypeNombre = profile.style_archetype?.nombre ?? null;

  const subParts = [
    archetypeNombre,
    metal ? `metal ${metal === "ambos" ? "oro y plata" : metal}` : null,
  ].filter(Boolean) as string[];

  const banner = {
    title: seasonLabel ?? "Tu pasaporte de estilo",
    sub: subParts.length > 0 ? subParts.join(" · ") : null,
    swatches: (pal?.mejores ?? []).slice(0, 5).map((c) => c.hex),
  };

  // Cómo se viste para trabajar, con el ancla concreta de su género.
  const dc = dressCodePorClave(profile.work_dress_code);
  const dressCodeLabel = dc ? ropaDeDressCode(dc, profile.gender) : null;

  const siluetaLabel =
    profile.body_build || profile.body_volume
      ? [
          profile.body_build ? buildLabel(profile.body_build) : null,
          profile.body_volume ? volumeLabel(profile.body_volume) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  // Card de permiso parental (solo menores 13-17): estado + reenviar + WhatsApp.
  const menor = isMinor(profile.age_range);
  const permisoPendiente = menor && !profile.minor_consent_verified_at;
  const linkPermiso = profile.minor_consent_token
    ? permisoUrl(profile.minor_consent_token)
    : null;
  // "hace X" del último correo enviado (feedback del botón reenviar; el server
  // aplica un cooldown de 10 min entre envíos).
  const sentAt = profile.minor_consent_last_sent_at
    ? new Date(profile.minor_consent_last_sent_at).getTime()
    : null;
  const ultimoEnvio = sentAt
    ? (() => {
        const min = Math.max(0, Math.floor((Date.now() - sentAt) / 60000));
        if (min < 1) return "hace un momento";
        if (min < 60) return `hace ${min} min`;
        const h = Math.floor(min / 60);
        return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} día(s)`;
      })()
    : null;
  const waHref = linkPermiso
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hola 👋 quiero usar Stailist (una app que arma outfits con mi ropa). Como soy menor, necesitan tu permiso — confírmalo aquí porfa: ${linkPermiso}`
      )}`
    : null;

  return (
    <AppShell>
      {permisoPendiente ? (
        <div className="mb-4 flex flex-col gap-3 border border-line bg-surface px-4 py-4">
          <p className="text-[15px] leading-snug text-ink">
            <b>Falta el permiso de tus papás o tutores.</b> Les mandamos un
            correo{profile.minor_parent_email ? ` a ${profile.minor_parent_email}` : ""} —
            cuando lo confirmen podrás subir fotos.
          </p>
          {ultimoEnvio ? (
            <p className="text-[13px] text-muted">último correo enviado {ultimoEnvio}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <form action={resendParentConsent}>
              <button
                type="submit"
                className="min-h-[42px] rounded-sm border border-ink px-4 text-[13px] font-bold text-ink transition-colors hover:bg-ink hover:text-bg"
              >
                reenviar correo
              </button>
            </form>
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[42px] items-center rounded-sm border border-line px-4 text-[13px] font-bold text-ink transition-colors hover:border-ink"
              >
                mandar por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {menor && profile.minor_consent_verified_at ? (
        <p className="mb-4 border border-line bg-surface px-4 py-3 text-[13px] text-muted">
          Permiso de tus papás o tutores: confirmado ✓
        </p>
      ) : null}
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
        registroPorPlan={profile.registro_por_plan}
        acentoApetito={profile.acento_apetito}
        acentoApetitoFuente={profile.acento_apetito_fuente}
        dressCodeLabel={dressCodeLabel}
        banner={banner}
        styleReference={styleReference}
        styleWords={profile.style_words}
        tieneCapsula={tieneCapsula}
        signOut={signOut}
      />
    </AppShell>
  );
}
