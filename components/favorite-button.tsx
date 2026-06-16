"use client";

import { useState } from "react";
import { toggleFavorite } from "@/lib/outfit-actions";

// Bookmark de un look (guardar como favorito). Optimista; si falla, revierte.
// onChange avisa al padre (el filtro "solo favoritos" del historial lo usa).
export function FavoriteButton({
  outfitId,
  initialFavorited,
  onChange,
}: {
  outfitId: string;
  initialFavorited: boolean;
  onChange?: (favorited: boolean) => void;
}) {
  const [fav, setFav] = useState(initialFavorited);

  async function toggle() {
    const next = !fav;
    setFav(next);
    onChange?.(next);
    const res = await toggleFavorite(outfitId, next);
    if (!res.ok) {
      setFav(!next);
      onChange?.(!next);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={fav}
      aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 shadow-[var(--shadow-hairline)] backdrop-blur transition-colors duration-200 hover:bg-surface"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={fav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        className={fav ? "text-accent" : "text-ink"}
      >
        <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
