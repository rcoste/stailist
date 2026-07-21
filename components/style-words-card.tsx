"use client";

import { useState, useTransition } from "react";
import { saveStyleWords } from "@/app/perfil/actions";
import { STYLE_WORDS_MAX } from "@/lib/style-words";

// "Tu estilo en tus palabras": texto libre opcional. La señal más directa que
// puede dar la persona; entra a todos los motores (Hoy, cápsula, viaje).
export function StyleWordsCard({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  const dirty = value.trim() !== saved.trim();

  function guardar() {
    setError(false);
    start(async () => {
      const r = await saveStyleWords(value);
      if (r.ok) setSaved(value.trim());
      else setError(true);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Tu estilo en tus palabras
        </span>
        {dirty ? (
          <button
            onClick={guardar}
            disabled={busy}
            className="shrink-0 text-[11.5px] font-medium text-accent hover:text-accent-deep disabled:opacity-50"
          >
            {busy ? "guardando…" : "guardar"}
          </button>
        ) : saved ? (
          <span className="text-[11px] text-muted">guardado</span>
        ) : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, STYLE_WORDS_MAX))}
        rows={3}
        maxLength={STYLE_WORDS_MAX}
        placeholder='Cuéntame cómo te gusta vestir, en tus palabras. Ej: "básicos bien cortados, casi todo neutro, nada de logos ni estampados".'
        className="w-full resize-none rounded-sm border border-line bg-bg p-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
      />
      {error ? (
        <p className="text-xs text-error">No se pudo guardar. Inténtalo de nuevo.</p>
      ) : null}
      <p className="text-xs text-muted">
        Opcional — pero es la señal más directa que me puedes dar: la uso en cada
        look, en tu cápsula y al armar tu maleta.
      </p>
    </div>
  );
}
