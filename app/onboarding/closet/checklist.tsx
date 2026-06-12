"use client";

import { useState, useTransition } from "react";
import { saveCloset } from "./actions";

export type CatalogItem = {
  id: number;
  name: string;
  category: string;
  attrs: { color_hex?: string };
};

export function Checklist({ catalog }: { catalog: CatalogItem[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      <div className="grid grid-cols-2 gap-3">
        {catalog.map((item) => {
          const on = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              aria-pressed={on}
              className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-200 focus-visible:outline-none ${
                on
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:border-ink"
              }`}
            >
              <span
                className="h-8 w-8 shrink-0 rounded-lg border border-line"
                style={{ backgroundColor: item.attrs.color_hex ?? "#E5E1DD" }}
                aria-hidden
              />
              <span className="text-sm font-medium text-ink">{item.name}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="sticky bottom-0 bg-bg pt-2 pb-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.size === 0}
          className="min-h-12 w-full rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          {pending
            ? "Guardando tu clóset…"
            : selected.size === 0
              ? "Marca lo que tienes"
              : `Listo, ese es mi clóset (${selected.size})`}
        </button>
      </div>
    </div>
  );
}
