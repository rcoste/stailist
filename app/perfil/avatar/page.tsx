import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { AvatarWizard } from "@/components/avatar-wizard";

// Wizard de creación de avatar digital (issue #1). Llega aquí desde el nudge de
// /hoy (?return=/hoy), desde el botón del perfil, o desde el wow del onboarding
// (?return=/onboarding/wow). Usa getProfile (NO requireOnboarded): el avatar es
// opcional y se puede crear durante el onboarding, así que no exigimos haberlo
// terminado — solo estar logueado y con género. La generación corre en
// /api/avatar/generate.
export const maxDuration = 60;

const RETURNS = new Set(["/hoy", "/perfil", "/onboarding/wow"]);

export default async function PerfilAvatarPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");

  // Solo rutas internas conocidas (sin open-redirect).
  const { return: ret } = await searchParams;
  const returnTo = ret && RETURNS.has(ret) ? ret : "/perfil";

  return (
    <AvatarWizard userId={profile.id} gender={profile.gender} returnTo={returnTo} />
  );
}
