"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

// El menú "···" de tus esenciales (header móvil — mockup 2026-08-13, gemelo
// del menú del viaje): junta las acciones raras. Solo editar — los esenciales
// no se borran, y "rearmar la lista" es contextual (los nudges de la lista lo
// ofrecen cuando aplica), no un ítem de menú.
export function EsencialesMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Opciones de tus esenciales"
        className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line bg-surface text-muted after:absolute after:-inset-2 after:content-['']"
      >
        <Icon name="puntos" size={16} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] bg-ink/40" onClick={() => setOpen(false)}>
          <div
            className="absolute right-4 top-28 min-w-[224px] overflow-hidden rounded-md bg-surface py-1"
            style={{ boxShadow: "var(--shadow-float)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href="/closet/capsula/editar"
              className="flex min-h-11 items-center gap-3 px-4 text-[14.5px] font-semibold text-ink"
            >
              <Icon name="lapiz" size={16} /> editar mis esenciales
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
