"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { toggleBasico } from "./actions";

export type BasicoRow = {
  id: number;
  name: string;
  category: string;
  segment: string;
  attrs: { color?: string } | null;
  image_path: string | null;
  onboarding_subset: boolean | null;
};

const SEG_LABEL: Record<string, string> = {
  unisex: "Unisex — los ve todo el mundo",
  hombre: "Hombre",
  mujer: "Mujer",
};
const SEG_ORDER = ["unisex", "hombre", "mujer"];

export function BasicosClient({ filas }: { filas: BasicoRow[] }) {
  // Estado optimista: el toggle se pinta al instante y se revierte si el
  // servidor dice que no. Con 200+ prendas, esperar el round-trip por cada tap
  // convierte curar la lista en un trabajo de media hora.
  const [prendidas, setPrendidas] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(filas.map((f) => [f.id, !!f.onboarding_subset]))
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    const nuevo = !prendidas[id];
    setPrendidas((p) => ({ ...p, [id]: nuevo }));
    setError(null);
    startTransition(async () => {
      const r = await toggleBasico(id, nuevo).catch(() => ({
        error: "no se pudo guardar",
      }));
      if ("error" in r) {
        setPrendidas((p) => ({ ...p, [id]: !nuevo }));
        setError(r.error);
      }
    });
  }

  const grupos = SEG_ORDER.filter((s) => filas.some((f) => f.segment === s));

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="rounded-lg border border-line bg-surface p-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      {grupos.map((seg) => {
        const items = filas.filter((f) => f.segment === seg);
        const on = items.filter((f) => prendidas[f.id]).length;
        return (
          <div key={seg} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink">{SEG_LABEL[seg] ?? seg}</h2>
              <span className="text-xs text-muted">
                {on} de {items.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((a) => {
                const activo = prendidas[a.id];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    aria-pressed={activo}
                    className={`flex flex-col overflow-hidden rounded-xl border text-left transition ${
                      activo
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface opacity-60"
                    }`}
                  >
                    <div className="relative aspect-[3/4] w-full bg-bg">
                      {a.image_path ? (
                        <Image
                          src={a.image_path}
                          alt={a.name}
                          fill
                          sizes="180px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-0.5 p-2">
                      <span className="text-xs font-medium leading-tight text-ink">
                        {a.name}
                      </span>
                      <span className="text-[11px] text-muted">
                        {activo ? "en el onboarding" : "fuera"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
