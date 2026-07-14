"use client";

import { useState } from "react";
import { dismissHint, type HintId } from "@/lib/hints";

// Burbuja de descubrimiento contextual ("este botón es para esto"). Reglas:
// just-in-time (vive en la superficie donde el módulo es relevante), UNA por
// pantalla (el server decide cuál pasa), jamás bloquea, se cierra con un tap y
// no vuelve a salir (profiles.hints_seen). El 💡 es la marca de "tip".
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
      className="flex items-start justify-between gap-3 rounded-lg border border-accent/40 bg-accent-soft px-3.5 py-3"
      style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
    >
      <p className="text-[13.5px] leading-snug text-ink">
        <span aria-hidden>💡 </span>
        {children}
      </p>
      <button
        type="button"
        onClick={cerrar}
        className="shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold text-accent hover:underline"
      >
        entendido
      </button>
    </div>
  );
}
