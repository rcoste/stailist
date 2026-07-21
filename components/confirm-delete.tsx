"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Confirmación de borrado. Una sola para toda la app: prendas, viajes y outfits
// se borran igual, así el gesto se aprende una vez.
//
// Va por portal a <body> por lo mismo que las hojas (components/sheet.tsx): un
// `translate` en un ancestro atrapa los `position: fixed`. Además así puede
// vivir ENCIMA de una hoja abierta — que es justo el caso de la prenda.
export function ConfirmDelete({
  open,
  titulo,
  detalle,
  confirmar = "sí, bórralo",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** Qué se va, en una línea. Ej: "¿quitar la camisa blanca del clóset?" */
  titulo: string;
  /** Qué implica, en voz de amiga. Ej: "puedo devolvértela si te arrepientes." */
  detalle?: string;
  confirmar?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    // El foco arranca en cancelar, no en borrar: el default seguro es no borrar.
    okRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      onClick={onCancel}
    >
      <div aria-hidden className="absolute inset-0 bg-ink/60" />
      <div
        className="relative z-10 w-full max-w-[340px] rounded-sm bg-surface p-5"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold leading-snug text-ink">{titulo}</h2>
        {detalle ? (
          <p className="display mt-2 text-[14px] leading-snug text-muted">{detalle}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex min-h-11 items-center justify-center rounded-sm border border-line bg-bg text-sm font-semibold text-error transition-colors hover:border-error"
          >
            {confirmar}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={onCancel}
            className="flex min-h-11 items-center justify-center rounded-sm text-sm font-semibold text-ink transition-colors hover:text-muted"
          >
            mejor no
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
