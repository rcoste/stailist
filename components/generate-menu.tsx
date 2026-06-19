"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

// Menú de "Generar outfit": bottom sheet con las opciones de generación.
// "Un outfit" lleva al formulario (ocasión + día/noche + clima) — sirve para
// hoy o cualquier día. "Modo viaje" lleva a /viaje (cápsula + maleta para un
// viaje). Hoy y "otro día" están unificados en "Un outfit".
export function GenerateMenu({
  onUnOutfit,
  onClose,
}: {
  onUnOutfit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/40"
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-bg p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-base font-semibold text-ink">¿Qué generamos?</span>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <Icon name="equis" size={18} className="text-muted" />
          </button>
        </div>

        <button
          type="button"
          onClick={onUnOutfit}
          className="mb-2.5 flex w-full items-center gap-3 rounded-lg border-2 border-accent bg-surface p-3.5 text-left transition-colors hover:bg-accent-soft"
        >
          <Icon name="destello" size={22} className="shrink-0 text-accent" />
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-medium text-ink">Un outfit</span>
            <span className="text-xs text-muted">Para hoy o cuando quieras</span>
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-accent" />
        </button>

        <Link
          href="/viaje"
          className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-ink"
        >
          <Icon name="maletin" size={22} className="shrink-0 text-accent" />
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-medium text-ink">Modo viaje</span>
            <span className="text-xs text-muted">Varios días, una maleta</span>
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-accent" />
        </Link>
      </div>
    </div>
  );
}
