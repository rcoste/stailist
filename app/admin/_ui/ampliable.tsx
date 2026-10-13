"use client";

import { useState, type ReactNode } from "react";
import { PrendaZoom } from "@/components/prenda-zoom";

// UNA MINIATURA DEL ADMIN QUE SE PUEDE VER EN GRANDE (2026-10-13). Roberto: "a
// los thumbnails no les puedo picar y verlos grandes, está raro". La ficha
// pinta avatar, clóset y renders en cuadritos de 24 a 120px, que sirven para
// ubicar pero no para revisar si una imagen salió bien.
//
// Reusa el visor de la app (components/prenda-zoom.tsx) en su variante
// `grande`, en vez de un visor propio del admin. Sin imagen no hay nada que
// ampliar: se pinta tal cual y no es botón.
export function Ampliable({
  imagen,
  nombre,
  sub,
  className = "",
  children,
}: {
  imagen: string | null;
  nombre: string;
  sub?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  if (!imagen) return <div className={className}>{children}</div>;
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`Ver en grande: ${nombre}`}
        className={`cursor-zoom-in transition-opacity duration-200 hover:opacity-80 ${className}`}
      >
        {children}
      </button>
      <PrendaZoom grande data={abierta ? { image: imagen, nombre, sub } : null} onClose={() => setAbierta(false)} />
    </>
  );
}
