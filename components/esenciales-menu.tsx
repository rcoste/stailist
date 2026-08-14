"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

// El menú "···" de tus esenciales (header móvil — mockup 2026-08-13, gemelo
// del menú del viaje): junta las acciones raras. Solo editar — los esenciales
// no se borran, y "rearmar la lista" es contextual (los nudges de la lista lo
// ofrecen cuando aplica), no un ítem de menú.
//
// VIVE EN EL HEADER, en el sitio del perfil (ver el bloque `back`/`accion` de
// AppShell). Por eso mide 36px y no los 30 con los que nació en su fila propia:
// sustituye al circulito del perfil y la fila no puede cambiar de altura según
// en qué pantalla estés.
export function EsencialesMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Opciones de tus esenciales"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors duration-200 hover:text-ink after:absolute after:-inset-2 after:content-['']"
      >
        <Icon name="puntos" size={16} />
      </button>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-[60] bg-ink/40"
            onClick={() => setOpen(false)}
          />
          {/* CUELGA DEL BOTÓN (`top-full`), no de una distancia al borde de la
              pantalla. Con una medida fija al viewport, cualquier cosa que
              empuje el header hacia abajo —el aviso de "hay una versión
              nueva"— dejaba el menú TAPANDO el botón que lo abrió. Verificado
              en pantalla con el aviso puesto. */}
          <div
            className="absolute right-0 top-full z-[61] mt-2 min-w-[224px] overflow-hidden rounded-md bg-surface py-1"
            style={{ boxShadow: "var(--shadow-float)" }}
          >
            <Link
              href="/closet/capsula/editar"
              className="flex min-h-11 items-center gap-3 px-4 text-[14.5px] font-semibold text-ink"
            >
              <Icon name="lapiz" size={16} /> editar mis esenciales
            </Link>
          </div>
        </>
      ) : null}
    </>
  );
}
