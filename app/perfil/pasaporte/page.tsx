import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import { buildPasaporte } from "@/lib/pasaporte";
import { PasaporteShare } from "@/components/pasaporte-share";

export default async function PerfilPasaportePage() {
  const profile = await requireOnboarded();
  const data = buildPasaporte(profile);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      <Link href="/perfil" className="text-sm font-medium text-muted hover:text-ink">
        ← Perfil
      </Link>
      <div className="mb-5 mt-4 flex flex-col gap-1">
        <h1 className="text-h1 font-semibold text-ink">Tu pasaporte de estilo</h1>
        <p className="text-sm text-muted">Tu identidad en una tarjeta. Compártela 🤍</p>
      </div>
      <PasaporteShare data={data} />
    </div>
  );
}
