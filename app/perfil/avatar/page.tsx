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

  // En el onboarding el avatar es opcional y no debe atrapar: "seguir sin avatar"
  // entra directo a la app (/hoy). En perfil/hoy no se ofrece skip (se llega aquí
  // a propósito; el "← Volver" ya existe).
  const skipHref = returnTo === "/onboarding/wow" ? "/hoy" : undefined;

  return (
    <AvatarWizard
      userId={profile.id}
      gender={profile.gender}
      returnTo={returnTo}
      skipHref={skipHref}
    />
  );
}
