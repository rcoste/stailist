import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

// Orden y etiqueta de las categorías para los sub-grupos dentro de cada
// segmento. Categorías nuevas que no estén aquí caen al final bajo su slug.
const CATEGORY_ORDER = ["top", "bottom", "vestido", "abrigo", "calzado", "accesorio"];
const CATEGORY_LABEL: Record<string, string> = {
  top: "Tops",
  bottom: "Pantalones y faldas",
  vestido: "Vestidos",
  abrigo: "Abrigos",
  calzado: "Calzado",
  accesorio: "Accesorios",
};

function byCategory(items: Arch[]) {
  const cats = Array.from(new Set(items.map((a) => a.category)));
  cats.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return cats.map((cat) => ({
    cat,
    items: items.filter((a) => a.category === cat),
  }));
}

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
          {archs.length} básicos. Toca un básico para editarlo.
        </p>
      </div>

      {/* Básicos: agrupados por segmento y, dentro, por categoría */}
      {bySegment.map(({ seg, items }) => (
        <section key={seg} className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Básicos · {SEG_LABEL[seg] ?? seg} ({items.length})
          </h2>
          {byCategory(items).map(({ cat, items: catItems }) => (
            <div key={cat} className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted/80">
                {CATEGORY_LABEL[cat] ?? cat} ({catItems.length})
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {catItems.map((a) => (
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
                          style={{
                            backgroundColor: a.attrs.color_hex ?? "#E5E1DD",
                          }}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 p-2">
                      <span className="text-sm font-medium text-ink">
                        {a.name}
                      </span>
                      <span className="text-xs text-muted">
                        {[a.attrs.formalidad, a.attrs.temporada]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
