"use client";

import { useState } from "react";
import { OutfitCard } from "@/components/outfit-card";
import { FavoriteButton } from "@/components/favorite-button";
import { DownReason } from "@/components/down-reason";
import { voteOutfit, markWorn } from "@/lib/outfit-actions";
import { notifyFirstLike } from "@/lib/pwa";
import { Icon } from "@/components/icon";

export type HistoryOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  fecha: string;
  prendas: { nombre: string; swatch: string; imagen?: string | null }[];
  voto: "up" | "down" | null;
  worn: boolean;
  favorited: boolean;
};

type Estado = Record<
  string,
  { voto: "up" | "down" | null; worn: boolean; fav: boolean }
>;

export function HistoryList({ outfits }: { outfits: HistoryOutfit[] }) {
  const [estado, setEstado] = useState<Estado>(() =>
    Object.fromEntries(
      outfits.map((o) => [o.id, { voto: o.voto, worn: o.worn, fav: o.favorited }])
    )
  );
  const [soloFav, setSoloFav] = useState(false);

  const visibles = soloFav
    ? outfits.filter((o) => estado[o.id]?.fav)
    : outfits;

  async function vote(id: string, up: boolean) {
    const prev = estado[id];
    const nuevo = up ? "up" : "down";
    setEstado((s) => ({ ...s, [id]: { ...s[id], voto: nuevo } }));
    const res = await voteOutfit(id, up);
    if (!res.ok) setEstado((s) => ({ ...s, [id]: prev })); // revertir
    else if (up) notifyFirstLike(); // pico emocional → ofrecer instalar la PWA
  }

  async function worn(id: string) {
    if (estado[id]?.worn) return;
    setEstado((s) => ({ ...s, [id]: { ...s[id], worn: true } }));
    const res = await markWorn(id);
    if (!res.ok)
      setEstado((s) => ({ ...s, [id]: { ...s[id], worn: false } }));
  }

  const favCount = outfits.filter((o) => estado[o.id]?.fav).length;

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => setSoloFav((v) => !v)}
        aria-pressed={soloFav}
        className={`inline-flex items-center gap-1.5 self-start rounded-sm border px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
          soloFav
            ? "border-accent bg-accent-soft text-ink"
            : "border-line bg-surface text-muted hover:text-ink"
        }`}
      >
        <Icon name="guardar" size={16} active={soloFav} /> Solo favoritos
        {favCount > 0 ? ` (${favCount})` : ""}
      </button>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
          Aún no guardas favoritos. Toca el marcador de un look para guardarlo
          aquí.
        </p>
      ) : null}

      {visibles.map((o) => {
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
              corner={
                <FavoriteButton
                  outfitId={o.id}
                  initialFavorited={o.favorited}
                  onChange={(f) =>
                    setEstado((s) => ({ ...s, [o.id]: { ...s[o.id], fav: f } }))
                  }
                />
              }
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => vote(o.id, true)}
                aria-pressed={e.voto === "up"}
                aria-label="Me gusta"
                className={`flex min-h-11 flex-1 items-center justify-center rounded-sm border text-sm font-medium transition-colors duration-200 ${
                  e.voto === "up"
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                <Icon name="pulgar" size={18} active={e.voto === "up"} />
              </button>
              <button
                type="button"
                onClick={() => vote(o.id, false)}
                aria-pressed={e.voto === "down"}
                aria-label="No me gusta"
                className={`flex min-h-11 flex-1 items-center justify-center rounded-sm border text-sm font-medium transition-colors duration-200 ${
                  e.voto === "down"
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                <Icon name="pulgar" size={18} rotate={180} active={e.voto === "down"} />
              </button>
              <button
                type="button"
                onClick={() => worn(o.id)}
                disabled={e.worn}
                className={`flex min-h-11 flex-[2] items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors duration-200 ${
                  e.worn
                    ? "bg-success/15 text-success"
                    : "bg-accent text-on-accent hover:bg-accent-deep"
                }`}
              >
                {e.worn ? (
                  <>
                    <Icon name="check" size={16} /> Me lo puse
                  </>
                ) : (
                  "Me lo puse"
                )}
              </button>
            </div>
            {e.voto === "down" ? <DownReason outfitId={o.id} /> : null}
          </div>
        );
      })}
    </div>
  );
}
