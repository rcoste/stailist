"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { addArchetypes } from "@/app/closet/actions";
import type { CatalogItem } from "@/app/onboarding/closet/checklist";

// Mismo orden y etiquetas que el checklist del onboarding, + accesorios.
const CATEGORY_ORDER = ["top", "vestido", "bottom", "abrigo", "calzado", "accesorio"];
const CATEGORY_LABELS: Record<string, string> = {
  top: "Arriba",
  vestido: "Vestidos",
  bottom: "Abajo",
  abrigo: "Abrigos",
  calzado: "Zapatos",
  accesorio: "Accesorios",
};

export function BibliotecaPicker({ catalog }: { catalog: CatalogItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const known = new Set(CATEGORY_ORDER);
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: catalog.filter((i) => i.category === cat),
  }))
    .filter((g) => g.items.length > 0)
    .concat(
      [...new Set(catalog.filter((i) => !known.has(i.category)).map((i) => i.category))].map(
        (cat) => ({ cat, items: catalog.filter((i) => i.category === cat) })
      )
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
      const res = await addArchetypes([...selected]);
      if (!res.ok) {
        setError("No pude agregar las prendas — inténtalo otra vez.");
        return;
      }
      router.push("/closet");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {groups.map(({ cat, items }) => (
        <div key={cat} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold font-sans uppercase tracking-wide text-muted">
            {CATEGORY_LABELS[cat] ?? cat}
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
                    <span
                      className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-sm text-on-accent transition-all duration-200 ${
                        on ? "scale-100 bg-accent" : "scale-0 bg-transparent"
                      }`}
                      aria-hidden
                    >
                      <Icon name="check" size={16} strokeWidth={2.4} />
                    </span>
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
      ))}

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
              Agregando…
            </>
          ) : selected.size === 0 ? (
            "Marca lo que quieras agregar"
          ) : (
            `Agregar a mi clóset (${selected.size})`
          )}
        </button>
      </div>
    </div>
  );
}
