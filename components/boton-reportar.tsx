"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { ReporteSheet } from "@/components/reporte-sheet";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";

// EL ACCESO AL BUZÓN, EN EL HEADER (2026-09-09).
//
// Nació escondido: primero vivía sólo al pie del menú "más", y Roberto —que
// sabía que existía porque lo acabábamos de hacer— no lo encontró. Esa es la
// mejor prueba de que estaba mal puesto: si el autor no da con él, nadie va a
// dar.
//
// POR QUÉ A LA IZQUIERDA y no junto al perfil, que fue lo que él propuso: la
// esquina DERECHA ya está ocupada — el perfil, o el menú de la pantalla cuando
// lo hay (ver AppShell). Poner un segundo icono ahí lo haría chocar en la mitad
// de las pantallas. La izquierda está vacía salvo cuando hay "atrás", y ahí
// este botón cede su sitio: dentro de una pantalla de detalle, volver importa
// más, y el buzón sigue estando en el menú y en las pantallas de error.
//
// El sheet va por portal a <body>: la tab bar tiene transform y confinaría un
// `fixed` hijo suyo (la trampa que ya se documentó en sheets-portal-a-body).
export function BotonReportar() {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (!abierto) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Cuéntame algo"
        className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors duration-200 hover:border-ink hover:text-ink"
      >
        <Icon name="sobre" size={17} />
      </button>

      {montado && abierto
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35 px-0"
              onClick={() => setAbierto(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[430px] rounded-t-[14px] bg-surface px-5 pb-[calc(57px+22px+16px)] pt-2.5 shadow-[0_-20px_50px_-26px_rgb(0_0_0/0.45)]"
                style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
              >
                <span aria-hidden className="mx-auto mb-3 mt-1 block h-1 w-9 rounded-full bg-line" />
                <ReporteSheet onClose={() => setAbierto(false)} />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
