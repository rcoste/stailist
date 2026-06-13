"use client";

import { useState } from "react";
import { OutfitCard } from "@/components/outfit-card";
import { voteOutfit, markWorn } from "@/lib/outfit-actions";

export type HistoryOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  fecha: string;
  prendas: { nombre: string; swatch: string; imagen?: string | null }[];
  voto: "up" | "down" | null;
  worn: boolean;
};

type Estado = Record<string, { voto: "up" | "down" | null; worn: boolean }>;

export function HistoryList({ outfits }: { outfits: HistoryOutfit[] }) {
  const [estado, setEstado] = useState<Estado>(() =>
    Object.fromEntries(
      outfits.map((o) => [o.id, { voto: o.voto, worn: o.worn }])
    )
  );

  async function vote(id: string, up: boolean) {
    const prev = estado[id];
    const nuevo = up ? "up" : "down";
    setEstado((s) => ({ ...s, [id]: { ...s[id], voto: nuevo } }));
    const res = await voteOutfit(id, up);
    if (!res.ok) setEstado((s) => ({ ...s, [id]: prev })); // revertir
  }

  async function worn(id: string) {
    if (estado[id]?.worn) return;
    setEstado((s) => ({ ...s, [id]: { ...s[id], worn: true } }));
    const res = await markWorn(id);
    if (!res.ok)
      setEstado((s) => ({ ...s, [id]: { ...s[id], worn: false } }));
  }

  return (
    <div className="flex flex-col gap-8">
      {outfits.map((o) => {
        const e = estado[o.id];
        return (
          <div key={o.id} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-h3 font-semibold text-ink">{o.nombre}</h2>
              <span className="tabular text-xs text-muted">{o.fecha}</span>
            </div>
            <OutfitCard
              prendas={o.prendas.map((p) => ({ ...p, detalle: "" }))}
              justificacion={o.explicacion}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => vote(o.id, true)}
                aria-pressed={e.voto === "up"}
                aria-label="Me gusta"
                className={`flex min-h-11 flex-1 items-center justify-center rounded-full border text-sm font-medium transition-colors duration-200 ${
                  e.voto === "up"
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                👍
              </button>
              <button
                type="button"
                onClick={() => vote(o.id, false)}
                aria-pressed={e.voto === "down"}
                aria-label="No me gusta"
                className={`flex min-h-11 flex-1 items-center justify-center rounded-full border text-sm font-medium transition-colors duration-200 ${
                  e.voto === "down"
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                👎
              </button>
              <button
                type="button"
                onClick={() => worn(o.id)}
                disabled={e.worn}
                className={`flex min-h-11 flex-[2] items-center justify-center rounded-full text-sm font-medium transition-colors duration-200 ${
                  e.worn
                    ? "bg-success/15 text-success"
                    : "bg-accent text-on-accent hover:bg-accent-deep"
                }`}
              >
                {e.worn ? "✓ Me lo puse" : "Me lo puse"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
