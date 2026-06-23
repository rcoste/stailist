"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";

// Visor de prenda: tocas una miniatura (maleta, looks, "lleva puesto") y la ves
// EN GRANDE con su nombre. Resuelve la fricción de "¿qué prenda es esta?" con
// thumbnails chiquitos y sin etiqueta. Reutilizable; `action` es un slot opcional
// para una acción de contexto (p. ej. el botón "Empacar" en la maleta).
export type PrendaZoomData = {
  image: string | null;
  nombre: string;
  sub?: string | null;
};

export function PrendaZoom({
  data,
  onClose,
  action,
}: {
  data: PrendaZoomData | null;
  onClose: () => void;
  action?: ReactNode;
}) {
  if (!data) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={data.nombre}
    >
      <div
        className="flex w-full max-w-[430px] flex-col gap-4 rounded-t-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="h-1 w-9 rounded-full bg-line" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
          >
            <Icon name="equis" size={20} />
          </button>
        </div>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-md border border-line bg-bg">
          {data.image ? (
            <Image
              src={data.image}
              alt={data.nombre}
              fill
              sizes="280px"
              className="object-contain"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted">
              <Icon name="gancho" size={40} />
            </span>
          )}
        </div>

        <div className="text-center">
          <p className="editorial text-h3 leading-tight text-ink">{data.nombre}</p>
          {data.sub ? <p className="mt-1.5 text-sm leading-snug text-muted">{data.sub}</p> : null}
        </div>

        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
