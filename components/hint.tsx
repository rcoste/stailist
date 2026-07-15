"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { dismissHint, type HintId } from "@/lib/hints";

// Tip de descubrimiento contextual ("este botón es para esto"). Reglas:
// just-in-time (vive en la superficie donde el módulo es relevante), UNA por
// pantalla (el server decide cuál pasa), jamás bloquea, se cierra con un tap y
// no vuelve a salir (profiles.hints_seen).
//
// NO es un card de contenido: es una nota al margen del "coach". Por eso NO usa
// el relleno accent-soft + borde de los nudges de acción (eso lo hacía leer como
// chrome de la app). En su lugar: regla de acento a la izquierda sobre el papel
// + eyebrow "UN TIP" con el ✦ de la marca (mismo patrón que "Por qué es tuya").
// Sin emoji — el DS v3 los reemplazó por íconos de línea.
export function Hint({ id, children }: { id: HintId; children: React.ReactNode }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;

  function cerrar() {
    setGone(true); // optimista: fuera de la vista al instante
    void dismissHint(id);
  }

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 border-l-2 border-accent py-1 pl-3.5"
      style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
    >
      <div className="flex flex-col gap-1">
        <span className="flex w-fit items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-accent">
          <Icon name="destello" size={12} />
          Un tip
        </span>
        <p className="text-[13.5px] leading-snug text-ink">{children}</p>
      </div>
      <button
        type="button"
        onClick={cerrar}
        className="shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
      >
        entendido
      </button>
    </div>
  );
}
