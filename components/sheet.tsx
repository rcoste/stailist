"use client";

import { useEffect, useRef } from "react";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";
import { createPortal } from "react-dom";

// Bottom sheet del sistema: scrim a pantalla completa, cierre por tap fuera y
// por Escape, y scroll del fondo bloqueado mientras vive.
//
// Va SIEMPRE por portal a <body>, y eso no es un capricho: la tab bar usa
// `-translate-x-1/2`, y en CSS un `translate` (igual que un `transform`) en un
// ancestro convierte a ese ancestro en el contenedor de los `position: fixed`
// que cuelgan de él. La hoja de "Más" vivía dentro de la barra, así que su
// `fixed inset-0` medía 56px (el alto de la barra) en vez de la pantalla: el
// fondo no se oscurecía y tocar fuera no cerraba nada. El portal la saca de ahí.
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // El handler vive en un ref para que el efecto dependa SOLO de `open`: si
  // dependiera de la función (que el padre recrea en cada render) el efecto se
  // re-correría y podría dejar el body bloqueado al restaurar un valor ya "hidden".
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // `open` arranca en false en todos los usos, así que en SSR esto es null y no
  // hay desajuste de hidratación; el guard de `document` es el cinturón.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      onClick={onClose}
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40" />
      <div
        className="relative z-10 max-h-[85dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[18px] bg-surface px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-2 lg:rounded-[18px]"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asa: además de señal visual, es zona de cierre por tap. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="mx-auto mb-3.5 mt-1.5 block h-1 w-9 rounded-full bg-line"
        />
        {children}
      </div>
    </div>,
    document.body
  );
}
