import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth";
import { SiluetaFlow } from "@/components/silueta-flow";

export default async function PerfilSiluetaPage() {
  const profile = await requireOnboarded();
  // Mujer y hombre tienen su propia silueta (cuerpos/opciones/consejos distintos).
  // Sin género definido no aplica: bloquea el acceso directo por URL.
  if (profile.gender !== "mujer" && profile.gender !== "hombre") redirect("/perfil");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      <Link href="/perfil" className="text-sm font-medium text-muted hover:text-ink">
        ← Perfil
      </Link>
      <div className="mt-4">
        <SiluetaFlow
          gender={profile.gender}
          initialBuild={profile.body_build}
          initialVolume={profile.body_volume}
        />
      </div>
    </div>
  );
}
