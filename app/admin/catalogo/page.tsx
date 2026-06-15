import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LOOKS } from "@/lib/looks";

type Arch = {
  id: number;
  slug: string;
  name: string;
  category: string;
  segment: string;
  attrs: {
    color?: string;
    color_hex?: string;
    formalidad?: string;
    temporada?: string;
  };
  image_path: string | null;
};

const SEG_LABEL: Record<string, string> = {
  hombre: "Hombre",
  mujer: "Mujer",
  unisex: "Unisex",
};

export default async function AdminCatalogo() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("archetypes")
    .select("id, slug, name, category, segment, attrs, image_path")
    .order("segment")
    .order("sort_order");
  const archs = (data ?? []) as Arch[];

  const bySegment = ["hombre", "mujer", "unisex"]
    .map((seg) => ({ seg, items: archs.filter((a) => a.segment === seg) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Catálogo</h1>
        <p className="text-sm text-muted">
          {archs.length} básicos · {LOOKS.length} looks. Toca un básico para
          editarlo.
        </p>
      </div>

      {/* Básicos */}
      {bySegment.map(({ seg, items }) => (
        <section key={seg} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Básicos · {SEG_LABEL[seg] ?? seg} ({items.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((a) => (
              <Link
                key={a.id}
                href={`/admin/catalogo/${a.id}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors duration-200 hover:border-accent"
              >
                <div className="relative aspect-square w-full bg-bg">
                  {a.image_path ? (
                    <Image
                      src={a.image_path}
                      alt={a.name}
                      fill
                      sizes="180px"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      className="absolute inset-0"
                      style={{ backgroundColor: a.attrs.color_hex ?? "#E5E1DD" }}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="text-sm font-medium text-ink">{a.name}</span>
                  <span className="text-xs text-muted">
                    {[a.category, a.attrs.formalidad, a.attrs.temporada]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* Looks (swipes) — código, no editable */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Looks de swipes ({LOOKS.length})
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LOOKS.map((l) => (
            <div
              key={l.id}
              className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface"
            >
              <div className="relative aspect-[3/4] w-full bg-bg">
                {l.image ? (
                  <Image
                    src={l.image}
                    alt={l.nombre}
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col">
                    {l.prendas.map((p) => (
                      <span
                        key={p.nombre}
                        className="flex-1"
                        style={{ backgroundColor: p.swatch }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 p-2">
                <span className="text-sm font-medium text-ink">{l.nombre}</span>
                <span className="text-xs text-muted">
                  {SEG_LABEL[l.segment] ?? l.segment} · {l.vibe}
                </span>
                <div className="flex flex-wrap gap-1">
                  {l.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-bg px-2 py-0.5 text-[10px] text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
