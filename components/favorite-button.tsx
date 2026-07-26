"use client";

import { useState } from "react";
import { toggleFavorite } from "@/lib/outfit-actions";

// Corazón de favorito de un look (metáfora unificada en toda la app: Hoy, wow,
// Historial). Optimista; si falla, revierte. onChange avisa al padre.
// variant: "overlay" (default) va SOBRE fotos (blur + sombra); "ring" es el
// círculo hairline de la fila de pestañas del detalle (handoff v2 §3).
export function FavoriteButton({
  outfitId,
  initialFavorited,
  onChange,
  variant = "overlay",
}: {
  outfitId: string;
  initialFavorited: boolean;
  onChange?: (favorited: boolean) => void;
  variant?: "overlay" | "ring";
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
      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 after:absolute after:-inset-1 after:content-[''] ${
        variant === "ring"
          ? "border border-line bg-surface hover:border-ink"
          : "bg-surface/90 shadow-[var(--shadow-hairline)] backdrop-blur hover:bg-surface"
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={fav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={fav ? "text-accent" : "text-ink"}
      >
        <path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" />
      </svg>
    </button>
  );
}
