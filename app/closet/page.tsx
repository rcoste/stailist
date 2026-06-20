import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AddPhotoFlow } from "@/components/add-photo-flow";
import { ImportCarreteFlow } from "@/components/import-carrete-flow";
import { CapsuleCard } from "@/components/capsule-card";
import { ClosetGrid, type ClosetItem } from "@/components/closet-grid";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  capsuleView,
  closetSignature,
  type CapsuleMatch,
  type CapsuleTarget,
} from "@/lib/capsule";

// La acción recalcularMatch (del card) llama a Opus con el clóset completo;
// le damos el presupuesto de 60s para que no se corte en clósets grandes.
export const maxDuration = 60;

export default async function ClosetPage() {
  const profile = await requireOnboarded();

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("items")
    .select(
      "id, source, photo_path, render_status, render_path, attrs, archetypes(name, category, image_path)"
    )
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  // Las fotos propias y los renders viven en el bucket privado → URL firmada para
  // mostrarlas. Juntamos ambos paths en una sola petición de firmas.
  const photoPaths = Array.from(
    new Set(
      (rows ?? [])
        .flatMap((r) => [r.photo_path as string | null, r.render_path as string | null])
        .filter((p): p is string => !!p)
    )
  );
  const signed = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrls(photoPaths, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  // Resuelve nombre/imagen/categoría: del arquetipo si lo hay, si no de attrs
  // (las fotos propias usan la URL firmada y la categoría que confirmó la usuaria).
  const items: ClosetItem[] = (rows ?? []).map((r) => {
    const arch = r.archetypes as {
      name?: string;
      category?: string;
      image_path?: string | null;
    } | null;
    const attrs = r.attrs as {
      nombre?: string;
      image_path?: string | null;
      color_hex?: string;
      categoria?: string;
      tipo?: string;
      formalidad?: string;
      temporada?: string;
    };
    const photoUrl = r.photo_path ? signed.get(r.photo_path as string) : null;
    // Render limpio del carrete: si ya se generó, manda sobre la foto cruda.
    const renderUrl =
      r.render_status === "done" && r.render_path
        ? signed.get(r.render_path as string)
        : null;
    return {
      id: r.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      imagen: arch?.image_path ?? renderUrl ?? photoUrl ?? attrs.image_path ?? null,
      swatch: attrs.color_hex ?? "#E5E1DD",
      category: arch?.category ?? attrs.categoria ?? attrs.tipo ?? "accesorio",
      formalidad: attrs.formalidad ?? "casual",
      temporada: attrs.temporada ?? "todo-el-año",
      source: (r.source as string) ?? "archetype",
    };
  });

  // Cápsula: la meta (capa 1) y el match (capa 2) viven cacheados en el profile.
  // El match se recalcula solo si el clóset cambió (firma distinta) vía "recalcular".
  const target = profile.capsule_target as CapsuleTarget | null;
  const match = profile.capsule_match as CapsuleMatch | null;
  const currentSig = closetSignature(items);
  const stale = !!target && (!match || match.signature !== currentSig);
  const view = target && match ? capsuleView(target, match, profile.capsule_overrides) : null;

  // ¿Ya sumó ropa propia (foto)? Si no, el clóset son puros básicos asumidos →
  // aclaramos que es un punto de arranque. Si ya personalizó, no lo regañamos.
  const hasOwnPhotos = (rows ?? []).some((r) => r.source === "photo");

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-h1 font-semibold text-ink">Clóset</h1>
              <p className="text-sm text-muted">
                {hasOwnPhotos
                  ? `${items.length} ${items.length === 1 ? "prenda" : "prendas"} en tu clóset.`
                  : "Estos son tus básicos para arrancar. Súmale tu ropa real y tus looks se vuelven 100% tuyos."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <AddPhotoFlow userId={profile.id} />
              <ImportCarreteFlow />
            </div>
          </div>

          <Link
            href="/closet/biblioteca"
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-accent"
          >
            <span className="flex flex-col">
              <span className="text-sm font-medium text-ink">Explora la Biblioteca</span>
              <span className="text-xs text-muted">Agrega más básicos que ya tienes</span>
            </span>
            <Icon name="chevron" size={16} className="shrink-0 text-muted" />
          </Link>
        </div>

        <CapsuleCard hasTarget={!!target} view={view} stale={stale} />

        <ClosetGrid items={items} />
      </section>
    </AppShell>
  );
}
