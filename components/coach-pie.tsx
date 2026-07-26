"use client";

import { useState } from "react";

// El pie del coach (handoff design_handoff_look_detalle_v2 §6): "POR QUÉ ·
// CÓMO LLEVARLO" montados en el filete que separa el cuerpo de la botonera, con
// el texto en un slot fijo y crossfade entre los dos. La razón del rediseño: las
// pestañas son VISTAS del look y el porqué es la VOZ del coach — mezclarlos en
// la misma barra los igualaba y confundía.
//
// Reglas que vienen del handoff:
// - La palabra inactiva va en --c-muted (4.53:1), nunca más claro: la opción no
//   elegida ES la señal de que existe un segundo texto.
// - El slot tiene min-height fija y los párrafos se superponen (absolute) con
//   crossfade: NADA se mueve al cambiar — el texto jamás le cobra espacio a la foto.
// - Porqué en serif itálica; cómo llevarlo en sans. Sin ✦ (el rótulo ya nombra
//   la voz).
export function CoachPie({
  porQue,
  como,
}: {
  porQue: string;
  /** El tip de styling ("cómo llevarlo"). Sin tip → solo se muestra el porqué. */
  como?: string | null;
}) {
  const [how, setHow] = useState(false);
  const hasComo = !!como?.trim();
  const showHow = how && hasComo;

  const word = (label: string, active: boolean, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={active}
      className={`relative flex min-h-[26px] items-center text-[10.5px] font-bold uppercase tracking-[0.11em] transition-colors duration-200 after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-3 flex shrink-0 flex-col">
      {/* Las dos palabras montadas en el filete; la línea continúa a la derecha. */}
      <div className="flex items-center gap-3 pb-2">
        {word("por qué", !showHow, hasComo ? () => setHow(false) : undefined)}
        {hasComo ? word("cómo llevarlo", showHow, () => setHow(true)) : null}
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>

      {/* Slot fijo: párrafos superpuestos + crossfade. Nada se mueve al cambiar. */}
      <div className="relative min-h-[66px]">
        <p
          className={`font-display text-[16.5px] italic leading-[22px] text-muted line-clamp-3 transition-opacity duration-200 ${
            showHow ? "opacity-0" : "opacity-100"
          }`}
        >
          {porQue}
        </p>
        {hasComo ? (
          <p
            className={`absolute inset-0 text-[14px] leading-[20px] text-ink line-clamp-3 transition-opacity duration-200 ${
              showHow ? "opacity-100" : "opacity-0"
            }`}
          >
            {como}
          </p>
        ) : null}
      </div>
    </div>
  );
}
