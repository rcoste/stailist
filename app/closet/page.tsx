import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AddPhotoFlow } from "@/components/add-photo-flow";
import { CapsuleCard } from "@/components/capsule-card";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  capsuleView,
  closetSignature,
  type CapsuleMatch,
  type CapsuleTarget,
} from "@/lib/capsule";

// Orden y etiqueta de cada categoría para agrupar el clóset.
const CATEGORIAS: { key: string; label: string }[] = [
  { key: "top", label: "Tops" },
  { key: "abrigo", label: "Abrigos" },
  { key: "bottom", label: "Pantalones" },
  { key: "vestido", label: "Vestidos" },
  { key: "calzado", label: "Calzado" },
  { key: "accesorio", label: "Accesorios" },
];

type ClosetItem = {
  id: string;
  nombre: string;
  imagen: string | null;
  swatch: string;
  category: string;
  formalidad: string;
};

// La acción recalcularMatch (del card) llama a Opus con el clóset completo;
// le damos el presupuesto de 60s para que no se corte en clósets grandes.
export const maxDuration = 60;

export default async function ClosetPage() {
  const profile = await requireOnboarded();

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("items")
    .select("id, source, photo_path, attrs, archetypes(name, category, image_path)")
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  // Las fotos propias viven en el bucket privado → URL firmada para mostrarlas.
  const photoPaths = (rows ?? [])
    .map((r) => r.photo_path as string | null)
    .filter((p): p is string => !!p);
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
    };
    const photoUrl = r.photo_path ? signed.get(r.photo_path as string) : null;
    return {
      id: r.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      imagen: arch?.image_path ?? photoUrl ?? attrs.image_path ?? null,
      swatch: attrs.color_hex ?? "#E5E1DD",
      category: arch?.category ?? attrs.categoria ?? attrs.tipo ?? "accesorio",
      formalidad: attrs.formalidad ?? "casual",
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

  const grupos = CATEGORIAS.map((c) => ({
    ...c,
    prendas: items.filter((i) => i.category === c.key),
  })).filter((g) => g.prendas.length > 0);

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
            <AddPhotoFlow userId={profile.id} />
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

        {grupos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-6 py-14 text-center">
            <p className="editorial text-lg text-ink">tu clóset está vacío</p>
            <p className="text-sm text-muted">
              Vuelve al inicio y marca los básicos que tienes.
            </p>
          </div>
        ) : (
          grupos.map((g) => (
            <div key={g.key} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium font-sans uppercase tracking-wide text-muted">
                {g.label}
              </h2>
              <ul className="grid grid-cols-3 gap-3">
                {g.prendas.map((p) => (
                  <li key={p.id} className="flex flex-col gap-1.5">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-bg">
                      {p.imagen ? (
                        <Image
                          src={p.imagen}
                          alt={p.nombre}
                          fill
                          sizes="(max-width: 430px) 33vw, 130px"
                          className="object-cover"
                        />
                      ) : (
                        <span
                          className="absolute inset-0"
                          style={{ backgroundColor: p.swatch }}
                          aria-hidden
                        />
                      )}
                    </div>
                    <p className="text-xs font-medium text-ink">{p.nombre}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
