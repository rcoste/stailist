"use client";

import { useState } from "react";
import { saveDownReason } from "@/lib/outfit-actions";

// Aparece tras un 👎: pregunta por qué con pills rápidas + opción abierta.
// Lo que elige se guarda para calibrar el juez de styling con datos reales.
const REASONS = [
  "No combina",
  "No va con la ocasión",
  "No es mi estilo",
  "No me queda bien",
];

// Reusable entre Modo Hoy y Modo Viaje. Por defecto guarda contra un outfit
// (outfits.id) vía saveDownReason; si recibe onSave, delega ahí (el viaje guarda
// la razón en trips.outfits[index], que no tiene id de fila).
export function DownReason({
  outfitId,
  onSave,
}: {
  outfitId?: string;
  onSave?: (reason: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [text, setText] = useState("");

  function save(reason: string) {
    setPicked(reason);
    setOther(false);
    if (onSave) onSave(reason);
    else if (outfitId) saveDownReason(outfitId, reason);
  }

  if (picked) {
    return (
      <p className="text-xs text-muted">Gracias — lo tomo en cuenta.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg px-3 py-3">
      <p className="text-xs font-medium text-muted">¿Qué no te latió?</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => save(r)}
            className="rounded-sm border border-line bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors duration-200 hover:border-accent"
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOther((v) => !v)}
          aria-pressed={other}
          className={`rounded-sm border px-3 py-1 text-xs font-medium transition-colors duration-200 ${
            other
              ? "border-accent bg-accent-soft text-ink"
              : "border-line bg-surface text-ink hover:border-accent"
          }`}
        >
          Otra…
        </button>
      </div>
      {other ? (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="cuéntame…"
            className="min-h-9 flex-1 rounded-sm border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => text.trim() && save(text.trim())}
            disabled={!text.trim()}
            className="min-h-9 rounded-sm bg-accent px-4 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      ) : null}
    </div>
  );
}
