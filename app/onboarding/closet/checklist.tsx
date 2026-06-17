"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { saveCloset } from "./actions";

export type CatalogItem = {
  id: number;
  name: string;
  category: string;
  attrs: { color_hex?: string };
  image_path: string | null;
};

// Con ~45 básicos, agrupar por categoría hace que escanear sea rápido (en vez
// de un scroll plano interminable). Orden de arriba a abajo del clóset real.
const CATEGORY_ORDER = ["top", "vestido", "bottom", "abrigo", "calzado"];
const CATEGORY_LABELS: Record<string, string> = {
  top: "Arriba",
  vestido: "Vestidos",
  bottom: "Abajo",
  abrigo: "Abrigos",
  calzado: "Zapatos",
};

export function Checklist({ catalog }: { catalog: CatalogItem[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Agrupa por categoría conservando el sort_order que ya trae el catálogo.
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: catalog.filter((i) => i.category === cat),
  }))
    .filter((g) => g.items.length > 0)
    // Cualquier categoría no contemplada arriba va al final, no se pierde.
    .concat(
      (() => {
        const known = new Set(CATEGORY_ORDER);
        const rest = catalog.filter((i) => !known.has(i.category));
        const cats = [...new Set(rest.map((i) => i.category))];
        return cats.map((cat) => ({
          cat,
          items: rest.filter((i) => i.category === cat),
        }));
      })()
    );

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function submit() {
    startTransition(async () => {
      setError(null);
      const res = await saveCloset([...selected]);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Galería de prendas por categoría: clic, clic, clic. La imagen manda. */}
      {groups.map(({ cat, items }) => {
        const selCount = items.filter((i) => selected.has(i.id)).length;
        return (
        <div key={cat} className="flex flex-col gap-3">
          <h2 className="flex items-baseline justify-between font-sans text-sm font-semibold uppercase tracking-wide text-muted">
            <span>{CATEGORY_LABELS[cat] ?? cat}</span>
            <span className={selCount > 0 ? "text-accent" : "text-muted"}>
              {selCount > 0 ? `${selCount} de ${items.length}` : `${items.length} prendas`}
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => {
              const on = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={on}
                  className={`group relative flex flex-col overflow-hidden rounded-md border bg-surface text-left transition-colors duration-200 focus-visible:outline-none ${
                    on ? "border-accent" : "border-line hover:border-ink"
                  }`}
                >
                  <div className="relative aspect-square w-full bg-bg">
                    {item.image_path ? (
                      <Image
                        src={item.image_path}
                        alt={item.name}
                        fill
                        sizes="(max-width: 430px) 50vw, 215px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        className="absolute inset-0"
                        style={{ backgroundColor: item.attrs.color_hex ?? "#E5E1DD" }}
                        aria-hidden
                      />
                    )}
                    {/* Check de selección en el pico emocional del tap */}
                    <span
                      className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-sm text-on-accent transition-all duration-200 ${
                        on ? "scale-100 bg-accent" : "scale-0 bg-transparent"
                      }`}
                      aria-hidden
                    >
                      <Icon name="check" size={16} strokeWidth={2.4} />
                    </span>
                    {/* Velo sutil sobre lo no seleccionado para que resalte lo elegido */}
                    {!on && (
                      <span className="absolute inset-0 bg-bg/20 transition-opacity duration-200 group-hover:opacity-0" />
                    )}
                  </div>
                  <span className="px-3 py-2 text-sm font-medium text-ink">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        );
      })}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="sticky bottom-0 bg-bg pt-2 pb-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.size === 0}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? (
            <>
              <Spinner className="h-4 w-4" />
              Guardando tu clóset…
            </>
          ) : selected.size === 0 ? (
            "Marca lo que tienes"
          ) : (
            `Listo, ese es mi clóset (${selected.size})`
          )}
        </button>
      </div>
    </div>
  );
}
