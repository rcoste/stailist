import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { closetSignature } from "@/lib/capsule";
import { loadClosetLite, loadClosetImageMap } from "@/lib/capsule-data";
import { CapsuleLooks } from "@/components/capsule-looks";
import type { TripOutfit } from "@/lib/trip";

// generateCapsuleOutfits (2 llamadas a Opus, ~30s) se dispara desde aquí.
export const maxDuration = 60;

export default async function CapsulaLooksPage() {
  const profile = await requireOnboarded();
  if (!profile.capsule_target) redirect("/closet/capsula/editar");

  const supabase = await createClient();
  const [closet, images] = await Promise.all([
    loadClosetLite(supabase, profile.id),
    loadClosetImageMap(supabase, profile.id),
  ]);

  const raw = (profile.capsule_outfits as TripOutfit[] | null) ?? null;
  const stale = !!raw && profile.capsule_outfits_sig !== closetSignature(closet);
  // Resuelve cada nombre de prenda a su imagen (mismo mapa que el clóset).
  const resolved = raw
    ? raw.map((o) => ({
        ocasion: o.ocasion as string,
        titulo: o.titulo,
        porque: o.porque,
        tip: o.tip ?? null,
        prendas: o.prendas.map((nombre) => ({ nombre, image: images[nombre] ?? null })),
      }))
    : null;

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-1">
        <div className="flex flex-col gap-1.5">
          <Link
            href="/closet/capsula"
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <Icon name="chevron" size={15} rotate={180} />
            Tu cápsula
          </Link>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            Los looks de tu cápsula
          </h1>
          <p className="text-[13px] text-muted">
            Armados solo con lo que ya tienes de tu cápsula.
          </p>
        </div>
        <CapsuleLooks outfits={resolved} stale={stale} />
      </section>
    </AppShell>
  );
}
