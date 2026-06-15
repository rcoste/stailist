import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { AddPhotoFlow } from "@/components/add-photo-flow";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
};

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
    };
    const photoUrl = r.photo_path ? signed.get(r.photo_path as string) : null;
    return {
      id: r.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      imagen: arch?.image_path ?? photoUrl ?? attrs.image_path ?? null,
      swatch: attrs.color_hex ?? "#E5E1DD",
      category: arch?.category ?? attrs.categoria ?? attrs.tipo ?? "accesorio",
    };
  });

  const grupos = CATEGORIAS.map((c) => ({
    ...c,
    prendas: items.filter((i) => i.category === c.key),
  })).filter((g) => g.prendas.length > 0);

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 font-semibold text-ink">Clóset</h1>
            <p className="text-sm text-muted">
              {items.length}{" "}
              {items.length === 1 ? "prenda" : "prendas"} en tu clóset.
            </p>
          </div>
          <AddPhotoFlow userId={profile.id} />
        </div>

        {grupos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
            <p className="editorial text-lg text-ink">tu clóset está vacío</p>
            <p className="text-sm text-muted">
              Vuelve al inicio y marca los básicos que tienes.
            </p>
          </div>
        ) : (
          grupos.map((g) => (
            <div key={g.key} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
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
