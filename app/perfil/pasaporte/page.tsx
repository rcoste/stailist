import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildPasaporte } from "@/lib/pasaporte";
import { PasaporteShare } from "@/components/pasaporte-share";

export default async function PerfilPasaportePage() {
  const profile = await requireOnboarded();
  const data = buildPasaporte(profile);

  // Héroe visual = el avatar de la usuaria. Va INLINE como data URL: la card se
  // captura con html-to-image y una URL firmada (cross-origin) ensuciaría el
  // canvas. Inlineándolo, la imagen entra limpia al PNG.
  if (profile.avatar_path) {
    const supabase = await createClient();
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrl(profile.avatar_path, 600);
    if (signed?.signedUrl) {
      try {
        const res = await fetch(signed.signedUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const mime = res.headers.get("content-type") ?? "image/jpeg";
          data.heroImage = `data:${mime};base64,${buf.toString("base64")}`;
        }
      } catch {
        // sin avatar en la card; no es bloqueante
      }
    }
  }

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
