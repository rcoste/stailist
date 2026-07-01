"use client";

import { useMemo, useState, useTransition } from "react";
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

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function BibliotecaPicker({ catalog }: { catalog: CatalogItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cat, setCat] = useState<string | null>(null); // null = Todos
  const [query, setQuery] = useState("");

  // Categorías presentes (orden canónico + cualquier extra), con conteo.
  const cats = useMemo(() => {
    const known = new Set(CATEGORY_ORDER);
    const extra = [...new Set(catalog.filter((i) => !known.has(i.category)).map((i) => i.category))];
    return [...CATEGORY_ORDER, ...extra]
      .map((key) => ({ key, count: catalog.filter((i) => i.category === key).length }))
      .filter((c) => c.count > 0);
  }, [catalog]);

  // Filtro por búsqueda (sobre todo) + categoría activa.
  const shown = useMemo(() => {
    const q = norm(query.trim());
    return catalog.filter((i) => {
      if (q && !norm(i.name).includes(q)) return false;
      if (cat && i.category !== cat) return false;
      return true;
    });
  }, [catalog, query, cat]);

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
      {/* Buscador slim + chips que FILTRAN (no scroll infinito). */}
      <div className="flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2.5">
        <Icon name="lupa" size={18} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="busca un básico…"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip label="Todos" count={catalog.length} on={!cat} onClick={() => setCat(null)} />
        {cats.map((c) => (
          <FilterChip
            key={c.key}
            label={CATEGORY_LABELS[c.key] ?? c.key}
            count={c.count}
            on={cat === c.key}
            onClick={() => setCat(c.key)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">nada coincide con tu búsqueda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((item) => {
            const on = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={on}
                className={`group relative flex flex-col overflow-hidden rounded-md border border-line bg-surface text-left transition-[border-color,box-shadow] duration-200 hover:border-ink focus-visible:outline-none ${
                  on ? "ring-2 ring-inset ring-accent" : ""
                }`}
              >
                {/* Las prendas se ven siempre a todo color para poder evaluarlas
                    antes de elegir; lo seleccionado se marca con marco + check. */}
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
                    className={`absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-sm text-on-accent transition-all duration-200 ${
                      on ? "scale-100 bg-accent" : "scale-0 bg-transparent"
                    }`}
                    aria-hidden
                  >
                    <Icon name="check" size={15} strokeWidth={2.4} />
                  </span>
                </div>
                <span
                  className={`px-2.5 py-2 text-[12.5px] font-medium transition-colors duration-200 ${
                    on ? "text-ink" : "text-muted"
                  }`}
                >
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      {/* Barra de acción fija (única barra abajo; sin tab bar en esta pantalla). */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-surface px-[18px] pb-[max(14px,env(safe-area-inset-bottom))] pt-[11px]">
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.size === 0}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-base font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? (
            <>
              <Spinner className="h-4 w-4" />
              agregando…
            </>
          ) : selected.size === 0 ? (
            "marca lo que quieras agregar"
          ) : (
            `agregar a mi clóset (${selected.size})`
          )}
        </button>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 py-2 text-[12.5px] font-medium transition-colors duration-200 ${
        on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {label}
      <span className={`tabular text-[11px] ${on ? "text-on-accent/70" : "text-muted/70"}`}>{count}</span>
    </button>
  );
}
