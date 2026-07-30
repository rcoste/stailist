import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth";
import { returnLabel, safeReturn } from "@/lib/return-to";
import { SiluetaFlow } from "@/components/silueta-flow";

// `?return=/hoy` cuando se llega desde el checklist de Home: al terminar hay que
// devolver a la persona a la lista de pasos, no a Perfil. Sin esto el paso se
// completaba pero la cadena se rompía (ver lib/return-to).
export default async function PerfilSiluetaPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const profile = await requireOnboarded();
  // Mujer y hombre tienen su propia silueta (cuerpos/opciones/consejos distintos).
  // Sin género definido no aplica: bloquea el acceso directo por URL.
  if (profile.gender !== "mujer" && profile.gender !== "hombre") redirect("/perfil");

  const { return: ret } = await searchParams;
  const returnTo = safeReturn(ret);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      <Link href={returnTo} className="text-sm font-medium text-muted hover:text-ink">
        ← {returnLabel(returnTo)}
      </Link>
      <div className="mt-4">
        <SiluetaFlow
          gender={profile.gender}
          initialBuild={profile.body_build}
          initialVolume={profile.body_volume}
          returnTo={returnTo}
        />
      </div>
    </div>
  );
}
