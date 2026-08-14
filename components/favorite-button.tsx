"use client";

import { useEffect, useRef, useState } from "react";
import { toggleFavorite } from "@/lib/outfit-actions";
import { Toast } from "@/components/toast";

// Corazón de favorito de un look (metáfora unificada en toda la app: Hoy, wow,
// Historial). Optimista; si falla, revierte. onChange avisa al padre.
// variant: "overlay" (default) va SOBRE fotos (blur + sombra); "ring" es el
// círculo hairline de la fila de pestañas del detalle (handoff v2 §3).
export function FavoriteButton({
  outfitId,
  initialFavorited,
  onChange,
  variant = "overlay",
  confirmaDestino = false,
}: {
  outfitId: string;
  initialFavorited: boolean;
  onChange?: (favorited: boolean) => void;
  variant?: "overlay" | "ring";
  /**
   * Al guardar, avisa DÓNDE quedó el look y ofrece ir.
   *
   * Feedback de Alberto: "le doy corazón y el único lugar donde me aparece es
   * en mi historial". El sitio existía —el filtro "favoritos"— pero el corazón
   * no lo mencionaba, así que guardar se sentía como que no pasaba nada.
   *
   * Solo donde tenga sentido: en el Historial ya estás en el destino, y en el
   * wow del onboarding todavía no hay historial que visitar.
   */
  confirmaDestino?: boolean;
}) {
  const [fav, setFav] = useState(initialFavorited);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef(0);
  // Un toggle a la vez: taps rápidos encolaban varias server actions contra el
  // mismo look y solo la última decidía — el corazón podía quedar mintiendo.
  const enVuelo = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function toggle() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    const next = !fav;
    setFav(next);
    onChange?.(next);
    // Solo al GUARDAR: confirmar un borrado ofreciendo ir a verlo no tiene
    // sentido — justo acabas de decir que no lo quieres ahí.
    if (next && confirmaDestino) {
      setToast("guardado en tus favoritos");
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 3200);
    }
    // finally OBLIGATORIO: si la action revienta (sin red, deploy en curso), un
    // `enVuelo.current = false` suelto al final nunca corre y el corazón queda
    // muerto para siempre — el mismo "le pico y no reacciona" que el candado
    // venía a evitar, pero peor. Y el catch revierte: sin él, el corazón se
    // queda encendido mostrando algo que nunca se guardó.
    try {
      const res = await toggleFavorite(outfitId, next);
      if (!res.ok) throw new Error("no se guardó");
    } catch {
      setFav(!next);
      onChange?.(!next);
      setToast(null);
    } finally {
      enVuelo.current = false;
    }
  }

  return (
    <>
    {confirmaDestino ? (
      <Toast message={toast} accion={{ label: "ver", href: "/historial?filtro=fav" }} />
    ) : null}
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
    </>
  );
}
