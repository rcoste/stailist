import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isBuild } from "@/lib/silueta";
import { fotosBloqueadas } from "@/lib/edad";
import { safeReturn } from "@/lib/return-to";
import { AvatarWizard } from "@/components/avatar-wizard";

// Wizard de creación de avatar digital (issue #1). Llega aquí desde el nudge de
// /hoy (?return=/hoy), desde el botón del perfil, o desde el wow del onboarding
// (?return=/onboarding/wow). Usa getProfile (NO requireOnboarded): el avatar es
// opcional y se puede crear durante el onboarding, así que no exigimos haberlo
// terminado — solo estar logueado y con género. La generación corre en
// /api/avatar/generate.
export const maxDuration = 60;

export default async function PerfilAvatarPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");

  // Solo rutas internas conocidas (sin open-redirect); conserva la query del wow.
  const { return: ret } = await searchParams;
  const returnTo = safeReturn(ret);

  // Menor sin permiso parental: el avatar ES fotos de su cara/cuerpo — mejor
  // avisarle aquí (con salida a Perfil para reenviar el link) que dejarla
  // estrellarse con el 403 del endpoint al final del wizard.
  if (fotosBloqueadas(profile)) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-5 px-[30px] pb-10 lg:mx-auto lg:max-w-[430px]">
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
          Casi — falta el permiso de tus papás
        </h1>
        <p className="text-[16px] leading-snug text-muted">
          Tu avatar se crea con fotos tuyas, y para eso necesitamos que tus
          papás o tutores confirmen el correo que les mandamos. En tu Perfil
          puedes reenviárselo o mandárselo por WhatsApp.
        </p>
        <Link
          href="/perfil"
          className="flex min-h-[54px] w-full items-center justify-center rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          ir a mi perfil
        </Link>
      </section>
    );
  }

  // En el onboarding el avatar es opcional y no debe atrapar: "seguir sin avatar"
  // entra directo a la app (/hoy). En perfil/hoy no se ofrece skip (se llega aquí
  // a propósito; el "← Volver" ya existe).
  const skipHref =
    returnTo.split(/[?#]/)[0] === "/onboarding/wow" ? "/hoy" : undefined;

  return (
    <AvatarWizard
      userId={profile.id}
      gender={profile.gender}
      returnTo={returnTo}
      skipHref={skipHref}
      // Morfología unificada: si ya definió su silueta, el wizard no re-pregunta
      // la complexión — la recibe tal cual (misma taxonomía, sin traducción).
      siluetaBuild={isBuild(profile.body_build) ? profile.body_build : null}
    />
  );
}
